# 🚦 TrafficFlow AI — Intelligent Routing & Navigation Ecosystem

[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62B)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E)](https://supabase.com/)
[![Google Maps](https://img.shields.io/badge/Google%20Maps-4285F4?style=for-the-badge&logo=googlemaps&logoColor=white)](https://developers.google.com/maps)
[![Mapbox](https://img.shields.io/badge/Mapbox-000000?style=for-the-badge&logo=mapbox&logoColor=white)](https://www.mapbox.com/)

TrafficFlow AI is a professional-grade, state-of-the-art navigation web application that merges advanced multi-provider route optimization with real-time GPS simulation, live weather mechanics, and an integrated AI Cognitive Advisor. Built using React, Vite, and Supabase, it offers a premium user experience featuring modern glassmorphic panels, dynamic weather canvases, and precise road-snapping turn-by-turn navigation.

---

## 🚀 Key Features

### 1. Multi-Provider Route Engine & Intelligent Fallbacks
* **Active Routing Routing**: Resolves direction requests dynamically using the Google Maps Directions Service (client-side), with auto-fallbacks to the Mapbox Directions API, TomTom API, and free OSRM (Open Source Routing Machine).
* **Alternative Route Calculations**: Generates up to three distinct routes simultaneously:
  * **Fastest Route** (Best Recommended)
  * **Alternative Route** (Balanced/Bypass)
  * **Via City Roads** (Urban streets)
* **Single Selected Path Focus**: Keeps the map uncluttered by drawing *only* the currently selected route with a clean, branded royal blue line and white outlines.

### 2. Professional GPS Navigation HUD & Road Snapping
* **Automatic Navigation Mode**: Tapping a destination automatically switches the interface into full-screen Navigation Mode, closing sidebars and initiating active position tracking.
* **Road Snapping**: Raw GPS signals are snapped in real-time to the nearest coordinate on the route geometry path, preventing the cursor from drifting off-road or jumping into buildings.
* **Real-time Travel Heading (Bearing)**: Calculates the movement heading in degrees `[0, 360)` and rotates the navigation cursor (a clean royal blue directional arrow) dynamically to point in the direction of travel.
* **Smart Completion Celebrations**: When the tracker enters within 40m of the destination, a custom full-screen celebration card displays trip statistics (travel distance, travel time, and average speed) before offering a clean got-it reset.

### 3. Integrated Google Places Search & Autocomplete
* **Real-Time Suggestions**: Employs Google Places Autocomplete directly within the destination search bars as the primary provider (with fallbacks to Mapbox, TomTom, and Komoot Photon).
* **Google Geocoding**: Automatically translates autocomplete places (via Place ID) and manual text submissions into exact geographic coordinates `[lng, lat]`.

### 4. Climate Simulation & Time Engine
* **Day-Night Cycle Overlays**: Realistic ambient overlays simulating Day, Sunrise (+ warm orange glow), Sunset (+ violet shadow), and Night (+ dark transparency).
* **Dynamic Canvas Weather**: High-performance HTML5 canvas overlays rendering real-time animated falling rain particles and drifting fog clouds.
* **Automatic OpenWeatherMap Integration**: Synchronizes the map's current weather state and day-night cycle automatically based on telemetry fetched from your start location.

### 5. AI Cognitive Advisor
* A dedicated sidebar panel powered by your choice of LLM (Google Gemini, OpenAI, or Anthropic Claude).
* Automatically reads your start, destination, travel mode, and calculated route parameters to formulate intelligent, natural-language traffic analysis, navigation advice, and route optimization suggestions.

---

## 🛠️ Technology Stack

* **Front-End Core**: React 18, Vite (Fast HMR), ES6+ JavaScript
* **Database & Auth**: Supabase (PostgreSQL Database, GoTrue Email & Google OAuth Auths, Row Level Security)
* **Mapping Framework**: Google Maps JavaScript SDK (loaded with Places & Geocoding libraries)
* **Design & Icons**: Vanilla CSS (Tailored Design Tokens & Variables, Glassmorphism, Micro-animations), Lucide React

---

## 📂 Supabase Database Schema

Create the tables in your Supabase project's SQL Editor using the following structure:

```sql
-- 1. Create USER_SETTINGS Table
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
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
-- Insert Policies for auth.uid() = user_id (SELECT, INSERT, UPDATE)

-- 2. Create BOOKMARKS Table
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    coordinates JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
-- Insert Policies for auth.uid() = user_id (SELECT, INSERT, DELETE)

-- 3. Create SEARCH_HISTORY Table
CREATE TABLE IF NOT EXISTS public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    coordinates JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
-- Insert Policies for auth.uid() = user_id (SELECT, INSERT, DELETE)
```

---

## ⚙️ Configuration & Environment Variables

To run the application locally, create a `.env` file in the root directory:

```env
# Supabase Authentication & Database Integration (Public anon keys)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anonymous-key
```

> [!WARNING]
> **Sensitive Data Protection**: Never commit personal API Keys (Google Maps SDK, Mapbox, TomTom, OpenWeatherMap, Gemini/OpenAI Keys) to the Git repository. TrafficFlow AI includes an in-app **Settings Modal** where authenticated users can securely input, customize, and save their private keys directly to their profile (synced to Supabase with RLS protections).

---

## 📦 Local Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd trafficflow-ai
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

4. **Build Production Bundle**:
   ```bash
   npm run build
   ```
