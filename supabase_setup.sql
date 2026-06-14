-- SQL Setup Script for TrafficFlow AI Supabase Tables
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

-- ============================================================================
-- 1. Create USER_SETTINGS Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    google_maps_key TEXT DEFAULT '',
    mapbox_key TEXT DEFAULT '',
    tomtom_key TEXT DEFAULT '',
    open_weather_key TEXT DEFAULT '',
    ai_provider TEXT DEFAULT 'gemini',
    ai_key TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings" 
    ON public.user_settings FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
    ON public.user_settings FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
    ON public.user_settings FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 2. Create BOOKMARKS Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    coordinates JSONB NOT NULL, -- Storing as JSONB array [lng, lat]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own bookmarks" 
    ON public.bookmarks FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks" 
    ON public.bookmarks FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" 
    ON public.bookmarks FOR DELETE 
    USING (auth.uid() = user_id);


-- ============================================================================
-- 3. Create SEARCH_HISTORY Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    coordinates JSONB NOT NULL, -- Storing as JSONB array [lng, lat]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own search history" 
    ON public.search_history FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search history" 
    ON public.search_history FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search history" 
    ON public.search_history FOR DELETE 
    USING (auth.uid() = user_id);
