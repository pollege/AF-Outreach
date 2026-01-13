import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { differenceInDays, parseISO } from 'date-fns';

// Helper to determine recommended limit based on age
// Matches logic in MailAccountsTab.tsx
const getWarmupLimit = (daysActive: number) => {
    if (daysActive <= 3) return 10;
    if (daysActive <= 7) return 20;
    if (daysActive <= 14) return 35;
    if (daysActive <= 21) return 50;
    return 100; // Full throttle after 3 weeks
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const secret = req.headers.get('x-cron-secret') || searchParams.get('cron_secret');
        const envSecret = process.env.CRON_SECRET;

        // Security Check
        if (envSecret && secret !== envSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log("Starting Daily Stats Reset & Auto-Warmup...");

        // 1. Reset Counters
        // We use the RPC if available for atomic reset, or raw update.
        // The migration added `reset_daily_stats`. Let's try RPC first.
        const { error: rpcError } = await supabase.rpc('reset_daily_stats');

        if (rpcError) {
            console.warn("RPC reset_daily_stats failed or missing, falling back to direct update:", rpcError.message);
            // Fallback: Manual Update
            const { error: updateError } = await supabase
                .from('mail_accounts')
                .update({ daily_sent: 0, last_reset_at: new Date().toISOString() })
                .neq('daily_sent', -1); // Dummy filter to update all rows

            if (updateError) throw updateError;
        }

        // 2. Auto-Warmup Logic (Scale Up Limits)
        // Fetch all active accounts
        const { data: accounts, error: fetchError } = await supabase
            .from('mail_accounts')
            .select('*')
            .eq('status', 'active');

        if (fetchError) throw fetchError;

        const updates = [];
        const now = new Date();

        if (accounts) {
            for (const acc of accounts) {
                // Calculate Start Date
                const createdAt = acc.created_at ? parseISO(acc.created_at) : now;
                const daysActive = differenceInDays(now, createdAt);

                // Calculate Recommended Limit
                const recommended = getWarmupLimit(daysActive);

                // Logic: If current limit is LOWER than recommended, we bump it up.
                // We do NOT lower it if user manually set it higher (expert mode).
                if (acc.daily_limit < recommended) {
                    updates.push({
                        id: acc.id,
                        email: acc.email,
                        old_limit: acc.daily_limit,
                        new_limit: recommended
                    });

                    // Perform Update
                    await supabase
                        .from('mail_accounts')
                        .update({ daily_limit: recommended })
                        .eq('id', acc.id);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Daily stats reset completed.',
            auto_warmup_updates: updates.length,
            details: updates
        });

    } catch (error: any) {
        console.error("Cron Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
