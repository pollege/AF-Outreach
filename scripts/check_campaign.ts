
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching campaign 'tessst2'...");

    // 1. Fetch Campaign
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('name', 'tessst2');
    const campaign = campaigns?.[0];

    if (!campaign) {
        console.log("No campaign found.");
        return;
    }

    console.log("Campaign ID:", campaign.id);
    console.log("Template:", JSON.stringify(campaign.email_template, null, 2));

    // 2. Fetch Messages
    console.log("\nFetching messages...");
    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*') // Select all to see column names if needed, or just specific ones
        .eq('campaign_id', campaign.id);

    if (msgError) {
        console.error("Error:", msgError);
    } else {
        console.log(`Found ${messages.length} messages.`);
        messages.forEach((msg, idx) => {
            console.log(`\n[${idx + 1}] Lead: ${msg.lead_id}`);
            console.log(`    Status: ${msg.status}`);
            console.log(`    Subject: ${msg.subject}`);
            console.log(`    Body: ${msg.body?.substring(0, 30)}...`);
            // Check for error info
            console.log(`    Error: ${JSON.stringify(msg.error_details || msg.error || "None")}`);
        });
    }
}

main();
