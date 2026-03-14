-- Daily plan cache table
-- Stores the generated council plan per day to avoid 30s+ regeneration

CREATE TABLE IF NOT EXISTS daily_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    plan JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    invalidated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON daily_plans(date);
