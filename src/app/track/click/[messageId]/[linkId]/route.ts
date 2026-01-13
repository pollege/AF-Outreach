import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, context: { params: Promise<{ messageId: string, linkId: string }> }) {
    const { messageId, linkId } = await context.params;
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url'); // Securely pass URL or look it up by linkId from DB

    if (messageId) {
        try {
            await supabase
                .from('messages')
                .update({
                    status: 'clicked',
                    clicked_at: new Date().toISOString()
                })
                .eq('id', messageId);
        } catch (e) {
            console.error("Track click error", e);
        }
    }

    if (targetUrl) {
        return NextResponse.redirect(targetUrl);
    }

    // Fallback if no URL
    return NextResponse.redirect(new URL('/', request.url));
}
