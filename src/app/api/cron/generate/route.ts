import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('cron_secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const campaignId = searchParams.get('campaign_id');


    // 1. Fetch leads ready for generation
    // Ready means: 'researched' (All) OR 'new' (Standard Campaigns only)
    try {
        let query = supabase
            .from('leads')
            .select('*, campaigns(*)')
            .in('status', ['new', 'researched']);

        // Strict isolation: If campaign_id is provided, only process leads for that campaign
        if (campaignId) {
            query = query.eq('campaign_id', campaignId);
        }

        const { data: leads, error } = await query.limit(10);

        if (error) throw error;
        if (!leads || leads.length === 0) {
            return NextResponse.json({ message: 'No leads to generate messages for' });
        }

        const generated = [];

        // 2. Process
        for (const lead of leads) {
            const campaign = lead.campaigns;

            // LOGIC CHECK:
            // If lead is 'new' but campaign requires enrichment -> SKIP (Enricher should handle it)
            if (lead.status === 'new' && campaign?.enrichment_enabled) {
                continue;
            }

            // DUPLICATE CHECK: Skip if message already exists
            const { data: existingMsg } = await supabase
                .from('messages')
                .select('id')
                .eq('lead_id', lead.id)
                .maybeSingle(); // Use maybeSingle to avoid 406 error if multiple exist

            if (existingMsg) {
                // Determine correct status (restore logic)
                const shouldBeStatus = 'message_generated';
                // Fix inconsistencies: ensure lead is marked as generated if msg exists
                if (lead.status !== shouldBeStatus) {
                    await supabase.from('leads').update({ status: shouldBeStatus }).eq('id', lead.id);
                }
                continue;
            }

            const template = campaign?.email_template || {};
            let content = { subject: "", body: "" };

            if (!campaign?.enrichment_enabled) {
                // STANDARD MODE: Simple variable replacement
                const replaceVars = (str: string) => {
                    if (!str) return "";
                    return str
                        .replace(/{first_name}/g, lead.first_name || "")
                        .replace(/{last_name}/g, lead.last_name || "")
                        .replace(/{company_name}/g, lead.company_name || "")
                        .replace(/{job_title}/g, lead.job_title || "");
                };

                content = {
                    subject: replaceVars(template.subject_template || ""),
                    body: replaceVars(template.body_template || "")
                };
            } else {
                // AI MODE: Use GPT-4o
                const prompt = `
           Sei un copywriter B2B esperto in italiano.
           Scrivi un'email di cold outreach.
           
           Lead: ${lead.first_name} ${lead.last_name}, ${lead.job_title} @ ${lead.company_name}
           Industry: ${lead.industry}
           News: ${JSON.stringify(lead.enrichment_data?.recent_news)}
           Pain Points: ${JSON.stringify(lead.enrichment_data?.pain_points)}
           
           Template Subject: ${template.subject_template || "Ciao {first_name}"}
           Template Body: ${template.body_template || "..."}
           
           Genera un JSON: 
           { 
             "subject": "string (max 60 chars)", 
             "body": "html string (keep it simple, <p>, <br>)" 
           }
           `;

                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" }
                });

                content = JSON.parse(completion.choices[0].message.content || '{}');
            }

            // 3. Save Message
            // DETERMINE STATUS:
            // 1. Standard Campaign (No Enrichment) -> ALWAYS 'queued' (No review needed for fixed templates)
            // 2. AI Campaign -> Check automation_mode ('auto' -> 'queued', 'manual' -> 'draft')
            let initialStatus = 'draft';
            if (!campaign?.enrichment_enabled) {
                initialStatus = 'queued';
            } else {
                initialStatus = campaign?.automation_mode === 'auto' ? 'queued' : 'draft';
            }

            // 3. Save Message
            const { data: msg, error: msgError } = await supabase
                .from('messages')
                .insert({
                    lead_id: lead.id,
                    campaign_id: lead.campaign_id,
                    type: 'initial',
                    subject: content.subject,
                    body: content.body,
                    status: initialStatus,
                    personalization_used: campaign?.enrichment_enabled ? lead.enrichment_data : null
                })
                .select()
                .single();

            if (!msgError) {
                // Update lead status
                await supabase.from('leads').update({ status: 'message_generated' }).eq('id', lead.id);
                generated.push(msg.id);
            }
        }

        return NextResponse.json({ success: true, generated_count: generated.length, ids: generated });

    } catch (error: any) {
        console.error("Generator error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
