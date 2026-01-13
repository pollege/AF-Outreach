import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const leadId = searchParams.get('leadId');

        if (!leadId) {
            return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Delete all messages associated with this lead
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('lead_id', leadId);

        if (error) {
            console.error("Error deleting conversation:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
