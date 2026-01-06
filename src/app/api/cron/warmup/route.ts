
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
    try {
        // 1. Fetch active accounts
        const { data: accounts, error } = await supabase
            .from('mail_accounts')
            .select('id, email, daily_limit, created_at')
            .eq('status', 'active');

        if (error) throw error;
        if (!accounts || accounts.length === 0) {
            return NextResponse.json({ message: 'No active accounts found' });
        }

        const updates = [];
        const logs = [];

        // 2. Iterate and Check Warm-up Schedule
        for (const account of accounts) {
            const createdAt = new Date(account.created_at);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - createdAt.getTime());
            const daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let targetLimit = 10;

            // Warm-up Schedule
            if (daysActive <= 3) {
                targetLimit = 10;
            } else if (daysActive <= 7) {
                targetLimit = 20;
            } else if (daysActive <= 14) {
                targetLimit = 35;
            } else {
                targetLimit = 50;
            }

            // 3. Update Rule: Only Upgrade (Never Downgrade manual settings)
            // If the current limit is LOWER than what it should be, bump it up.
            // If the user manually set it to 100 (pre-warmed), we keep it at 100 (100 is not < 50).
            if (account.daily_limit < targetLimit) {
                updates.push(
                    supabase
                        .from('mail_accounts')
                        .update({ daily_limit: targetLimit })
                        .eq('id', account.id)
                );
                logs.push(`Upgrading ${account.email} (Day ${daysActive}) from ${account.daily_limit} to ${targetLimit}`);
            }
        }

        // 4. Execute Updates
        if (updates.length > 0) {
            await Promise.all(updates);
        }

        return NextResponse.json({
            success: true,
            processed: accounts.length,
            updated_count: updates.length,
            updates: logs
        });

    } catch (error: any) {
        console.error('Warmup Cron Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
