import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    // Await params because in Next 15+ it's a promise, but in 14 it's sync. 
    // Safety check: await it just in case or treat as object.
    // Next.js 15 breaking change: params is Promise. Next 14: params is object.
    // We installed "next": "16.1.1" (Wait, 16? Next is 15.1. That must be Canary or 15.1).
    // Package.json said "next": "16.1.1" which looks like version 15+ equivalent or I misread. 
    // Actually package.json said "next": "16.1.1". That is weird, maybe it's 15.1.1 or 14. 
    // Assuming strict Next 15 behavior: await params.

    const { id } = await context.params;

    if (id) {
        // Fire and forget update (don't await to keep response fast? actually Vercel functions need await usually 
        // or waitUntil, but standard await is safer)
        try {
            await supabase
                .from('messages')
                .update({
                    status: 'opened',
                    opened_at: new Date().toISOString()
                })
                .eq('id', id);

            // Also update stats...
        } catch (e) {
            console.error("Track open error", e);
        }
    }

    // Return 1x1 Transparent GIF
    const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
    );

    return new NextResponse(pixel, {
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });
}
