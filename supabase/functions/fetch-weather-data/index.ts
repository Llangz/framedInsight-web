/// <reference lib="deno.window" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Open-Meteo API endpoints
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const HISTORY_API = "https://archive-api.open-meteo.com/v1/archive";

interface WeatherData {
  plot_id: string;
  date: string;
  temperature_2m_mean: number | null;
  temperature_2m_max: number | null;
  temperature_2m_min: number | null;
  precipitation_sum: number | null;
  relative_humidity_2m_mean: number | null;
  soil_moisture_0_to_10cm: number | null;
  evapotranspiration: number | null;
  weather_code: number | null;
  cbd_risk_score: number | null;
  clr_risk_score: number | null;
  drought_stress_score: number | null;
}

interface PlotRecord {
  id: string;
  farm_id: string;
  plot_name: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  region_name: string | null;
}

// Calculate Coffee Berry Disease (CBD) Risk
// CBD thrives in: 15-25°C, high humidity (>80%), leaf wetness from rain
function calculateCBDRisk(
  tempMean: number | null,
  humidity: number | null,
  precipitation: number | null
): number | null {
  if (tempMean === null || humidity === null || precipitation === null) return null;
  
  let risk = 0;
  
  // Temperature factor (optimal 15-25°C)
  if (tempMean >= 15 && tempMean <= 25) risk += 40;
  else if (tempMean >= 10 && tempMean <= 30) risk += 20;
  
  // Humidity factor (optimal >80%)
  if (humidity > 80) risk += 35;
  else if (humidity > 60) risk += 15;
  
  // Precipitation factor (recent rain creates leaf wetness)
  if (precipitation > 5) risk += 25;
  else if (precipitation > 1) risk += 10;
  
  return Math.min(100, risk);
}

// Calculate Coffee Leaf Rust (CLR) Risk
// CLR thrives in: 10-28°C, high humidity, poor air circulation
function calculateCLRRisk(
  tempMean: number | null,
  tempMin: number | null,
  humidity: number | null
): number | null {
  if (tempMean === null || humidity === null) return null;
  
  let risk = 0;
  
  // Temperature factor (optimal 20-24°C, range 10-28°C)
  if (tempMean >= 20 && tempMean <= 24) risk += 50;
  else if (tempMean >= 10 && tempMean <= 28) risk += 25;
  
  // Night temperature important for spore germination
  if (tempMin !== null && tempMin >= 12 && tempMin <= 20) risk += 20;
  
  // Humidity factor (optimal >85%)
  if (humidity > 85) risk += 30;
  else if (humidity > 70) risk += 15;
  
  return Math.min(100, risk);
}

// Calculate Drought Stress Score
function calculateDroughtStress(
  precipitation: number | null,
  soilMoisture: number | null,
  evapotranspiration: number | null,
  humidity: number | null
): number | null {
  if (precipitation === null && soilMoisture === null) return null;
  
  let stress = 0;
  
  // Low precipitation
  if (precipitation !== null) {
    if (precipitation < 1) stress += 35;
    else if (precipitation < 5) stress += 15;
  }
  
  // Low soil moisture (m³/m³, typical range 0.15-0.35)
  if (soilMoisture !== null) {
    if (soilMoisture < 0.15) stress += 40;
    else if (soilMoisture < 0.20) stress += 20;
  }
  
  // High evapotranspiration with low water availability
  if (evapotranspiration !== null && evapotranspiration > 4) stress += 15;
  
  // Low humidity
  if (humidity !== null && humidity < 40) stress += 10;
  
  return Math.min(100, stress);
}

async function fetchHistoricalWeather(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<any> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: startDate,
    end_date: endDate,
    daily: "temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,soil_moisture_0_to_10cm,evapotranspiration,weather_code",
    timezone: "Africa/Nairobi",
    forecast_days: (Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1).toString(),
  });

  const response = await fetch(`${HISTORY_API}?${params}`, {
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo historical API error: ${response.status}`);
  }

  return response.json();
}

async function fetchForecastWeather(
  lat: number,
  lon: number,
  forecastDays: number = 7
): Promise<any> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    daily: "temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,soil_moisture_0_to_10cm,evapotranspiration,weather_code",
    timezone: "Africa/Nairobi",
    forecast_days: forecastDays.toString(),
  });

  const response = await fetch(`${WEATHER_API}?${params}`, {
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo forecast API error: ${response.status}`);
  }

  return response.json();
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not set");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all coffee plots with GPS coordinates
    const { data: plots, error: plotsErr } = await sb
      .from("coffee_plots")
      .select("id, farm_id, plot_name, gps_latitude, gps_longitude, region_name")
      .not("gps_latitude", "is", null)
      .not("gps_longitude", "is", null);

    if (plotsErr) throw plotsErr;
    if (!plots || plots.length === 0) {
      return new Response(JSON.stringify({ message: "No plots with GPS coordinates found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];

    const results: WeatherData[] = [];

    for (const plot of plots) {
      if (!plot.gps_latitude || !plot.gps_longitude) continue;

      try {
        // Fetch historical weather for past 14 days
        const historical = await fetchHistoricalWeather(
          plot.gps_latitude,
          plot.gps_longitude,
          startDate,
          endDate
        );

        // Fetch 7-day forecast
        const forecast = await fetchForecastWeather(
          plot.gps_latitude,
          plot.gps_longitude,
          7
        );

        // Process historical data and calculate risk scores
        for (let i = 0; i < (historical.daily?.time?.length || 0); i++) {
          const date = historical.daily.time[i];
          const tempMean = historical.daily.temperature_2m_mean?.[i] ?? null;
          const tempMax = historical.daily.temperature_2m_max?.[i] ?? null;
          const tempMin = historical.daily.temperature_2m_min?.[i] ?? null;
          const precip = historical.daily.precipitation_sum?.[i] ?? null;
          const humidity = historical.daily.relative_humidity_2m_mean?.[i] ?? null;
          const soilMoisture = historical.daily.soil_moisture_0_to_10cm?.[i] ?? null;
          const et = historical.daily.evapotranspiration?.[i] ?? null;
          const weatherCode = historical.daily.weather_code?.[i] ?? null;

          const cbdRisk = calculateCBDRisk(tempMean, humidity, precip);
          const clrRisk = calculateCLRRisk(tempMean, tempMin, humidity);
          const droughtStress = calculateDroughtStress(precip, soilMoisture, et, humidity);

          results.push({
            plot_id: plot.id,
            date,
            temperature_2m_mean: tempMean,
            temperature_2m_max: tempMax,
            temperature_2m_min: tempMin,
            precipitation_sum: precip,
            relative_humidity_2m_mean: humidity,
            soil_moisture_0_to_10cm: soilMoisture,
            evapotranspiration: et,
            weather_code: weatherCode,
            cbd_risk_score: cbdRisk,
            clr_risk_score: clrRisk,
            drought_stress_score: droughtStress,
          });
        }

        console.log(`✓ Processed weather for ${plot.plot_name} (${plot.id})`);
      } catch (err) {
        console.error(`Failed to fetch weather for plot ${plot.id}:`, err);
      }

      // Rate limiting: 100 calls/minute free tier
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    // Upsert weather data into database
    if (results.length > 0) {
      const { error: insertErr } = await sb
        .from("coffee_plot_weather")
        .upsert(results, { onConflict: "plot_id,date" });

      if (insertErr) {
        console.error("Failed to insert weather data:", insertErr);
      } else {
        console.log(`✓ Inserted ${results.length} weather records`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        records_processed: results.length,
        plots_processed: plots.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetch-weather-data:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// Cron job: Run daily at 6 AM UTC to fetch weather data
Deno.cron("Daily weather fetch", "0 6 * * *", async () => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase credentials for weather cron");
      return;
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Trigger the weather fetch
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/fetch-weather-data`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();
    console.log("Daily weather fetch completed:", result);
  } catch (err) {
    console.error("Weather cron job failed:", err);
  }
});