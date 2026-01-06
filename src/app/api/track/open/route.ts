
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 1x1 Transparent GIF
const TRANSPARENT_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mid = searchParams.get('mid');

    if (!mid) {
        // Just return the pixel even if invalid params, to not break email clients
        return new NextResponse(TRANSPARENT_GIF, {
            headers: { 'Content-Type': 'image/gif' },
        });
    }

    try {
        // 1. Update Message Status to 'opened'
        // Only if it wasn't opened before update opened_at
        // We can use a smarter SQL update or just simple update

        await supabase
            .from('messages')
            .update({
                status: 'opened',
                opened_at: new Date().toISOString()
            })
            .eq('id', mid)
            .is('opened_at', null); // Only update if not already opened (prevent overwriting first open time)

        // 2. Increment Lead open count (Optional, skipping for now to save query)

    } catch (error) {
        console.error('Tracking Error:', error);
    }

    return new NextResponse(TRANSPARENT_GIF, {
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });
}
