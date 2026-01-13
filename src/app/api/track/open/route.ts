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
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseServiceKey) {
            console.error('CRITICAL: SUPABASE_SERVICE_KEY is missing. Tracking will fail.');
            // Still return gif to not break client
            return new NextResponse(TRANSPARENT_GIF, { headers: responseHeaders });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Update Message Status to 'opened'
        // Using upsert/update with logic to preserve first open time could be added, 
        // but for now we essentially want to mark it as read.
        // We only update if it is NOT already opened to preserve the *first* open time.

        await supabase
            .from('messages')
            .update({
                status: 'opened',
                opened_at: new Date().toISOString()
            })
            .eq('id', mid)
            .is('opened_at', null);

    } catch (error) {
        console.error('Tracking Error:', error);
    }

    return new NextResponse(TRANSPARENT_GIF, { headers: responseHeaders });
}
