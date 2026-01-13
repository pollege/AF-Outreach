import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { leadId, tags } = await req.json();

        if (!leadId || !Array.isArray(tags)) {
            return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
            .from('leads')
            .update({ tags })
            .eq('id', leadId);

        if (error) {
            console.error("Error updating tags:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, tags });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
