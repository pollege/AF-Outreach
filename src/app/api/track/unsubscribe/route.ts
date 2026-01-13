import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lid = searchParams.get('lid');

    if (!lid) {
        return new NextResponse('Invalid Unsubscribe Link', { status: 400 });
    }

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseServiceKey) {
            console.error('CRITICAL: SUPABASE_SERVICE_KEY is missing. Unsubscribe will fail.');
            return new NextResponse('Configuration Error', { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch lead to get email
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('email, id')
            .eq('id', lid)
            .single();

        if (fetchError || !lead) {
            return new NextResponse('Lead not found or already unsubscribed', { status: 404 });
        }

        // 2. Update Lead Status
        await supabase
            .from('leads')
            .update({ status: 'unsubscribed' })
            .eq('id', lid);

        // 3. Add to Unsubscribe List (Global Blacklist)
        // Check if already exists to avoid unique constraint error spam
        const { error: insertErr } = await supabase
            .from('unsubscribe_list')
            .upsert({ email: lead.email }, { onConflict: 'email' });

        if (insertErr) console.log('Error adding to global unsubscribe:', insertErr);

        // 4. Return HTML Page
        const html = `
            <!DOCTYPE html>
            <html lang="it">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Disiscrizione Confermata</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background-color: #f8fafc;
                        color: #334155;
                    }
                    .container {
                        text-align: center;
                        background: white;
                        padding: 2rem;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        max-width: 400px;
                    }
                    h1 { color: #0f172a; margin-bottom: 0.5rem; font-size: 1.5rem; }
                    p { color: #64748b; line-height: 1.5; }
                    .icon { font-size: 3rem; margin-bottom: 1rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">✅</div>
                    <h1>Disiscrizione Confermata</h1>
                    <p>L'indirizzo <strong>${lead.email}</strong> è stato rimosso dalla nostra lista.</p>
                    <p>Non riceverai più comunicazioni da parte nostra.</p>
                </div>
            </body>
            </html>
        `;

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' },
        });

    } catch (error) {
        console.error('Unsubscribe Error:', error);
        return new NextResponse('Server Error', { status: 500 });
    }
}
