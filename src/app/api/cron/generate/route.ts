import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';

export async function GET() {
    try {
        // 1. Fetch 'researched' leads
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*, campaigns(*)') // join campaign to get template
            .eq('status', 'researched')
            .limit(5);

        if (error) throw error;
        if (!leads || leads.length === 0) {
            return NextResponse.json({ message: 'No leads to generate messages for' });
        }

        const generated = [];

        // 2. Process
        for (const lead of leads) {
            const campaign = lead.campaigns; // joined data (may be array or object depending on relationship)
            // Supabase join returns an object if 1:1 or N:1, but here lead -> campaign is N:1.
            // However, often types need check. Assume 'campaigns' is the joined object.
            const template = campaign?.email_template || {};

            // Prompt
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
                model: "gpt-4o", // Better for creative writing
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            const content = JSON.parse(completion.choices[0].message.content || '{}');

            // 3. Save Message
            const { data: msg, error: msgError } = await supabase
                .from('messages')
                .insert({
                    lead_id: lead.id,
                    campaign_id: lead.campaign_id,
                    type: 'initial',
                    subject: content.subject,
                    body: content.body,
                    status: campaign?.automation_mode === 'auto' ? 'queued' : 'draft',
                    personalization_used: lead.enrichment_data
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
