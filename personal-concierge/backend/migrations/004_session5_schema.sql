-- Session 5 Migration: Onboarding, Personality, Feedback, Legacy, Home, Learning, Calendar, Privacy
-- Run in Supabase SQL Editor after 003_session4_schema.sql

-- Onboarding progress tracker
CREATE TABLE IF NOT EXISTS onboarding (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    step_name VARCHAR(100) NOT NULL UNIQUE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    skipped BOOLEAN DEFAULT false,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personality & values assessment
CREATE TABLE IF NOT EXISTS personality_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mbti_type VARCHAR(10),
    mbti_dimensions JSONB,
    energy_source VARCHAR(20),
    decision_style VARCHAR(20),
    structure_preference VARCHAR(20),
    stress_response TEXT,
    urban_nature_score FLOAT,
    secular_spiritual_score FLOAT,
    individualist_communal_score FLOAT,
    competitive_collaborative_score FLOAT,
    risk_seeking_score FLOAT,
    style_orientation VARCHAR(50),
    comfort_appearance_balance FLOAT,
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    reassess_due DATE,
    assessment_version INTEGER DEFAULT 1
);

-- Feedback / preference learning
CREATE TABLE IF NOT EXISTS preference_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    item_id VARCHAR(255),
    item_description TEXT,
    rating VARCHAR(20) NOT NULL,
    explicit_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preference pattern summary
CREATE TABLE IF NOT EXISTS preference_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category VARCHAR(100) NOT NULL UNIQUE,
    liked_attributes JSONB,
    disliked_attributes JSONB,
    neutral_attributes JSONB,
    surprise_mode_due DATE,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy & long-term vision
CREATE TABLE IF NOT EXISTS legacy_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ten_year_vision TEXT,
    career_legacy TEXT,
    relationship_legacy TEXT,
    health_legacy TEXT,
    contribution_legacy TEXT,
    identity_goals TEXT[],
    experience_goals TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_reviewed DATE
);

-- Life milestones
CREATE TABLE IF NOT EXISTS life_milestones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    milestone_date DATE NOT NULL,
    category VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    significance INTEGER DEFAULT 5 CHECK (significance BETWEEN 1 AND 10),
    linked_goal TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Values drift log
CREATE TABLE IF NOT EXISTS values_drift_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    stated_priority_1 VARCHAR(100),
    actual_time_split JSONB,
    drift_detected BOOLEAN DEFAULT false,
    drift_description TEXT,
    surfaced_to_user BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Home environment profile
CREATE TABLE IF NOT EXISTS home_environment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    has_air_purifier BOOLEAN DEFAULT false,
    air_purifier_model VARCHAR(100),
    indoor_plants BOOLEAN DEFAULT false,
    natural_light_quality VARCHAR(50),
    has_smart_lights BOOLEAN DEFAULT false,
    morning_light_access BOOLEAN DEFAULT true,
    blue_light_filter_device BOOLEAN DEFAULT false,
    bedroom_blackout BOOLEAN DEFAULT false,
    bedroom_temp_preference VARCHAR(20),
    white_noise_device BOOLEAN DEFAULT false,
    desk_setup_quality VARCHAR(50),
    standing_desk BOOLEAN DEFAULT false,
    monitor_at_eye_level BOOLEAN DEFAULT false,
    ergonomic_chair BOOLEAN DEFAULT false,
    home_type VARCHAR(50),
    square_footage_tier VARCHAR(20),
    noise_level VARCHAR(20),
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Home optimization recommendations
CREATE TABLE IF NOT EXISTS home_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category VARCHAR(100),
    recommendation TEXT NOT NULL,
    priority VARCHAR(20),
    effort VARCHAR(20),
    estimated_impact TEXT,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning profile
CREATE TABLE IF NOT EXISTS learning_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    learning_style VARCHAR(50),
    daily_minutes_target INTEGER DEFAULT 20,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    languages_learning TEXT[],
    language_levels JSONB,
    intellectual_interests TEXT[],
    skill_goals TEXT[],
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books
CREATE TABLE IF NOT EXISTS books (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'want_to_read',
    current_page INTEGER DEFAULT 0,
    total_pages INTEGER,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    key_insights TEXT[],
    started_date DATE,
    completed_date DATE,
    linked_goal TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses & learning resources
CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    provider VARCHAR(100),
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'planned',
    completion_percent INTEGER DEFAULT 0,
    total_hours FLOAT,
    hours_completed FLOAT DEFAULT 0,
    certificate_earned BOOLEAN DEFAULT false,
    linked_goal TEXT,
    started_date DATE,
    target_completion DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning daily log
CREATE TABLE IF NOT EXISTS learning_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    log_date DATE NOT NULL,
    minutes_spent INTEGER,
    activity_type VARCHAR(50),
    resource_id UUID,
    topic VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Google Calendar OAuth tokens
CREATE TABLE IF NOT EXISTS calendar_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    calendar_id VARCHAR(255) DEFAULT 'primary',
    connected BOOLEAN DEFAULT false,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE,
    title VARCHAR(255),
    start_datetime TIMESTAMPTZ,
    end_datetime TIMESTAMPTZ,
    location TEXT,
    description TEXT,
    is_travel BOOLEAN DEFAULT false,
    is_social BOOLEAN DEFAULT false,
    is_formal BOOLEAN DEFAULT false,
    detected_occasion VARCHAR(100),
    attendee_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
