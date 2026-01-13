import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Vercel Config
export const maxDuration = 60; // 1 minute should be enough for basic batches, but safer.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Ideally this should be a POST to protect it, but GET is easier for simple cron services

    try {
        const { searchParams } = new URL(req.url);

        // Security Check (Headers or Query)
        const secret = req.headers.get('x-cron-secret') || searchParams.get('cron_secret');
        if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const campaignId = searchParams.get('campaign_id');
        const forceMode = searchParams.get('force') === 'true';

        // 1. Check Limits (Simplified for MVP)
        // In real app, query 'email_settings' and count 'messages' sent in last hour.
        const { data: settings } = await supabase.from('email_settings').select('*').single();
        const webhookUrl = settings?.n8n_webhook_url; // e.g. https://n8n.yourserver.com/webhook/...

        if (!webhookUrl) {
            return NextResponse.json({ error: 'No n8n webhook configured in settings' }, { status: 400 });
        }

        // 2. Fetch Queued Messages
        let query = supabase
            .from('messages')
            .select('*, leads(*, contacts(*)), campaigns(*)') // Fetch Deeply Linked Contacts
            .limit(10); // Batch size

        // Strict isolation: If campaign_id is provided, only send messages for that campaign
        if (campaignId) {
            query = query.eq('campaign_id', campaignId);
        }

        if (forceMode) {
            // In Test/Force mode, pick up Drafts too
            query = query.in('status', ['queued', 'draft']);
        } else {
            // Normal Cron mode: Only Queued
            query = query.eq('status', 'queued');
        }

        const { data: messages } = await query;

        if (!messages || messages.length === 0) {
            return NextResponse.json({ message: 'No queued messages (Try ?force=true to send drafts)' });
        }

        const sentIds = [];
        const skipped = [];

        // 3. Process Batch
        // FUTURE: For High Throughput (Pro SMTPs), switch this loop to await Promise.all(messages.map(...))
        for (const msg of messages) {
            const lead = msg.leads;
            // Prefer Global Contact info, fallback to Legacy Lead info
            const contact = lead.contacts || lead;

            const campaign = msg.campaigns;

            // --- SENDER SELECTION LOGIC ---
            let senderAccount = null;

            // A. Check for Message Specific Override (Manual Send)
            if (msg.sender_account_id) {
                const { data: directAcc } = await supabase
                    .from('mail_accounts')
                    .select('*')
                    .eq('id', msg.sender_account_id)
                    .single();

                if (directAcc && directAcc.status === 'active') {
                    senderAccount = directAcc;
                }
            }

            // B. Check for Campaign Override (if no message specific)
            if (!senderAccount && campaign?.sender_account_id) {
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
                    .eq('status', 'active');
                // .gt('daily_limit', supabase.raw('daily_sent')); // Removed: Complex filter done in JS below

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
                skipped.push({ id: msg.id, reason: "No active sender account found (check Settings > Email Accounts)" });
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
                to_email: contact.email,
                to_name: `${contact.first_name} ${contact.last_name}`,
                subject: msg.subject,
                body_html: msg.body + unsubscribeFooter + trackingPixel,
                metadata: {
                    campaign: campaign?.name,
                    company: contact.company_name
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
                    // Success Logic
                    await supabase.from('messages').update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        error_log: null // Clear previous errors if any
                    }).eq('id', msg.id);

                    await supabase.rpc('increment_daily_sent', { account_id: senderAccount.id });
                    await supabase.from('mail_accounts').update({ daily_sent: senderAccount.daily_sent + 1 }).eq('id', senderAccount.id);

                    sentIds.push(msg.id);
                } else {
                    // Logic for 500/400 from n8n (Handled Error)
                    const errorMsg = `n8n Error ${n8nResponse.status}: ${await n8nResponse.text()}`;
                    console.error(errorMsg);

                    // SAVE TO DB
                    await supabase.from('messages').update({
                        status: 'failed',
                        error_log: `(Sender: ${senderAccount.email}) ${errorMsg}`
                    }).eq('id', msg.id);

                    skipped.push({ id: msg.id, reason: errorMsg });
                }
            } catch (e: any) {
                // Logic for Network fail or Offline (Unhandled Error)
                const netError = `n8n Offline/Network Error: ${e.message}`;
                console.error(netError);

                // SAVE TO DB
                await supabase.from('messages').update({
                    status: 'failed',
                    error_log: netError
                }).eq('id', msg.id);

                skipped.push({ id: msg.id, reason: netError });
            }
        }

        return NextResponse.json({ sent_count: sentIds.length, ids: sentIds, skipped });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
