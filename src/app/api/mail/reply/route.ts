import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// Admin Client to access mail accounts and passwords
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { lead_id, body: messageBody, to, cc, bcc } = body;

        if (!lead_id || !messageBody) {
            return NextResponse.json({ error: "Missing lead_id or body" }, { status: 400 });
        }

        // 1. Fetch Lead & Campaign Info (same as before)
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select(`
                id, email, first_name, last_name, 
                campaign_id,
                campaigns (
                    id, name, sender_account_id
                )
            `)
            .eq('id', lead_id)
            .single();

        if (leadError || !lead) throw new Error("Lead not found");

        const campaignData = lead.campaigns;
        // Supabase returns an array for relations unless using inner join with modifiers, usually.
        // Even if 1:1 in DB, the client often types it as array or object depending on generation.
        // The error suggests it's an array.
        const campaign = Array.isArray(campaignData) ? campaignData[0] : campaignData;

        if (!campaign) throw new Error("Campaign not found for lead");
        if (!campaign.sender_account_id) throw new Error("Campaign has no specific sender account assigned (Auto-rotation not supported for manual replies yet)");

        // 2. Fetch Sender Account
        const { data: account, error: accError } = await supabase
            .from('mail_accounts')
            .select('*')
            .eq('id', campaign.sender_account_id)
            .single();

        if (accError || !account) throw new Error("Sender account not found");

        // 3. Find Last Inbound Message (for Threading)
        const { data: lastMsg } = await supabase
            .from('messages')
            .select('provider_message_id, subject')
            .eq('lead_id', lead_id)
            .eq('type', 'inbound')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // 4. Configure Transporter
        const transporter = nodemailer.createTransport({
            host: account.smtp_host,
            port: account.smtp_port,
            secure: account.smtp_port === 465,
            auth: {
                user: account.smtp_user || account.email,
                pass: account.smtp_pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // 5. Send Email
        const recipientList = to ? (Array.isArray(to) ? to.join(',') : to) : lead.email;
        const ccList = cc ? (Array.isArray(cc) ? cc.join(',') : cc) : undefined;
        const bccList = bcc ? (Array.isArray(bcc) ? bcc.join(',') : bcc) : undefined;

        const mailOptions: any = {
            from: `"${account.from_name}" <${account.email}>`,
            to: recipientList,
            cc: ccList,
            bcc: bccList,
            subject: lastMsg?.subject ? `Re: ${lastMsg.subject.replace(/^Re: /i, '')}` : `Re: Outreach`,
            text: messageBody, // TODO: Supports HTML if frontend sends it. Frontend sends clean HTML now?
            html: messageBody, // Frontend sends HTML from RichTextEditor
            // Threading Headers
            ...(lastMsg?.provider_message_id ? {
                inReplyTo: lastMsg.provider_message_id,
                references: lastMsg.provider_message_id
            } : {})
        };

        const result = await transporter.sendMail(mailOptions);

        // 6. Save to DB
        const { error: insertError } = await supabase.from('messages').insert({
            lead_id: lead.id, // Fixed typo: leads.id -> lead.id
            campaign_id: campaign.id,
            type: 'initial', // Should we add 'reply' type? Keeping 'initial' for now as custom.
            status: 'sent',
            subject: mailOptions.subject,
            body: messageBody,
            body_final: messageBody,
            sent_at: new Date().toISOString(),
            provider_message_id: result.messageId,
            cc: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
            bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : []
        });

        // Update Lead Last Contacted
        await supabase.from('leads').update({
            last_contacted_at: new Date().toISOString(),
            status: 'replied' // Keep as replied or move to 'qualified'? Let user decide manually.
        }).eq('id', lead.id);

        return NextResponse.json({ success: true, messageId: result.messageId });

    } catch (error: any) {
        console.error("Reply Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
