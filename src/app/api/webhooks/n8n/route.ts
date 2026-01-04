import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message_id, status, provider_message_id } = body;

        if (!message_id || !status) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Update message status based on n8n callback
        const { error } = await supabase
            .from('messages')
            .update({
                status: status, // 'sent', 'failed', 'bounced'
                provider_message_id: provider_message_id,
                // If sent, maybe update 'sent_at' again or leave as is
            })
            .eq('id', message_id);

        if (error) throw error;

        // Also update campaign stats if needed (increment sent count)
        // For now, minimal implementation.

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
