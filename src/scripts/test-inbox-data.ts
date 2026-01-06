
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedInbox() {
    console.log("Seeding Inbox with test data...");

    // 1. Get or Create a Lead
    let leadId;
    const { data: leads } = await supabase.from('leads').select('id').limit(1);

    if (leads && leads.length > 0) {
        leadId = leads[0].id;
        console.log("Using existing lead:", leadId);
    } else {
        console.log("Creating new lead...");
        const { data: newLead, error } = await supabase.from('leads').insert({
            email: 'test.reply@example.com',
            first_name: 'Mario',
            last_name: 'Rossi',
            company_name: 'Test Corp',
            status: 'replied'
        }).select().single();
        if (error) throw error;
        leadId = newLead.id;
    }

    // 2. Update status to replied
    await supabase.from('leads').update({ status: 'replied', updated_at: new Date().toISOString() }).eq('id', leadId);

    // 3. Create mock messages
    const { error: msgError } = await supabase.from('messages').insert([
        {
            lead_id: leadId,
            type: 'initial',
            body: '<p>Ciao Mario, come va?</p>',
            status: 'sent',
            subject: 'Collaborazione?',
            created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        },
        {
            lead_id: leadId,
            type: 'inbound',
            body: '<p>Ciao Alex, interessante. Parliamone.</p>',
            status: 'replied',
            created_at: new Date().toISOString() // Now
        }
    ]);

    if (msgError) console.error("Error creating messages:", msgError);
    else console.log("Test messages created successfully!");
}

seedInbox();
