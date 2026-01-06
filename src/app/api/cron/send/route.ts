import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    // Ideally this should be a POST to protect it, but GET is easier for simple cron services

    try {
        // 1. Check Limits (Simplified for MVP)
        // In real app, query 'email_settings' and count 'messages' sent in last hour.
        const { data: settings } = await supabase.from('email_settings').select('*').single();
        const webhookUrl = settings?.n8n_webhook_url; // e.g. https://n8n.yourserver.com/webhook/...

        if (!webhookUrl) {
            return NextResponse.json({ error: 'No n8n webhook configured in settings' }, { status: 400 });
        }

        // 2. Fetch Queued Messages
        const { data: messages } = await supabase
            .from('messages')
            .select('*, leads(*), campaigns(*)')
            .eq('status', 'queued')
            .limit(10); // Batch size

        if (!messages || messages.length === 0) {
            return NextResponse.json({ message: 'No queued messages' });
        }

        const sentIds = [];

        // 3. Process Batch
        for (const msg of messages) {
            const lead = msg.leads;
            const campaign = msg.campaigns;

            // --- SENDER SELECTION LOGIC ---
            let senderAccount = null;

            // A. Check for Override
            if (campaign?.sender_account_id) {
                const { data: overrideAcc } = await supabase
                    .from('mail_accounts')
                    .select('*')
                    .eq('id', campaign.sender_account_id)
                    .single();

                // Verify limits
                if (overrideAcc && overrideAcc.status === 'active') {
                    if (overrideAcc.daily_sent < overrideAcc.daily_limit) {
                        senderAccount = overrideAcc;
                    } else {
                        console.warn(`Campaign Override Account ${overrideAcc.email} has reached daily limit.`);
                        // Fallback to rotation or simple skip?
                        // For now: Skip message to respect override intent (don't send from random person if CEO was requested)
                        console.log(`Skipping msg ${msg.id} due to override account limit.`);
                        continue;
                    }
                }
            }

            // B. Auto Rotation (if no override OR override invalid/missing, but logic above skips if override limit hit)
            // But if campaign.sender_account_id was NULL, we rotate.
            if (!senderAccount && !campaign?.sender_account_id) {
                // Fetch all active accounts with available budget
                const { data: validAccounts } = await supabase
                    .from('mail_accounts')
                    .select('*')
                    .eq('status', 'active')
                    .gt('daily_limit', supabase.raw('daily_sent')); // raw check: daily_limit > daily_sent (psuedo-code,supabase complex filter needs raw usually or filter in JS)

                // Supabase doesn't support col comparison easy in JS client filters sometimes. 
                // Let's fetch active and filter in JS for MVP (assuming low # of accounts)
                const { data: allActive } = await supabase.from('mail_accounts').select('*').eq('status', 'active');

                const candidates = allActive?.filter(a => a.daily_sent < a.daily_limit) || [];

                if (candidates.length > 0) {
                    // Random Load Balancing
                    senderAccount = candidates[Math.floor(Math.random() * candidates.length)];
                } else {
                    console.error("No mail accounts available with quota!");
                    continue; // Skip sending
                }
            }

            if (!senderAccount) {
                console.error(`Could not determine sender for msg ${msg.id}`);
                continue;
            }

            // --- END SENDER SELECTION ---

            // Tracking Logic
            const trackingPixel = campaign?.tracking_enabled
                ? `<img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/track/open?mid=${msg.id}" width="1" height="1" style="display:none" />`
                : '';

            // Italian Footer (Always included)
            const unsubscribeFooter = `<br><br><small>Se non vuoi più ricevere queste email, <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/track/unsubscribe?lid=${lead.id}">disiscriviti qui</a>.</small>`;

            // Prepare Payload for n8n
            const payload = {
                message_id: msg.id,
                to_email: lead.email,
                to_name: `${lead.first_name} ${lead.last_name}`,
                subject: msg.subject,
                body_html: msg.body + unsubscribeFooter + trackingPixel,
                metadata: {
                    campaign: campaign?.name,
                    company: lead.company_name
                },
                // INJECT DYNAMIC SMTP CREDENTIALS
                smtp_config: {
                    host: senderAccount.smtp_host,
                    port: senderAccount.smtp_port,
                    user: senderAccount.smtp_user,
                    pass: senderAccount.smtp_pass,
                    secure: senderAccount.smtp_secure,
                    from_name: senderAccount.from_name,
                    from_email: senderAccount.email
                }
            };

            // 4. Send to n8n
            try {
                const n8nResponse = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (n8nResponse.ok) {
                    // Update status to 'sending'
                    await supabase.from('messages').update({ status: 'sending', sent_at: new Date().toISOString() }).eq('id', msg.id);

                    // Increment Daily Sent Count for the used account
                    await supabase.rpc('increment_daily_sent', { account_id: senderAccount.id });
                    // Or simple update if RPC not exists (Concurrency risk but okay for MVP)
                    await supabase.from('mail_accounts').update({ daily_sent: senderAccount.daily_sent + 1 }).eq('id', senderAccount.id);

                    sentIds.push(msg.id);
                } else {
                    console.error(`Failed to send to n8n for msg ${msg.id}`);
                }
            } catch (e) {
                console.error(`Error sending to n8n:`, e);
            }
        }

        return NextResponse.json({ sent_count: sentIds.length, ids: sentIds });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
