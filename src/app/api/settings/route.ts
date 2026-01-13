import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { data, error } = await supabase.from('email_settings').select('*').single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "Row not found" which is fine initially

        return NextResponse.json(data || {});
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { n8n_webhook_url } = body;

        // Validation could be added here

        // Useupsert to create if not exists (assuming single row config table usually has id=1 or similar, 
        // but Supabase might rely on a specific constraint. For safety, let's fetch first or just upsert with a fixed ID if schema allows.
        // Checking schema via inference: usually single-row tables have a constraint. 
        // Let's assume we can just upsert. Ideally we should know the primary key.
        // If the table is empty, we insert. If not, we update the existing one.

        const { data: existing } = await supabase.from('email_settings').select('id').single();

        let result;
        if (existing) {
            result = await supabase.from('email_settings').update({ n8n_webhook_url, updated_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
            result = await supabase.from('email_settings').insert([{ n8n_webhook_url }]);
        }

        if (result.error) throw result.error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
