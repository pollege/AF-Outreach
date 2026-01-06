import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

// Init Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s timeout

export async function GET() {
    console.log("Starting Inbox Sync...");
    const stats = { accounts: 0, processed: 0, matched: 0, errors: 0 };

    try {
        // 1. Fetch Active Mail Accounts
        const { data: accounts, error } = await supabase
            .from('mail_accounts')
            .select('*')
            .eq('status', 'active');

        if (error) throw error;
        if (!accounts || accounts.length === 0) {
            return NextResponse.json({ message: "No active accounts found" });
        }

        stats.accounts = accounts.length;

        // 2. Iterate Accounts
        for (const account of accounts) {
            try {
                if (!account.imap_host || !account.imap_port) continue;

                const config = {
                    imap: {
                        user: account.imap_user || account.email,
                        password: account.imap_pass || account.smtp_pass, // Fallback to SMTP pass if strictly same
                        host: account.imap_host,
                        port: account.imap_port,
                        tls: account.imap_port === 993,
                        authTimeout: 10000,
                        tlsOptions: { rejectUnauthorized: false }
                    }
                };

                const connection = await imaps.connect(config);
                await connection.openBox('INBOX');

                // 3. Search Criteria
                // Sync last 24 hours to be safe
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                const searchCriteria = [
                    ['SINCE', yesterday.toISOString()]
                ];

                const fetchOptions = {
                    bodies: ['HEADER', 'TEXT', ''],
                    struct: true
                };

                const messages = await connection.search(searchCriteria, fetchOptions);
                console.log(`[${account.email}] Found ${messages.length} messages since yesterday.`);

                // 4. Process Messages
                for (const item of messages) {
                    const allParts = item.parts;
                    const headerPart = allParts.find((part: any) => part.which === 'HEADER');
                    // imap-simple returns headers in 'body' of the part
                    // but simpleParser is better.

                    // Strategy: Get the full raw message to allow simpleParser to do its magic
                    // Re-fetch full body for this specific message?
                    // Fetch options above included '' (Full Body).
                    const fullBodyPart = allParts.find((part: any) => part.which === '');

                    if (!fullBodyPart) continue;

                    const parsed = await simpleParser(fullBodyPart.body);
                    const messageId = parsed.messageId; // Provider ID
                    const fromEmail = parsed.from?.value[0]?.address?.toLowerCase();
                    const subject = parsed.subject;
                    const date = parsed.date || new Date();

                    if (!messageId || !fromEmail) continue;

                    // 5Check Deduplication
                    const { data: existing } = await supabase
                        .from('messages')
                        .select('id')
                        .eq('provider_message_id', messageId)
                        .single();

                    if (existing) continue; // Already imported

                    // 6. Match Lead (Smart Matching Strategy)
                    const { data: leads } = await supabase
                        .from('leads')
                        .select('id, campaign_id, status')
                        .eq('email', fromEmail);

                    let lead = leads && leads.length > 0 ? leads[0] : null;

                    // Fallback: Smart Matching via In-Reply-To / References
                    if (!lead) {
                        const references = [
                            typeof parsed.inReplyTo === 'string' ? parsed.inReplyTo : undefined,
                            ...(Array.isArray(parsed.references) ? parsed.references : (typeof parsed.references === 'string' ? [parsed.references] : []))
                        ].filter(Boolean); // Remove null/undefined

                        if (references.length > 0) {
                            // Find the original message we sent that has this Message-ID
                            const { data: parentMsg } = await supabase
                                .from('messages')
                                .select('lead_id, leads!inner(id, campaign_id, status)')
                                .in('provider_message_id', references)
                                .limit(1)
                                .single();

                            if (parentMsg && parentMsg.leads) {
                                const matchedLead = Array.isArray(parentMsg.leads) ? parentMsg.leads[0] : parentMsg.leads;
                                console.log(`[SmartMatch] Matched email from ${fromEmail} to lead ${matchedLead.id} via thread.`);
                                lead = matchedLead;
                            }
                        }
                    }

                    if (lead) {
                        // Found a match!

                        // Insert Message
                        const { error: insertError } = await supabase.from('messages').insert({
                            lead_id: lead.id,
                            campaign_id: lead.campaign_id,
                            type: 'inbound',
                            status: 'replied',
                            provider_message_id: messageId,
                            subject: subject,
                            body: parsed.text || parsed.html || "(No Content)", // Plain text preferred for preview
                            received_at: date.toISOString(),
                            created_at: date.toISOString(),
                            cc: (parsed.cc as any)?.value?.map((a: any) => a.address) || [],
                            bcc: (parsed.bcc as any)?.value?.map((a: any) => a.address) || []
                        });

                        if (!insertError) {
                            stats.matched++;
                            stats.processed++;

                            // Update Lead Status
                            if (lead.status !== 'replied' && lead.status !== 'unsubscribed') {
                                await supabase.from('leads').update({
                                    status: 'replied',
                                    last_interaction_at: new Date().toISOString()
                                }).eq('id', lead.id);
                            }
                        }
                    }
                }

                connection.end();

            } catch (err) {
                console.error(`Error syncing account ${account.email}:`, err);
                stats.errors++;
            }
        }

        return NextResponse.json({ success: true, stats });

    } catch (error: any) {
        console.error("Sync Cron Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
