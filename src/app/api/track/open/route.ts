import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mid = searchParams.get('mid');

    // 1x1 Transparent GIF
    const TRANSPARENT_GIF = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
    );

    const responseHeaders = {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    };

    if (!mid) {
        return new NextResponse(TRANSPARENT_GIF, { headers: responseHeaders });
    }

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        // Normalize to standard Env Var name or fallback
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseServiceKey) {
            console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing. Tracking will fail.');
            return new NextResponse(TRANSPARENT_GIF, { headers: responseHeaders });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Check if message exists and get Lead ID
        const { data: message } = await supabase
            .from('messages')
            .select('lead_id, status')
            .eq('id', mid)
            .single();

        if (message) {
            // 2. Update Message Status to 'opened'
            // Only if not already opened (preserve first open time)
            if (message.status !== 'opened') {
                await supabase
                    .from('messages')
                    .update({
                        status: 'opened',
                        opened_at: new Date().toISOString()
                    })
                    .eq('id', mid);

                // 3. Update Lead Status to 'opened'
                // This allows the UI to reflect the engagement level
                if (message.lead_id) {
                    await supabase
                        .from('leads')
                        .update({ status: 'opened' })
                        .eq('id', message.lead_id);
                }
            }
        }

    } catch (error) {
        console.error('Tracking Error:', error);
    }

    return new NextResponse(TRANSPARENT_GIF, { headers: responseHeaders });
}
