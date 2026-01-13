import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Missing messages array' }, { status: 400 });
        }

        // Prepare the text to summarize
        const threadText = messages.map(msg => {
            const role = msg.type === 'inbound' ? (msg.from_name || 'Lead') : 'Me';
            // Simple cleanup of HTML tags for token efficiency
            const text = msg.body?.replace(/<[^>]*>/g, ' ').substring(0, 500) || '';
            return `${role}: ${text}`;
        }).join('\n---\n');

        const systemPrompt = `You are a helpful assistant for a busy sales professional.
        Goal: Summarize the following email thread in 2-3 concise sentences (Italian).
        Focus on: What does the lead want? What is the next step? Status of negotiation.
        Do not start with "Here is the summary". just give the summary directly.`;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Here is the conversation:\n\n${threadText}` }
            ],
            model: "gpt-4o-mini", // User requested GPT-4o-mini
        });

        const summary = completion.choices[0].message.content;

        return NextResponse.json({ summary });

    } catch (e: any) {
        console.error("Summarize Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
