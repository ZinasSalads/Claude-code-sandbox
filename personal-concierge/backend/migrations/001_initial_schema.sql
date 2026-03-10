-- Health data from Oura Ring (synced daily)
CREATE TABLE IF NOT EXISTS health_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    readiness_score INTEGER,
    readiness_temperature FLOAT,
    hrv FLOAT,
    hrv_balance FLOAT,
    resting_heart_rate INTEGER,
    sleep_score INTEGER,
    sleep_duration FLOAT,
    deep_sleep_minutes INTEGER,
    rem_sleep_minutes INTEGER,
    light_sleep_minutes INTEGER,
    awake_minutes INTEGER,
    sleep_efficiency FLOAT,
    respiratory_rate FLOAT,
    spo2_avg FLOAT,
    activity_score INTEGER,
    steps INTEGER,
    calories_active INTEGER,
    raw_oura JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily check-ins (user input each morning)
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    energy INTEGER CHECK (energy BETWEEN 1 AND 10),
    mood INTEGER CHECK (mood BETWEEN 1 AND 10),
    stress INTEGER CHECK (stress BETWEEN 1 AND 10),
    soreness INTEGER CHECK (soreness BETWEEN 1 AND 10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workouts — both AI-recommended and manually logged
CREATE TABLE IF NOT EXISTS workouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    workout_type VARCHAR(100),
    title VARCHAR(255),
    description TEXT,
    exercises JSONB,
    duration_minutes INTEGER,
    intensity VARCHAR(50),
    readiness_at_recommendation INTEGER,
    ai_reasoning TEXT,
    recommended_by_ai BOOLEAN DEFAULT true,
    completed BOOLEAN DEFAULT false,
    completion_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meals — AI-recommended and logged
CREATE TABLE IF NOT EXISTS meals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    meal_type VARCHAR(50),
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    calories INTEGER,
    protein_g FLOAT,
    carbs_g FLOAT,
    fat_g FLOAT,
    fiber_g FLOAT,
    ai_reasoning TEXT,
    logged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Biomarkers from blood work
CREATE TABLE IF NOT EXISTS biomarkers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_date DATE NOT NULL,
    marker_name VARCHAR(255) NOT NULL,
    marker_category VARCHAR(100),
    value FLOAT NOT NULL,
    unit VARCHAR(50),
    reference_min FLOAT,
    reference_max FLOAT,
    optimal_min FLOAT,
    optimal_max FLOAT,
    status VARCHAR(50),
    notes TEXT,
    lab_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_date, marker_name)
);

-- Supplements
CREATE TABLE IF NOT EXISTS supplements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    dose VARCHAR(100),
    unit VARCHAR(50),
    timing VARCHAR(100),
    purpose TEXT,
    active BOOLEAN DEFAULT true,
    started_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplement log (daily adherence)
CREATE TABLE IF NOT EXISTS supplement_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    supplement_id UUID REFERENCES supplements(id),
    taken BOOLEAN DEFAULT false,
    taken_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, supplement_id)
);

-- User profile (key-value store for all settings and preferences)
CREATE TABLE IF NOT EXISTS user_profile (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    category VARCHAR(100),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI memories (structured from Mem0 — also stored locally for querying)
CREATE TABLE IF NOT EXISTS memories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mem0_id VARCHAR(255) UNIQUE,
    category VARCHAR(100),
    content TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Life profile questions asked and answered
CREATE TABLE IF NOT EXISTS profile_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT,
    category VARCHAR(100),
    asked_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_health_data_date ON health_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_date ON check_ins(date DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date DESC);
CREATE INDEX IF NOT EXISTS idx_biomarkers_date ON biomarkers(test_date DESC);
CREATE INDEX IF NOT EXISTS idx_biomarkers_name ON biomarkers(marker_name);
