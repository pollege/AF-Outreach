'use server';

export async function triggerCampaignImmediate() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const secret = process.env.CRON_SECRET;

    if (!secret) {
        console.error("Server Action Error: CRON_SECRET missing");
        return { success: false, error: "Configuration Error: CRON_SECRET missing on server" };
    }

    try {
        console.log("Triggering Cron via Server Action...");

        // 1. Schedule
        const scheduleRes = await fetch(`${baseUrl}/api/cron/schedule?force=true`, {
            headers: { 'x-cron-secret': secret },
            cache: 'no-store'
        });

        let scheduleData = {};
        try { scheduleData = await scheduleRes.json(); } catch (e) { }

        if (!scheduleRes.ok) {
            console.error("Scheduler Error:", scheduleData);
            return { success: false, error: `Scheduler failed: ${scheduleRes.status}` };
        }

        // 2. Send
        const sendRes = await fetch(`${baseUrl}/api/cron/send?force=true`, {
            headers: { 'x-cron-secret': secret },
            cache: 'no-store'
        });

        let sendData: any = {};
        try { sendData = await sendRes.json(); } catch (e) { }

        return {
            success: true,
            scheduled: (scheduleData as any).scheduled || 0,
            sent: (sendData as any).sent || 0
        };

    } catch (error: any) {
        console.error("Server Action Error:", error);
        return { success: false, error: error.message };
    }
}
