import { NextResponse } from 'next/server';
import { supabase as supabaseAnon } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Vercel Config
export const maxDuration = 60; // 1 minute should be enough for basic batches, but safer.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Ideally this should be a POST to protect it, but GET is easier for simple cron services

    // Initialize Admin Client if Key is available (Bypass RLS)
    const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
        : null;

    // Use Admin client for DB writes if available, otherwise fall back to Anon (and hope RLS is open)
    const db = supabaseAdmin || supabaseAnon;

    try {
        const { searchParams } = new URL(req.url);

        // Security Check (Headers or Query)
        const secret = req.headers.get('x-cron-secret') || searchParams.get('cron_secret');
        const authHeader = req.headers.get('authorization');

        // Authentication Logic: System (Secret) OR User (Token)
        let isAuthenticated = false;

        if (process.env.CRON_SECRET && secret === process.env.CRON_SECRET) {
            isAuthenticated = true; // System / n8n / Vercel Cron
        } else if (authHeader) {
            // Manual Trigger from UI
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
            if (user && !error) isAuthenticated = true;
        }

        if (!isAuthenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const campaignId = searchParams.get('campaign_id');
        const forceMode = searchParams.get('force') === 'true';

        console.log(`[Send Cron] Started. CampaignId: ${campaignId}, Force: ${forceMode}`);

        // 1. Check Limits (Simplified for MVP)
        const { data: settings } = await db.from('email_settings').select('*').single();
        const webhookUrl = settings?.n8n_webhook_url;

        if (!webhookUrl) {
            console.error("[Send Cron] No n8n webhook configured.");
            return NextResponse.json({ error: 'No n8n webhook configured in settings' }, { status: 400 });
        }

        // 2. Fetch Queued Messages
        // We select more fields and use a limit
        let query = db
            .from('messages')
            .select('*, leads(*, contacts(*)), campaigns(*)') // Fetch Deeply Linked Contacts
            .limit(10); // Batch size

        if (campaignId) {
            query = query.eq('campaign_id', campaignId);
        }

        if (forceMode) {
            query = query.in('status', ['queued', 'draft']);
        } else {
            query = query.eq('status', 'queued');
        }

        const { data: messages, error: fetchError } = await query;

        if (fetchError) {
            console.error("[Send Cron] Fetch Error:", fetchError);
            throw fetchError;
        }

        if (!messages || messages.length === 0) {
            console.log("[Send Cron] No messages found in queue.");
            return NextResponse.json({ message: 'No queued messages', sent_count: 0, skipped: [] });
        }

        console.log(`[Send Cron] Found ${messages.length} messages to process.`);

        // 3. LOCKING PHASE: Mark as 'sending' immediately to prevent race conditions
        const messageIds = messages.map(m => m.id);
        const { error: lockError } = await db
            .from('messages')
            .update({ status: 'sending', sent_at: null }) // Temp status
            .in('id', messageIds);

        if (lockError) {
            console.error("[Send Cron] Locking Error:", lockError);
            // If locking fails, we should probably abort to be safe, or just continue if it's a non-blocking error?
            // Safer to abort to avoid double sends.
            return NextResponse.json({ error: 'Locking failed' }, { status: 500 });
        }

        console.log(`[Send Cron] Locked ${messages.length} messages as 'sending'.`);


        const sentIds = [];
        const skipped = [];
        const failedIds = [];

        // 4. Process Batch
        for (const msg of messages) {
            const lead = msg.leads;
            const contact = lead.contacts || lead; // Fallback
            const campaign = msg.campaigns;

            // Log current processing
            console.log(`[Send Cron] Processing msg ${msg.id} for ${contact.email}`);

            // A. Campaign Status Check
            if (campaign?.status !== 'active') {
                console.warn(`[Send Cron] Msg ${msg.id} skipped. Campaign is ${campaign?.status}.`);
                skipped.push({ id: msg.id, reason: `Campaign not active (${campaign?.status})` });
                failedIds.push({ id: msg.id, error: `Auto-paused: Campaign state is ${campaign?.status}`, status: 'draft' }); // Revert to draft
                continue;
            }

            // B. Sender Selection
            let senderAccount = null;

            // Direct Override
            if (msg.sender_account_id) {
                const { data: directAcc } = await db.from('mail_accounts').select('*').eq('id', msg.sender_account_id).single();
                if (directAcc && directAcc.status === 'active') senderAccount = directAcc;
            }

            // Campaign Override
            if (!senderAccount && campaign?.sender_account_id) {
                const { data: overrideAcc } = await db.from('mail_accounts').select('*').eq('id', campaign.sender_account_id).single();
                if (overrideAcc && overrideAcc.status === 'active') {
                    if (overrideAcc.daily_sent < overrideAcc.daily_limit) {
                        senderAccount = overrideAcc;
                    } else {
                        console.log(`[Send Cron] Override account limit reached. Skipping.`);
                        skipped.push({ id: msg.id, reason: "Sender account limit reached" });
                        failedIds.push({ id: msg.id, error: "Sender limit reached", status: 'queued' }); // Keep queued
                        continue;
                    }
                }
            }

            // Auto Rotation
            if (!senderAccount && !campaign?.sender_account_id) {
                const { data: allActive } = await db.from('mail_accounts').select('*').eq('status', 'active');
                // Simple random load balancing among those with quota
                const candidates = allActive?.filter(a => a.daily_sent < a.daily_limit) || [];
                if (candidates.length > 0) {
                    senderAccount = candidates[Math.floor(Math.random() * candidates.length)];
                } else {
                    console.error("[Send Cron] No available mail accounts.");
                    skipped.push({ id: msg.id, reason: "No mail accounts with quota" });
                    failedIds.push({ id: msg.id, error: "No sender quota", status: 'queued' });
                    continue;
                }
            }

            if (!senderAccount) {
                console.error(`[Send Cron] No sender found for msg ${msg.id}`);
                skipped.push({ id: msg.id, reason: "No sender found" });
                failedIds.push({ id: msg.id, error: "No active sender", status: 'failed' });
                continue;
            }


            // C. Payload Construction
            const trackingPixel = campaign?.tracking_enabled
                ? `<img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/track/open?mid=${msg.id}" width="1" height="1" style="display:none" />`
                : '';

            const unsubscribeFooter = `<br><br><small>Se non vuoi più ricevere queste email, <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/track/unsubscribe?lid=${lead.id}">disiscriviti qui</a>.</small>`;

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

            // D. Send via n8n
            try {
                const n8nResponse = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (n8nResponse.ok) {
                    // SUCCESS
                    console.log(`[Send Cron] Msg ${msg.id} SENT via n8n.`);

                    // Update Message Status
                    await db.from('messages').update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        error_log: null
                    }).eq('id', msg.id);

                    // Update Lead Status
                    // Using 'sent' to map directly to "Inviato" in the UI
                    const { error: leadUpdateError } = await db.from('leads').update({
                        status: 'sent'
                    }).eq('id', lead.id);

                    if (leadUpdateError) {
                        console.error("[Send Cron] Lead Update Fatal Error:", leadUpdateError);
                        // Don't fail the whole request, but log it
                    } else {
                        console.log(`[Send Cron] Lead ${lead.id} status updated to 'sent'.`);
                    }

                    // Increment Sender Stats
                    await db.from('mail_accounts').update({ daily_sent: senderAccount.daily_sent + 1 }).eq('id', senderAccount.id);

                    sentIds.push(msg.id);

                } else {
                    // N8N ERROR
                    const errorMsg = `n8n Error ${n8nResponse.status}: ${await n8nResponse.text()}`;
                    console.error(`[Send Cron] Msg ${msg.id} FAILED: ${errorMsg}`);
                    failedIds.push({ id: msg.id, error: errorMsg, status: 'failed' });
                    skipped.push({ id: msg.id, reason: `n8n Error: ${n8nResponse.status}` });
                }
            } catch (e: any) {
                // NETWORK ERROR
                const netError = `n8n Network Error: ${e.message}`;
                console.error(`[Send Cron] Msg ${msg.id} NETWORK ERROR: ${netError}`);
                failedIds.push({ id: msg.id, error: netError, status: 'failed' });
                skipped.push({ id: msg.id, reason: "Network Error" });
            }
        }

        // 5. Cleanup Failed/Skipped Messages
        // We set them to 'sending' earlier. If they failed, we need to set them to 'failed' or 'queued' or 'draft'
        for (const f of failedIds) {
            await db.from('messages').update({
                status: f.status,
                error_log: f.error
            }).eq('id', f.id);
        }

        console.log(`[Send Cron] Batch Complete. Sent: ${sentIds.length}, Skipped: ${skipped.length}`);

        return NextResponse.json({
            sent_count: sentIds.length,
            ids: sentIds,
            skipped,
            debug_message: `Processed ${messages.length}, Sent ${sentIds.length}`
        });

    } catch (error: any) {
        console.error("[Send Cron] Critical Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
