-- Session 4: Life Layer Tables
-- Run in Supabase SQL Editor

-- Travel trips
CREATE TABLE IF NOT EXISTS trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    destination VARCHAR(255) NOT NULL,
    destination_lat FLOAT,
    destination_lon FLOAT,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    trip_type VARCHAR(50),
    travel_companions VARCHAR(100),
    status VARCHAR(50) DEFAULT 'upcoming',
    prep_done BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip daily logs
CREATE TABLE IF NOT EXISTS trip_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    workout_done BOOLEAN DEFAULT false,
    workout_notes TEXT,
    nutrition_quality INTEGER CHECK (nutrition_quality BETWEEN 1 AND 5),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
    mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
    highlights TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, log_date)
);

-- Social circle
CREATE TABLE IF NOT EXISTS social_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(100),
    importance_weight INTEGER DEFAULT 5 CHECK (importance_weight BETWEEN 1 AND 10),
    target_contact_days INTEGER DEFAULT 14,
    last_contact_date DATE,
    preferred_activities TEXT[],
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social connection log
CREATE TABLE IF NOT EXISTS social_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES social_contacts(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    activity_type VARCHAR(100),
    duration_minutes INTEGER,
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial context (single row, upsert)
CREATE TABLE IF NOT EXISTS financial_context (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    monthly_lifestyle_budget FLOAT,
    city_tier VARCHAR(50),
    socioeconomic_tier VARCHAR(50),
    home_cook_ratio FLOAT,
    gym_has_membership BOOLEAN,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions & memberships
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    monthly_cost FLOAT,
    billing_cycle VARCHAR(50) DEFAULT 'monthly',
    last_used_date DATE,
    usage_frequency VARCHAR(50),
    keeps_value BOOLEAN DEFAULT true,
    cancellation_suggested BOOLEAN DEFAULT false,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Growth habits (1% Growth Engine)
CREATE TABLE IF NOT EXISTS growth_habits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    target_frequency VARCHAR(50),
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    micro_win_message TEXT,
    active BOOLEAN DEFAULT true,
    started_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Growth habit log
CREATE TABLE IF NOT EXISTS growth_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    habit_id UUID REFERENCES growth_habits(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    completed BOOLEAN DEFAULT false,
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(habit_id, log_date)
);

-- Career profile & goals
CREATE TABLE IF NOT EXISTS career_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_title VARCHAR(255),
    industry VARCHAR(255),
    years_experience INTEGER,
    career_goals TEXT[],
    skills_to_develop TEXT[],
    skills_strong TEXT[],
    work_style VARCHAR(100),
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 10),
    next_milestone TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Career weekly reflections
CREATE TABLE IF NOT EXISTS career_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    wins TEXT[],
    challenges TEXT[],
    learning TEXT,
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
    productivity_score INTEGER CHECK (productivity_score BETWEEN 1 AND 10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wardrobe items
CREATE TABLE IF NOT EXISTS wardrobe (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    color VARCHAR(100),
    occasion TEXT[],
    season TEXT[],
    brand VARCHAR(100),
    times_worn INTEGER DEFAULT 0,
    last_worn_date DATE,
    condition VARCHAR(50) DEFAULT 'good',
    image_url TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outfit logs
CREATE TABLE IF NOT EXISTS outfit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    log_date DATE NOT NULL,
    occasion VARCHAR(100),
    wardrobe_item_ids UUID[],
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice session logs
CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_date DATE NOT NULL,
    session_type VARCHAR(100),
    transcript TEXT,
    response_text TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    device_platform VARCHAR(50),
    active BOOLEAN DEFAULT true,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);
