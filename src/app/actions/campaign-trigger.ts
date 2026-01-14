'use server';

export async function triggerCampaignImmediate(campaignId?: string) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const secret = process.env.CRON_SECRET;

    if (!secret) {
        console.error("Server Action Error: CRON_SECRET missing");
        return { success: false, error: "Configuration Error: CRON_SECRET missing on server" };
    }

    try {
        const scheduleUrl = `${baseUrl}/api/cron/schedule?force=true`;
        console.log(`Triggering Schedule: ${scheduleUrl}`);

        // 1. Schedule
        const scheduleRes = await fetch(scheduleUrl, {
            headers: { 'x-cron-secret': secret },
            cache: 'no-store'
        });

        let scheduleData: any = {};
        try { scheduleData = await scheduleRes.json(); } catch (e) { }

        if (!scheduleRes.ok) {
            console.error("Scheduler Error:", scheduleData);
            return { success: false, error: `Scheduler failed: ${scheduleRes.status}` };
        }

        // 2. Send
        let sendUrl = `${baseUrl}/api/cron/send?force=true`;
        if (campaignId) sendUrl += `&campaign_id=${campaignId}`;

        console.log(`Triggering Send: ${sendUrl}`);

        const sendRes = await fetch(sendUrl, {
            headers: { 'x-cron-secret': secret },
            cache: 'no-store'
        });

        let sendData: any = {};
        try { sendData = await sendRes.json(); } catch (e) { }

        // Map response fields safely
        return {
            success: true,
            scheduled: scheduleData.generated_count || scheduleData.scheduled || 0,
            sent: sendData.sent_count || sendData.sent || 0,
            skipped: sendData.skipped || []
        };

    } catch (error: any) {
        console.error("Server Action Error:", error);
        return { success: false, error: error.message };
    }
}
