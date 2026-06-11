# 🌤️ Open-Meteo Weather Integration Guide

## Overview

We've successfully integrated **Open-Meteo** weather APIs into the framedInsight coffee satellite monitoring system to provide:

1. **Historical weather data** for the past 14 days
2. **7-day weather forecasts**
3. **Automated disease risk calculations**:
   - ☕ Coffee Berry Disease (CBD) Risk
   - 🍄 Coffee Leaf Rust (CLR) Risk
   - 💧 Drought Stress Index
4. **Enhanced satellite alerts** with weather context
5. **Real-time weather dashboards** in the UI

---

## Architecture

### Backend Components

#### 1. Edge Function: `fetch-weather-data`
**Location:** `supabase/functions/fetch-weather-data/index.ts`

**What it does:**
- Fetches historical weather from Open-Meteo Archive API (past 14 days)
- Fetches 7-day forecasts from Open-Meteo Forecast API
- Calculates disease risk scores based on weather conditions
- Stores data in `coffee_plot_weather` table
- Runs daily via cron job at 6 AM UTC

**Risk Calculation Logic:**

```typescript
// CBD Risk (0-100%)
// Optimal: 15-25°C, >80% humidity, recent rain
- Temperature factor: 40 pts (optimal 15-25°C)
- Humidity factor: 35 pts (>80% RH)
- Precipitation factor: 25 pts (>5mm rain)

// CLR Risk (0-100%)
// Optimal: 20-24°C, >85% humidity
- Temperature factor: 50 pts (optimal 20-24°C)
- Night temp factor: 20 pts (12-20°C)
- Humidity factor: 30 pts (>85% RH)

// Drought Stress (0-100%)
// triggered by low rain, low soil moisture, high evapotranspiration
- Low precipitation: 35 pts (<1mm)
- Low soil moisture: 40 pts (<0.15 m³/m³)
- High evapotranspiration: 15 pts (>4mm)
- Low humidity: 10 pts (<40% RH)
```

**Deployment:**
```bash
cd supabase/functions/fetch-weather-data
denofmt index.ts  # Format code
supabase functions deploy fetch-weather-data
```

#### 2. Enhanced Satellite Function: `fetch-plot-indices`
**Location:** `supabase/functions/fetch-plot-indices/index.ts`

**Updates:**
- Fetches weather context from `coffee_plot_weather` table
- Builds enhanced alert reasons with weather factors
- Sends WhatsApp alerts with detailed weather context

**Example Enhanced Alert:**
```
⚠️ framedInsight Satellite Alert

Hi John,

Your coffee plot "Kiambugu Block A" is showing signs of stress.
Alert: Health score dropped 18 points this week

🌤️ Weather Context (7-day avg):
  • CBD Risk: 78% (High)
  • CLR Risk: 65% (High)
  • Recent rain detected

⚠️ Please scout this plot immediately for diseases like:
• Coffee Berry Disease (CBD)
• Coffee Leaf Rust (CLR)
• Other pests or nutritional issues

Visit your framedInsight dashboard for detailed satellite data.
```

### Database Schema

#### Table: `coffee_plot_weather`
```sql
CREATE TABLE coffee_plot_weather (
  id UUID PRIMARY KEY,
  plot_id UUID NOT NULL REFERENCES coffee_plots(id),
  date DATE NOT NULL,
  
  -- Weather observations
  temperature_2m_mean NUMERIC(5,2),
  temperature_2m_max NUMERIC(5,2),
  temperature_2m_min NUMERIC(5,2),
  precipitation_sum NUMERIC(6,2),
  relative_humidity_2m_mean NUMERIC(5,2),
  soil_moisture_0_to_10cm NUMERIC(6,3),
  evapotranspiration NUMERIC(6,3),
  weather_code INTEGER,
  
  -- Calculated risk scores
  cbd_risk_score INTEGER,
  clr_risk_score INTEGER,
  drought_stress_score INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plot_id, date)
);
```

#### View: `v_plot_latest_weather`
Provides latest weather data with 7-day rolling averages for risk scores.

### Frontend Components

#### Updated: `SatelliteClient.tsx`
**Location:** `app/dashboard/coffee/satellite/SatelliteClient.tsx`

**New Features:**
- Weather data fetched when plot card is expanded
- Disease risk visualization with color-coded progress bars
- Weather context badges (recent rain, high humidity)
- Real-time risk score display

**UI Components:**
```
📊 Disease Risk Section (in expanded plot card)
├─ ☕ CBD Risk: [progress bar] 78%
├─ 🍄 CLR Risk: [progress bar] 65%
├─ 💧 Drought Stress: [progress bar] 23%
└─ 🌧️ Recent rainfall detected · 💨 High humidity levels
```

---

## API Reference

### Open-Meteo Endpoints Used

1. **Historical Archive API**
   ```
   https://archive-api.open-meteo.com/v1/archive
   ?latitude={lat}
   &longitude={lon}
   &start_date={start}
   &end_date={end}
   &daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,
   precipitation_sum,relative_humidity_2m_mean,
   soil_moisture_0_to_10cm,evapotranspiration,weather_code
   &timezone=Africa/Nairobi
   ```

2. **Forecast API**
   ```
   https://api.open-meteo.com/v1/forecast
   ?latitude={lat}
   &longitude={lon}
   &daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,
   precipitation_sum,relative_humidity_2m_mean,
   soil_moisture_0_to_10cm,evapotranspiration,weather_code
   &forecast_days=7
   &timezone=Africa/Nairobi
   ```

**Rate Limits:**
- Free tier: 100 calls/minute
- No API key required
- Commercial use allowed with attribution

---

## Deployment Instructions

### Step 1: Deploy Database Migration
```bash
supabase db push
```

This creates:
- `coffee_plot_weather` table
- `v_plot_latest_weather` view
- Indexes for performance
- Row Level Security policies

### Step 2: Deploy Edge Functions
```bash
# Deploy weather data fetcher
supabase functions deploy fetch-weather-data

# Deploy enhanced satellite processor
supabase functions deploy fetch-plot-indices
```

### Step 3: Set Up Cron Jobs
The functions include built-in cron triggers:

- **Weather fetch**: Daily at 6 AM UTC
- **Satellite scan**: 1st and 15th of each month at midnight UTC

To verify cron jobs are working:
```bash
supabase functions logs fetch-weather-data --follow
```

### Step 4: Initial Data Backfill (Optional)
To fetch historical weather data for existing plots:
```bash
curl -X POST "{SUPABASE_URL}/functions/v1/fetch-weather-data" \
  -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"
```

---

## Testing

### 1. Test Weather Function
```bash
# Trigger manually
curl -X POST "{SUPABASE_URL}/functions/v1/fetch-weather-data" \
  -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

# Check logs
supabase functions logs fetch-weather-data --follow
```

### 2. Verify Database
```sql
-- Check latest weather data
SELECT 
  cp.plot_name,
  cw.date,
  cw.cbd_risk_score,
  cw.clr_risk_score,
  cw.drought_stress_score
FROM coffee_plot_weather cw
JOIN coffee_plots cp ON cp.id = cw.plot_id
ORDER BY cw.date DESC
LIMIT 10;

-- Check the view
SELECT * FROM v_plot_latest_weather;
```

### 3. Test UI
1. Navigate to `/dashboard/coffee/satellite`
2. Click "Refresh All" to fetch latest data
3. Expand a plot card
4. Verify weather section appears with risk scores

---

## Alert Thresholds

### Current Configuration

| Alert Type | Threshold | Action |
|------------|-----------|--------|
| **Health Score Drop** | ≥15 points | Immediate scout |
| **NDVI Critical** | <0.35 | Severe stress alert |
| **Weeks of Decline** | ≥3 weeks | Trending alert |
| **CBD Risk** | >60% | High disease pressure |
| **CLR Risk** | >60% | High disease pressure |
| **Drought Stress** | >60% | Irrigation needed |

### Customizing Thresholds

Edit `supabase/functions/fetch-plot-indices/index.ts`:
```typescript
const ALERT_DROP_THRESHOLD = 15; // Health score drop
const NDVI_CRITICAL = 0.35;      // Critical NDVI level

// In calculateCBDRisk(), adjust:
if (humidity > 80) risk += 35;  // Change threshold
```

---

## Troubleshooting

### Common Issues

#### 1. "No weather data available"
**Cause:** GPS coordinates missing from plots
**Fix:** Ensure all coffee plots have `gps_latitude` and `gps_longitude`

#### 2. Function deployment fails
**Error:** `Relative import path not prefixed`
**Fix:** Update `deno.json` to use full URLs:
```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

#### 3. Rate limit exceeded
**Error:** HTTP 429 from Open-Meteo
**Fix:** Increase delay between plot processing:
```typescript
await new Promise(resolve => setTimeout(resolve, 600)); // ms
```

#### 4. Risk scores are null
**Cause:** Weather data not fetched yet
**Fix:** Manually trigger weather function or wait for next cron run

---

## Performance Optimization

### Current Performance
- **Weather fetch:** ~600ms per plot (rate-limited)
- **Satellite + Weather:** ~1.2s per plot combined
- **Typical farm (10 plots):** ~12 seconds total

### Optimization Strategies

1. **Parallel Processing** (for farms with <10 plots)
```typescript
await Promise.all(plots.map(processPlot));
```

2. **Staggered Cron Scheduling**
   - Different farms on different days based on farm_id hash
   - Reduces peak load on Open-Meteo API

3. **Caching**
   - Cache weather data for 6 hours
   - Skip redundant API calls

---

## Future Enhancements

### Phase 2 (Recommended)
1. **7-Day Predictive Alerts**
   - Use forecast data to predict stress before it occurs
   - Send proactive WhatsApp notifications

2. **Hyperlocal Weather Stations**
   - Integrate with on-farm IoT weather sensors
   - Improve accuracy beyond 1km grid resolution

3. **Pest Life Cycle Modeling**
   - Model coffee berry borer development based on temperature
   - Predict optimal spray timing

4. **Yield Prediction**
   - Combine NDVI + weather to forecast yield
   - Help with harvest planning and sales contracts

### Phase 3 (Advanced)
1. **Machine Learning**
   - Train models on historical alerts + scouting outcomes
   - Improve risk calculation accuracy

2. **Multi-Sensor Fusion**
   - Combine Sentinel-2 + Landsat + Planet Labs
   - Daily coverage with multiple resolutions

3. **Automated Irrigation Scheduling**
   - Calculate crop water requirements
   - Send irrigation recommendations

---

## Attribution

This integration uses:
- **Open-Meteo** (https://open-meteo.com) - Free weather APIs
- **Copernicus Sentinel-2** - Satellite imagery
- **Supabase Edge Functions** - Serverless compute

---

## Support

For issues or questions:
1. Check function logs: `supabase functions logs <function-name> --follow`
2. Review database: `supabase db diff` to see schema changes
3. Test API directly: Use curl commands above
4. Check Open-Meteo status: https://status.open-meteo.com

---

**Last Updated:** January 2025
**Version:** 1.0.0
