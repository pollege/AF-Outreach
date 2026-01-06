
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabase.rpc('get_monthly_brave_usage');

        if (error) {
            console.error('Error fetching usage:', error);
            // Default to 0 if error/missing functionality
            return NextResponse.json({ usage: 0 });
        }

        return NextResponse.json({ usage: data || 0 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
