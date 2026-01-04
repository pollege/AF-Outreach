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

            // Prepare Payload for n8n
            const payload = {
                message_id: msg.id,
                to_email: lead.email,
                to_name: `${lead.first_name} ${lead.last_name}`,
                subject: msg.subject,
                body_html: msg.body +
                    `<br><br><small><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/unsubscribe/${msg.unsubscribe_token || 'test'}">Unsubscribe</a></small>` +
                    `<img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/track/open/${msg.id}" width="1" height="1" style="display:none" />`,
                metadata: {
                    campaign: msg.campaigns?.name,
                    company: lead.company_name
                }
            };

            // 4. Send to n8n
            const n8nResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (n8nResponse.ok) {
                // Update status to 'sending' (n8n will confirm 'sent' later via webhook)
                // OR set to 'sent' if we trust n8n accepted it. 
                // Spec says: Update to 'sending'.
                await supabase.from('messages').update({ status: 'sending', sent_at: new Date().toISOString() }).eq('id', msg.id);
                sentIds.push(msg.id);
            } else {
                console.error(`Failed to send to n8n for msg ${msg.id}`);
            }
        }

        return NextResponse.json({ sent_count: sentIds.length, ids: sentIds });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
