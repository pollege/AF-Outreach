import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    // This job runs hourly (or more frequently) to move leads through the funnel
    try {
        console.log('Running Smart Scheduler...');

        // 1. Fetch Active Campaigns with Sequences
        const { data: campaigns } = await supabase
            .from('campaigns')
            .select('*')
            .eq('status', 'active');

        if (!campaigns || campaigns.length === 0) {
            return NextResponse.json({ message: 'No active campaigns found' });
        }

        let scheduledCount = 0;
        const errors = [];

        for (const campaign of campaigns) {
            const sequence = campaign.follow_up_sequence || [];

            // Check sending limits (Simple check)
            // In a real app we would check email_settings.daily_limit vs count of messages sent today

            // --- STEP 0: INITIAL EMAIL ---
            // If lead is 'researched' (meaning enriched & scored), has generic 'initial' step pending (step 0)
            const { data: leadsForInitial } = await supabase
                .from('leads')
                .select('*')
                .eq('campaign_id', campaign.id)
                .eq('status', 'researched') // Ready for initial outreach
                .eq('outreach_step', 0)
                .lte('next_action_at', new Date().toISOString())
                .limit(50); // Batch size

            if (leadsForInitial) {
                for (const lead of leadsForInitial) {
                    // Create Message for Initial Step
                    // Template logic: usually step 0 is the "email_template" column or the first item in sequence if we unify.
                    // For backward compatibility, let's assume 'email_template' is Step 0.

                    const template = campaign.email_template;
                    if (!template) continue;

                    // Personalize
                    const subject = personalize(template.subject, lead);
                    const body = personalize(template.body, lead);

                    const { error } = await supabase.from('messages').insert({
                        lead_id: lead.id,
                        campaign_id: campaign.id,
                        type: 'initial',
                        subject: subject,
                        body: body,
                        status: 'queued', // Ready for n8n to pick up
                        scheduled_for: new Date().toISOString()
                    });

                    if (!error) {
                        // Update Lead: Move to step 1, set next date
                        const nextDelayDays = sequence.length > 0 ? (sequence[0].delay_days || 3) : null;

                        const updates: any = {
                            status: 'queued', // or 'contacted' ? 'queued' matches message status roughly
                            outreach_step: 1
                        };

                        if (nextDelayDays !== null) {
                            const nextDate = new Date();
                            nextDate.setDate(nextDate.getDate() + nextDelayDays);
                            updates.next_action_at = nextDate.toISOString();
                        } else {
                            // No follow ups
                            updates.next_action_at = null;
                        }

                        await supabase.from('leads').update(updates).eq('id', lead.id);
                        scheduledCount++;
                    } else {
                        errors.push(`Failed to schedule initial for lead ${lead.id}: ${error.message}`);
                    }
                }
            }

            // --- STEPS > 0: FOLLOW UPS ---
            // Iterate through defined follow-up steps
            // sequence is array: [{ type: 'follow_up_1', delay_days: 3, subject: '...', body: '...' }]
            // Step 1 means we are waiting to send the FIRST follow-up (index 0 in sequence array)

            for (let i = 0; i < sequence.length; i++) {
                const stepIndex = i + 1; // stored in db as 1, 2, 3...
                const stepConfig = sequence[i]; // config for THIS step

                const { data: leadsForFollowUp } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('campaign_id', campaign.id)
                    .neq('status', 'replied') // Stop if replied!
                    .neq('status', 'unsubscribed')
                    .neq('status', 'bounced')
                    .eq('outreach_step', stepIndex)
                    .lte('next_action_at', new Date().toISOString())
                    .limit(50);

                if (leadsForFollowUp) {
                    for (const lead of leadsForFollowUp) {
                        // Check if last message was replied to? (The status check above covers it mostly, 
                        // but ideally we check if ANY message from this lead has a reply, which updates lead status)

                        const subject = personalize(stepConfig.subject || `Follow up: ${campaign.name}`, lead);
                        const body = personalize(stepConfig.body || "Just checking in...", lead);

                        const { error } = await supabase.from('messages').insert({
                            lead_id: lead.id,
                            campaign_id: campaign.id,
                            type: stepConfig.type || 'follow_up',
                            subject: subject,
                            body: body,
                            status: 'queued',
                            scheduled_for: new Date().toISOString(),
                            parent_message_id: null // Could link to previous message if needed
                        });

                        if (!error) {
                            // Move to next step
                            const nextStepIndex = stepIndex + 1;
                            const nextConfig = sequence[i + 1]; // check if there is a next step

                            const updates: any = {
                                outreach_step: nextStepIndex
                            };

                            if (nextConfig) {
                                const nextDate = new Date();
                                nextDate.setDate(nextDate.getDate() + (nextConfig.delay_days || 3));
                                updates.next_action_at = nextDate.toISOString();
                            } else {
                                updates.next_action_at = null; // End of sequence
                                updates.status = 'completed'; // Optional: mark as done
                            }

                            await supabase.from('leads').update(updates).eq('id', lead.id);
                            scheduledCount++;
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            message: 'Scheduler run complete',
            scheduled: scheduledCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function personalize(text: string, lead: any): string {
    if (!text) return "";
    return text
        .replace(/{first_name}/g, lead.first_name || "")
        .replace(/{last_name}/g, lead.last_name || "")
        .replace(/{company_name}/g, lead.company_name || "")
        .replace(/{company}/g, lead.company_name || ""); // alias
}
