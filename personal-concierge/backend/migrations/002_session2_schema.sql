-- Session 2 schema additions

-- Blood work uploads — track each lab report
CREATE TABLE IF NOT EXISTS blood_work_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    upload_date DATE NOT NULL,
    lab_name VARCHAR(255),
    test_date DATE NOT NULL,
    pdf_filename VARCHAR(255),
    raw_text TEXT,
    processing_status VARCHAR(50) DEFAULT 'pending',
    biomarker_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplement stack (session 2 version — drops session 1 if exists)
CREATE TABLE IF NOT EXISTS supplements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    dose_amount FLOAT,
    dose_unit VARCHAR(50),
    timing VARCHAR(100),
    timing_notes TEXT,
    purpose TEXT,
    category VARCHAR(100),
    active BOOLEAN DEFAULT true,
    started_date DATE,
    evidence_grade VARCHAR(50),
    interactions TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplement adherence log
CREATE TABLE IF NOT EXISTS supplement_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    supplement_id UUID REFERENCES supplements(id) ON DELETE CASCADE,
    taken BOOLEAN DEFAULT false,
    taken_at TIMESTAMPTZ,
    skipped_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, supplement_id)
);

-- Environmental data (cached daily)
CREATE TABLE IF NOT EXISTS environmental_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    location_lat FLOAT,
    location_lon FLOAT,
    location_name VARCHAR(255),
    uv_index_max FLOAT,
    uv_index_current FLOAT,
    uv_risk_level VARCHAR(50),
    aqi INTEGER,
    pm25 FLOAT,
    pm10 FLOAT,
    aqi_category VARCHAR(50),
    pollen_tree INTEGER,
    pollen_grass INTEGER,
    pollen_weed INTEGER,
    pollen_risk_level VARCHAR(50),
    temp_c FLOAT,
    humidity INTEGER,
    conditions VARCHAR(100),
    wind_kph FLOAT,
    outdoor_exercise_safe BOOLEAN,
    sunscreen_required BOOLEAN,
    air_quality_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Science/research articles relevant to user
CREATE TABLE IF NOT EXISTS research_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pubmed_id VARCHAR(50) UNIQUE,
    title TEXT NOT NULL,
    authors TEXT,
    journal VARCHAR(255),
    publication_date DATE,
    abstract TEXT,
    url VARCHAR(500),
    relevance_score FLOAT,
    relevance_reasons TEXT,
    domains TEXT[],
    evidence_grade VARCHAR(50),
    study_type VARCHAR(100),
    saved BOOLEAN DEFAULT false,
    dismissed BOOLEAN DEFAULT false,
    user_notes TEXT,
    sweep_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Longevity metrics (calculated periodically)
CREATE TABLE IF NOT EXISTS longevity_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    calculated_date DATE NOT NULL UNIQUE,
    chronological_age INTEGER,
    biological_age_estimate FLOAT,
    biological_age_delta FLOAT,
    vo2_max_estimate FLOAT,
    hrv_score FLOAT,
    rhr_score FLOAT,
    sleep_quality_score FLOAT,
    apob FLOAT,
    hba1c FLOAT,
    fasting_glucose FLOAT,
    hscrp FLOAT,
    cardiovascular_score FLOAT,
    metabolic_score FLOAT,
    recovery_score FLOAT,
    overall_longevity_score FLOAT,
    trend_direction VARCHAR(20),
    key_insights TEXT,
    recommendations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coaching style settings
CREATE TABLE IF NOT EXISTS coaching_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mode VARCHAR(50) DEFAULT 'adaptive',
    drift_detection_enabled BOOLEAN DEFAULT true,
    drift_threshold_days INTEGER DEFAULT 7,
    escalation_enabled BOOLEAN DEFAULT true,
    current_drift_score FLOAT DEFAULT 0,
    days_in_current_mode INTEGER DEFAULT 0,
    last_mode_change TIMESTAMPTZ,
    motivation_style VARCHAR(50) DEFAULT 'balanced',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance drift tracking
CREATE TABLE IF NOT EXISTS compliance_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    domain VARCHAR(50) NOT NULL,
    recommended TEXT,
    actual TEXT,
    complied BOOLEAN,
    drift_contribution FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Life profile — the progressive knowledge base
CREATE TABLE IF NOT EXISTS life_profile (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    category VARCHAR(100),
    confidence FLOAT DEFAULT 1.0,
    source VARCHAR(100),
    last_confirmed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily questions for life profile building
CREATE TABLE IF NOT EXISTS profile_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    category VARCHAR(100),
    trigger_type VARCHAR(50),
    asked_date DATE,
    answered BOOLEAN DEFAULT false,
    answer TEXT,
    answer_stored_as TEXT,
    skipped BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplements_active ON supplements(active);
CREATE INDEX IF NOT EXISTS idx_supplement_log_date ON supplement_log(date DESC);
CREATE INDEX IF NOT EXISTS idx_environmental_date ON environmental_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_research_sweep ON research_articles(sweep_date DESC);
CREATE INDEX IF NOT EXISTS idx_research_saved ON research_articles(saved);
CREATE INDEX IF NOT EXISTS idx_longevity_date ON longevity_metrics(calculated_date DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_date ON compliance_events(date DESC);
CREATE INDEX IF NOT EXISTS idx_life_profile_category ON life_profile(category);
