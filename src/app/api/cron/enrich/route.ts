import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';
import { searchWeb } from '@/lib/brave_search';

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
            // --- Search Step ---
            // Search for company news and challenges in Italian
            const query = `"${lead.company_name}" notizie business problemi settore ${lead.industry}`;
            const searchResults = await searchWeb(query);

            const searchContext = searchResults.length > 0
                ? searchResults.map((r: any) => `- ${r.title}: ${r.description}`).join('\n')
                : "No search results found";

            // --- OpenAI Step ---
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "Sei un assistente di ricerca B2B. Estrai 3 notizie recenti e 2 potenziali punti deboli (pain points) dal contesto di ricerca fornito per l'azienda. RISPONDI IN ITALIANO (JSON)."
                    },
                    {
                        role: "user",
                        content: `Azienda: ${lead.company_name}
Settore: ${lead.industry}
Risultati Ricerca:
${searchContext}

Format as JSON: { "recent_news": ["..."], "pain_points": ["..."] }`
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
