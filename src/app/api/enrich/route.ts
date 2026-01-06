import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
    try {
        const { leadId, campaignId } = await req.json();

        if (!campaignId) {
            return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
        }

        let leads = [];

        if (leadId) {
            // Priority: Single Lead (even if not 'new')
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('id', leadId)
                .single();
            if (error) throw error;
            if (data) leads = [data];
        } else {
            // Standard: Batch of 'new' leads
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('campaign_id', campaignId)
                .eq('status', 'new')
                .limit(20);
            if (error) throw error;
            leads = data || [];
        }

        const stats = { success: 0, failed: 0 };
        // Moved declaration outside the loop

        if (!leads || leads.length === 0) {
            return NextResponse.json({ message: 'No new leads to enrich', count: 0 });
        }

        // 2. Fetch Campaign for Settings
        const { data: campaign } = await supabase.from('campaigns').select('enrichment_config').eq('id', campaignId).single();
        const config = campaign?.enrichment_config || { type: 'generic' };

        // 3. Process Leads
        const results = [];
        for (const lead of leads) {
            try {
                // 3a. SEARCH STRATEGY (Multi-Query for better coverage)
                let queries: string[] = [];
                const currentYear = new Date().getFullYear();

                if (config.type === 'news') {
                    // NEWS: Split into General News and Specific Projects/Events
                    queries = [
                        `"${lead.company_name}" notizie recenti ${currentYear}`,
                        `"${lead.company_name}" "comunicati stampa" "nuovi progetti" investimenti`
                    ];
                } else if (config.type === 'pain_points') {
                    // PAIN POINTS (Strategic): Strategy/Growth and Market Challenges
                    queries = [
                        `"${lead.company_name}" strategia crescita piani industriali`,
                        `intervista AD "${lead.company_name}" sfide mercato obiettivi`
                    ];
                } else if (config.type === 'risks') {
                    // RISKS (Aggressive): Problems, Reviews, Controversies
                    queries = [
                        `"${lead.company_name}" problemi criticità recensioni negative`,
                        `"${lead.company_name}" scandali cause legali ristrutturazione`
                    ];
                } else {
                    // GENERIC: General Info and Business Model
                    queries = [
                        `"${lead.company_name}" chi siamo servizi prodotti`,
                        `"${lead.company_name}" business model clienti target`
                    ];
                }

                // Apply Advanced Settings (Keywords & Blacklist)
                const suffix = [
                    ...(config.focus_keywords || []),
                    ...(config.excluded_domains || []).map((d: string) => `-site:${d}`)
                ].join(" ");

                if (suffix) {
                    queries = queries.map(q => `${q} ${suffix}`);
                }

                // Determine result count (Depth: Normal=3, Deep=6)
                const resultCount = config.search_depth === 'deep' ? 6 : 3;
                const configType = config?.type || 'generic';

                // Execute all queries in parallel
                console.log('Executing Search Queries:', queries);
                const searchPromises = queries.map(q =>
                    fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${resultCount}&search_lang=it&country=it`, {
                        headers: {
                            'Accept': 'application/json',
                            'Accept-Encoding': 'gzip',
                            'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY!
                        },
                        cache: 'no-store'
                    }).then(async res => {
                        if (res.ok) {
                            return res.json();
                        }
                        console.error('Brave API Error:', res.status, await res.text());
                        return null;
                    })
                );

                const searchResults = await Promise.all(searchPromises);

                // LOG USAGE (Internal Tracking)
                if (queries.length > 0) {
                    await supabase.from('api_usage_logs').insert({
                        provider: 'brave',
                        requests_count: queries.length,
                        details: { campaign_id: campaignId, lead_id: lead.id }
                    }).then(({ error }) => {
                        if (error) console.error('Failed to log usage:', error);
                    });
                }

                // Aggregate and Deduplicate Results
                const allResults: any[] = [];
                const seenUrls = new Set();

                searchResults.forEach(data => {
                    if (data?.web?.results) {
                        data.web.results.forEach((r: any) => {
                            if (!seenUrls.has(r.url)) {
                                seenUrls.add(r.url);
                                allResults.push({
                                    title: r.title,
                                    description: r.description,
                                    url: r.url,
                                    age: r.age
                                });
                            }
                        });
                    }
                });

                // Take top unique results (Double for Deep Search)
                const limit = config.search_depth === 'deep' ? 10 : 5;
                const validResults = allResults.slice(0, limit);

                // 3b. Summarize with OpenAI
                let enrichmentData: any = {
                    summary: "Nessun dato trovato",
                    recent_news: [],
                    pain_points: [],
                    type: configType
                };

                if (validResults.length > 0) {
                    const content = validResults.map((r: any) => `- ${r.title}: ${r.description} (${r.age || 'nd'})`).join('\n');

                    let systemPrompt = "Sei un Ricercatore B2B esperto. Estrai insight chiave. RISPONDI SEMPRE E SOLO IN ITALIANO.";
                    let userInstructions = "";

                    if (configType === 'news') {
                        systemPrompt = "Sei un Analista di Business News. Cerca eventi recenti, investimenti e novità. OUTPUT MUST BE IN ITALIAN.";
                        userInstructions = "Elenca le 3 notizie PIÙ RILEVANTI. Rispondi in ITALIANO. Return JSON: { recent_news: [string], summary: string }.";
                    } else if (configType === 'pain_points') {
                        systemPrompt = "Sei un Consulente Strategico. Deduci sfide strategiche e obiettivi di crescita. OUTPUT MUST BE IN ITALIAN.";
                        userInstructions = "Identifica 3 sfide o obiettivi strategici. Rispondi in ITALIANO. Return JSON: { pain_points: [string], summary: string }.";
                    } else if (configType === 'risks') {
                        systemPrompt = "Sei un Risk Manager. Cerca problemi, criticità o segnali di allarme. OUTPUT MUST BE IN ITALIAN.";
                        userInstructions = "Identifica 3 criticità o rischi potenziali. Rispondi in ITALIANO. Return JSON: { pain_points: [string], summary: string }.";
                    } else {
                        userInstructions = "Riassumi attività e business model. Rispondi in ITALIANO. Return JSON: { summary: string, recent_news: [string], pain_points: [string] }.";
                    }

                    const completion = await openai.chat.completions.create({
                        model: "gpt-3.5-turbo-0125", // Fast & Cheap for summarization
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: `Search Results for ${lead.company_name}:\n${content}\n\n${userInstructions} Ensure valid JSON output and ITALIAN language.` }
                        ],
                        response_format: { type: "json_object" }
                    });

                    const text = completion.choices[0].message.content;
                    if (text) {
                        try {
                            enrichmentData = { ...enrichmentData, ...JSON.parse(text) };
                        } catch (e) {
                            console.error("JSON Parse Error", e);
                            enrichmentData.summary = text; // Fallback
                        }
                    }
                }

                // Update Lead
                await supabase
                    .from('leads')
                    .update({
                        status: 'researched',
                        enrichment_data: {
                            ...enrichmentData,
                            search_results: validResults,
                            last_enriched: new Date().toISOString()
                        }
                    })
                    .eq('id', lead.id);

                stats.success++;

                // Add small delay to be nice to API
                await new Promise(r => setTimeout(r, 500));

            } catch (err) {
                console.error(`Error enriching lead ${lead.id}:`, err);
                stats.failed++;
            }
        }

        return NextResponse.json({
            message: 'Enrichment batch complete',
            count: stats.success,
            failed: stats.failed,
            debug: { processed: leads.length }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
