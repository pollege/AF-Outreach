import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { leadId, status } = await req.json();

        if (!leadId || !status) {
            return NextResponse.json({ error: 'Missing leadId or status' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const updates: any = {};
        if (status === 'read') {
            updates.last_read_at = new Date().toISOString();
        } else if (status === 'unread') {
            updates.last_read_at = null; // Or a very old date
        }

        const { error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', leadId);

        if (error) {
            console.error("Error updating lead status:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
