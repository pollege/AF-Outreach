
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';

export async function POST(req: Request) {
    try {
        const { leadId, campaignId } = await req.json(); // Accept leadId

        if (!campaignId) {
            return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
        }

        // 1. Fetch Campaign Details (Template + Mode)
        const { data: campaign, error: cError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (cError || !campaign) throw new Error("Campaign not found");

        const template = campaign.email_template || {};
        const automationMode = campaign.automation_mode || 'review'; // 'review' | 'auto'

        // 2. Fetch Leads (Batch or Single)
        let leads = [];

        if (leadId) {
            const { data, error } = await supabase
                .from('leads')
                .select('*, contacts(*)')
                .eq('id', leadId)
                .single();
            if (error) throw error;
            if (data) leads = [data];
        } else {
            const { data, error } = await supabase
                .from('leads')
                .select('*, contacts(*)')
                .eq('campaign_id', campaignId)
                .eq('status', 'researched')
                .limit(20);
            if (error) throw error;
            leads = data || [];
        }

        if (!leads || leads.length === 0) {
            return NextResponse.json({ message: 'No researched leads to process', count: 0 });
        }

        const stats = { generated: 0, failed: 0 };

        for (const lead of leads) {
            try {
                // Access Global Contact
                const contact = lead.contacts || lead;

                // 3. Prepare Prompt
                // Use enrichment data or fallback to basic fields
                const leadInfo = lead.enrichment_data
                    ? JSON.stringify(lead.enrichment_data)
                    : `Company: ${contact.company_name}, Role: ${contact.job_title}`;

                const systemPrompt = `You are a cold outreach expert. 
                Goal: Write a personalized email based on the user's objective and the lead's enriched data.
                
                Campaign Objective/Template: "${template.body_template || 'Introduce our services'}"
                Tone: ${template.tone || 'Professional'}
                Max Length: ${template.max_length || 'Short (under 150 words)'}
                
                Output Format: JSON with keys "subject" and "body".
                The body should be HTML formatted using only <p> tags for paragraphs. Do NOT use <br> tags between paragraphs.
                Do not include placeholders like [Name], fill them in.
                Lead Name: ${contact.first_name} ${contact.last_name}`;

                const userPrompt = `Lead Data: ${leadInfo}`;

                // 4. Call OpenAI
                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    model: "gpt-4o", // Strongest model for copywriting
                    response_format: { type: "json_object" }
                });

                const content = completion.choices[0].message.content;
                const result = JSON.parse(content || '{}');

                if (!result.body) throw new Error("AI failed to generate body");

                // 5. Create Message
                // Status: 'draft' if review mode, 'queued' if auto mode
                const initialStatus = automationMode === 'auto' ? 'queued' : 'draft';

                await supabase.from('messages').insert({
                    campaign_id: campaignId,
                    lead_id: lead.id,
                    type: 'initial',
                    subject: result.subject || "Hello",
                    body: result.body,
                    status: initialStatus,
                    needs_review: automationMode === 'review',
                    created_at: new Date().toISOString()
                });

                // 6. Update Lead Status
                await supabase.from('leads').update({
                    status: 'message_generated'
                }).eq('id', lead.id);

                stats.generated++;

            } catch (err) {
                console.error(`Error generating for lead ${lead.id}:`, err);
                stats.failed++;
            }
        }

        return NextResponse.json({
            message: 'Generation batch complete',
            count: stats.generated,
            failed: stats.failed
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
