import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';

export async function GET() {
    try {
        // 1. Fetch 'new' leads (limit 5 for testing)
        // Note: In real setup, consider using service_role key if RLS enabled/strict
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'new')
            .limit(5);

        if (error) throw error;
        if (!leads || leads.length === 0) {
            return NextResponse.json({ message: 'No new leads to enrich' });
        }

        const results = [];

        // 2. Process each lead
        for (const lead of leads) {
            // --- Search Step (Mocked for now as we don't have Brave Key) ---
            // In future: const searchResults = await braveSearch.search(`"${lead.company_name}" news`);
            const mockSearchResults = [
                `${lead.company_name} announces expansion into European market.`,
                `${lead.company_name} raises Series A funding led by TopTier VC.`,
                `Challenges in ${lead.industry}: Rising costs and compliance.`
            ];

            // --- OpenAI Step ---
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo", // or gpt-4o
                messages: [
                    {
                        role: "system",
                        content: "You are a B2B research assistant. Extract 3 recent news items and 2 potential pain points from the search context provided for the company."
                    },
                    {
                        role: "user",
                        content: `Company: ${lead.company_name}
Sector: ${lead.industry}
Search Results:
${mockSearchResults.join('\n')}

Format as JSON: { "recent_news": [], "pain_points": [] }
`
                    }
                ],
                response_format: { type: "json_object" }
            });

            const enrichmentData = JSON.parse(completion.choices[0].message.content || '{}');

            // 3. Update Lead
            const { error: updateError } = await supabase
                .from('leads')
                .update({
                    enrichment_data: {
                        ...enrichmentData,
                        enriched_at: new Date().toISOString()
                    },
                    status: 'researched'
                })
                .eq('id', lead.id);

            if (updateError) {
                console.error(`Failed to update lead ${lead.id}`, updateError);
            } else {
                results.push({ id: lead.id, company: lead.company_name, ...enrichmentData });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, data: results });

    } catch (error: any) {
        console.error("Enrichment cron error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
