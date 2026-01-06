-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
CREATE TYPE automation_mode AS ENUM ('review', 'auto');
CREATE TYPE lead_status AS ENUM ('new', 'researched', 'message_generated', 'queued', 'sent', 'opened', 'replied', 'qualified', 'bounced', 'unsubscribed');
CREATE TYPE lead_classification AS ENUM ('hot', 'warm', 'cold', 'not_interested');
CREATE TYPE message_type AS ENUM ('initial', 'follow_up_1', 'follow_up_2', 'break_up', 'inbound');
CREATE TYPE message_status AS ENUM ('draft', 'queued', 'sending', 'sent', 'opened', 'clicked', 'replied', 'failed', 'bounced', 'cancelled');
CREATE TYPE email_provider AS ENUM ('gmail', 'sendgrid', 'resend', 'ses', 'smtp');

-- 2. TABLES

-- mail_accounts (New Phase 5)
CREATE TABLE mail_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    from_name TEXT,
    
    -- SMTP (Sending)
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_pass TEXT, -- Encryption handled app-side or via RLS if needed
    smtp_secure BOOLEAN DEFAULT true,
    
    -- IMAP (Receiving)
    imap_host TEXT,
    imap_port INTEGER,
    imap_user TEXT,
    imap_pass TEXT,
    
    -- Limits & Status
    daily_limit INTEGER DEFAULT 50,
    daily_sent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, disconnected, error
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- unsubscribe_list
CREATE TABLE unsubscribe_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    reason TEXT,
    feedback TEXT,
    unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- email_settings
CREATE TABLE email_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider email_provider DEFAULT 'resend',
    from_email TEXT,
    from_name TEXT,
    reply_to_email TEXT,
    signature TEXT,
    hourly_limit INTEGER DEFAULT 50,
    daily_limit INTEGER DEFAULT 200,
    delay_between_sends INTEGER DEFAULT 30, -- seconds
    tracking_enabled BOOLEAN DEFAULT true,
    n8n_webhook_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    email_template JSONB, -- {subject_template, body_template, tone, max_length}
    automation_mode automation_mode DEFAULT 'review',
    follow_up_sequence JSONB DEFAULT '[]'::JSONB, -- [{delay_days: 4, type: "follow_up_1"}]
    sending_limits JSONB, -- {hourly, daily, daily_limit, hourly_limit, start_time, end_time}
    sender_account_id UUID REFERENCES mail_accounts(id), -- NULL = Auto/Rotation, Value = Specific Account
    tracking_enabled BOOLEAN DEFAULT true,
    enrichment_enabled BOOLEAN DEFAULT false, -- Enable AI Web Search Enrichment
    enrichment_config JSONB DEFAULT '{"type": "generic"}'::JSONB, -- {type: "generic"|"news"|"pain_points", custom_query: ""}
    status campaign_status DEFAULT 'draft',
    stats JSONB DEFAULT '{"sent": 0, "opened": 0, "clicked": 0, "replied": 0, "qualified": 0, "bounced": 0, "unsubscribed": 0}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- import_batches
CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    filename TEXT,
    total_rows INTEGER DEFAULT 0,
    imported_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'::JSONB,
    source TEXT DEFAULT 'csv',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- leads
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    -- Basic CSV fields
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT NOT NULL, -- Validation will be largely app-side or via unique index scope
    company_name TEXT NOT NULL,
    job_title TEXT,
    linkedin_url TEXT,
    company_website TEXT,
    phone TEXT,
    location TEXT,
    company_size TEXT,
    industry TEXT,
    
    -- Enrichment & AI
    enrichment_data JSONB DEFAULT '{}'::JSONB, -- {recent_news, pain_points, etc}
    
    -- Status & Scoring
    status lead_status DEFAULT 'new',
    lead_score INTEGER DEFAULT 0,
    classification lead_classification,
    
    -- Tracking / Meta
    blacklisted BOOLEAN DEFAULT false,
    email_valid BOOLEAN DEFAULT true,
    import_source TEXT DEFAULT 'csv',
    import_batch_id UUID REFERENCES import_batches(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_contacted_at TIMESTAMPTZ,
    last_interaction_at TIMESTAMPTZ,

    -- Multi-step Sequence Tracking
    outreach_step INTEGER DEFAULT 0, -- 0 = Initial, 1 = Follow-up 1, etc.
    next_action_at TIMESTAMPTZ DEFAULT NOW() -- When the next step should trigger
);

-- leads unique constraint: email per campaign or global? 
-- Spec says "email unique", usually means global or per campaign. Assuming per campaign for flexibility, or global? 
-- Let's make it UNIQUE(email, campaign_id) to allow same lead in different campaigns.
CREATE UNIQUE INDEX leads_email_campaign_idx ON leads(email, campaign_id);

-- messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    type message_type NOT NULL,
    
    subject TEXT,
    body TEXT,
    body_final TEXT, -- with footer/tracking
    personalization_used JSONB,
    
    status message_status DEFAULT 'draft',
    needs_review BOOLEAN DEFAULT false,
    
    unsubscribe_token TEXT,
    tracking_pixel_id TEXT,
    provider_message_id TEXT,
    
    scheduled_for TIMESTAMPTZ,
    parent_message_id UUID REFERENCES messages(id),
    
    reply_content TEXT,
    reply_classification lead_classification,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ
);

-- activity_log
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX idx_leads_campaign_status ON leads(campaign_id, status);
CREATE INDEX idx_messages_status_queue ON messages(status, scheduled_for);
CREATE INDEX idx_messages_campaign ON messages(campaign_id);

-- 4. RLS POLICIES (Simple version: Public/Anon can do everything for MVP, or Authenticated)
-- Ideally: ALTER TABLE x ENABLE ROW LEVEL SECURITY;
-- For this MVP/Dev phase, we will leave RLS disabled or create a policy that allows all authenticated users.
-- Let's enable RLS but allow everything for authenticated users.

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON campaigns FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON leads FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON messages FOR ALL TO authenticated USING (true);

-- Also allow public access for unsubscribe/tracking just in case (though tracking usually via API routes)
-- We will handle tracking via Server-side API, so database direct access from outside not needed.
