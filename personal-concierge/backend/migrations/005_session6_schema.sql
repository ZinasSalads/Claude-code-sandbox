-- Session 6 Schema Migration
-- Skincare, Relationships, Digital Identity, Financial Planning,
-- Hobbies, Contextual Intelligence, Conversation, Reviews

-- Skincare products
CREATE TABLE IF NOT EXISTS skincare_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    routine_slot VARCHAR(50),
    application_order INTEGER,
    active_ingredients TEXT[],
    spf_value INTEGER,
    skin_concerns TEXT[],
    active BOOLEAN DEFAULT true,
    times_used INTEGER DEFAULT 0,
    last_used_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skincare ingredient conflicts
CREATE TABLE IF NOT EXISTS skincare_conflicts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_a VARCHAR(100) NOT NULL,
    ingredient_b VARCHAR(100) NOT NULL,
    conflict_type VARCHAR(50),
    explanation TEXT,
    safe_alternative TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skin check-in log
CREATE TABLE IF NOT EXISTS skin_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    log_date DATE NOT NULL,
    overall_condition INTEGER CHECK (overall_condition BETWEEN 1 AND 10),
    breakouts INTEGER DEFAULT 0,
    breakout_location TEXT[],
    redness BOOLEAN DEFAULT false,
    dryness BOOLEAN DEFAULT false,
    oiliness BOOLEAN DEFAULT false,
    dark_circles BOOLEAN DEFAULT false,
    puffiness BOOLEAN DEFAULT false,
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(log_date)
);

-- Skin profile
CREATE TABLE IF NOT EXISTS skin_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    skin_type VARCHAR(50),
    primary_concerns TEXT[],
    known_sensitivities TEXT[],
    spf_habit VARCHAR(50),
    fitzpatrick_type INTEGER,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships
CREATE TABLE IF NOT EXISTS relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES social_contacts(id) ON DELETE CASCADE,
    relationship_depth VARCHAR(50),
    positive_interaction_ratio FLOAT,
    conflict_resolution_style VARCHAR(50),
    shared_interests TEXT[],
    growth_together BOOLEAN DEFAULT true,
    support_given INTEGER DEFAULT 5 CHECK (support_given BETWEEN 1 AND 10),
    support_received INTEGER DEFAULT 5 CHECK (support_received BETWEEN 1 AND 10),
    last_deep_conversation DATE,
    health_score INTEGER,
    health_trend VARCHAR(20),
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationship check-ins
CREATE TABLE IF NOT EXISTS relationship_checkins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES social_contacts(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    interaction_quality INTEGER CHECK (interaction_quality BETWEEN 1 AND 10),
    interaction_type VARCHAR(100),
    energy_after VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Digital identity profile
CREATE TABLE IF NOT EXISTS digital_identity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    linkedin_url TEXT,
    linkedin_last_audited DATE,
    personal_brand_statement TEXT,
    professional_narrative TEXT,
    platforms_active TEXT[],
    content_style VARCHAR(50),
    thought_leadership_goal BOOLEAN DEFAULT false,
    last_google_check DATE,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Digital identity audit log
CREATE TABLE IF NOT EXISTS digital_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_date DATE NOT NULL,
    platform VARCHAR(100),
    findings TEXT[],
    recommendations TEXT[],
    priority VARCHAR(20),
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial goals
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    goal_name VARCHAR(255) NOT NULL,
    goal_type VARCHAR(100),
    target_amount FLOAT,
    current_amount FLOAT DEFAULT 0,
    monthly_contribution FLOAT,
    target_date DATE,
    linked_life_goal TEXT,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial stress log
CREATE TABLE IF NOT EXISTS financial_stress_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
    primary_stressor TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hobbies
CREATE TABLE IF NOT EXISTS hobbies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    seasonal BOOLEAN DEFAULT false,
    active_months INTEGER[],
    weekly_hours_target FLOAT,
    weekly_hours_actual FLOAT DEFAULT 0,
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 10),
    last_session_date DATE,
    streak_weeks INTEGER DEFAULT 0,
    health_benefit TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hobby log
CREATE TABLE IF NOT EXISTS hobby_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hobby_id UUID REFERENCES hobbies(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    duration_minutes INTEGER,
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competing priorities conflict log
CREATE TABLE IF NOT EXISTS priority_conflicts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conflict_date DATE NOT NULL,
    competing_items TEXT[],
    resolution TEXT,
    values_alignment_score INTEGER,
    regret_flag BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contextual intelligence triggers
CREATE TABLE IF NOT EXISTS context_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    signal_date DATE NOT NULL,
    signal_type VARCHAR(100),
    signal_text TEXT NOT NULL,
    expanded_implications JSONB,
    modules_notified TEXT[],
    acted_on BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation history
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    context_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly reviews
CREATE TABLE IF NOT EXISTS weekly_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    avg_readiness FLOAT,
    avg_sleep_score FLOAT,
    avg_hrv FLOAT,
    workouts_completed INTEGER,
    workouts_planned INTEGER,
    social_health_score INTEGER,
    habits_completion_rate FLOAT,
    learning_minutes INTEGER,
    career_satisfaction INTEGER,
    burnout_risk_level VARCHAR(20),
    wins TEXT[],
    struggles TEXT[],
    coach_insight TEXT,
    next_week_focus TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly reviews
CREATE TABLE IF NOT EXISTS monthly_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month_start DATE NOT NULL UNIQUE,
    avg_readiness FLOAT,
    avg_sleep_score FLOAT,
    workouts_completed INTEGER,
    habits_best_streak INTEGER,
    learning_hours FLOAT,
    milestones_logged INTEGER,
    biggest_win TEXT,
    biggest_challenge TEXT,
    legacy_progress TEXT,
    coach_insight TEXT,
    next_month_intention TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);
