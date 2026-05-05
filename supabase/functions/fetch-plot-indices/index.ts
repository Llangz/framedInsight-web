/// <reference lib="deno.window" />

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlotRecord {
  id: string;
  farm_id: string;
  plot_name: string;
  boundary_geojson: Record<string, unknown> | null;
  area_hectares: number | null;
  region_name: string | null;
}

interface IndexStats {
  mean: number | null;
  min: number | null;
  max: number | null;
  stDev: number | null;
}

interface ParsedIndices {
  ndvi: IndexStats;
  ndre: IndexStats;
  ndwi: IndexStats;
  cloudCoverPct: number;
  imageDate: string;
}

interface ProcessResult {
  status: "success" | "error" | "cloudy" | "skipped";
  plotId: string;
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CDSE_TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

const CDSE_STATS_URL =
  "https://sh.dataspace.copernicus.eu/api/v1/statistics";

const DAYS_TO_LOOK_BACK     = 30;
const MAX_CLOUD_COVER_PCT   = 50;
const ALERT_DROP_THRESHOLD  = 15;
const NDVI_CRITICAL         = 0.35;
const MIN_VALID_PIXEL_RATIO = 0.3;

// ─── Evalscript ───────────────────────────────────────────────────────────────
// This is Sentinel Hub's own JS dialect — it runs inside CDSE, not in Deno.
// It lives in a string. TypeScript cannot and should not type-check it.

const EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03","B04","B05","B08","CLM","dataMask"], units: "REFLECTANCE" }],
    output: [
      { id: "ndvi",     bands: 1, sampleType: "FLOAT32" },
      { id: "ndre",     bands: 1, sampleType: "FLOAT32" },
      { id: "ndwi",     bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  const valid = s.dataMask === 1 && s.CLM === 0;
  if (!valid) return { ndvi: [0], ndre: [0], ndwi: [0], dataMask: [0] };
  return {
    ndvi:     [(s.B08 - s.B04) / (s.B08 + s.B04 + 1e-10)],
    ndre:     [(s.B08 - s.B05) / (s.B08 + s.B05 + 1e-10)],
    ndwi:     [(s.B03 - s.B08) / (s.B03 + s.B08 + 1e-10)],
    dataMask: [1]
  };
}
`;

// ─── CDSE Auth ────────────────────────────────────────────────────────────────

async function getCDSEToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(CDSE_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CDSE auth failed (${res.status}): ${text}`);
  }

  const json = await res.json() as { access_token: string };
  return json.access_token;
}

// ─── Build Statistics Request ─────────────────────────────────────────────────

function buildRequest(
  geometry: Record<string, unknown>,
  dateFrom: string,
  dateTo: string,
): Record<string, unknown> {
  return {
    input: {
      bounds: {
        geometry,
        properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
      },
      data: [{
        type: "sentinel-2-l2a",
        dataFilter: {
          mosaickingOrder:  "leastCC",
          maxCloudCoverage: MAX_CLOUD_COVER_PCT,
        },
      }],
    },
    aggregation: {
      timeRange: {
        from: `${dateFrom}T00:00:00Z`,
        to:   `${dateTo}T23:59:59Z`,
      },
      aggregationInterval: { of: "P5D" },
      evalscript: EVALSCRIPT,
      resx: 10,
      resy: 10,
    },
    calculations: {
      ndvi: { statistics: { default: { percentiles: { k: [10, 50, 90] } } } },
      ndre: { statistics: { default: { percentiles: { k: [10, 50, 90] } } } },
      ndwi: { statistics: { default: { percentiles: { k: [10, 50, 90] } } } },
    },
  };
}

// ─── Parse CDSE Response ──────────────────────────────────────────────────────

function parseCDSEResponse(raw: Record<string, unknown>): ParsedIndices | null {
  const intervals = raw?.data as Array<Record<string, unknown>> | undefined;
  if (!intervals || intervals.length === 0) return null;

  // Pick the interval with the most valid (non-cloudy) pixels
  let bestInterval: Record<string, unknown> | null = null;
  let bestValidRatio = -1;

  for (const interval of intervals) {
    const outputs = interval?.outputs as Record<string, unknown> | undefined;
    if (!outputs) continue;

    const ndviBands = (outputs?.ndvi as Record<string, unknown>)
      ?.bands as Record<string, unknown> | undefined;
    const stats = (ndviBands?.B0 as Record<string, unknown>)
      ?.stats as Record<string, unknown> | undefined;
    if (!stats) continue;

    const sampleCount = (stats.sampleCount as number) || 1;
    const noDataCount = (stats.noDataCount  as number) || 0;
    const validRatio  = 1 - noDataCount / sampleCount;

    if (validRatio > bestValidRatio) {
      bestValidRatio = validRatio;
      bestInterval   = interval;
    }
  }

  if (!bestInterval || bestValidRatio < MIN_VALID_PIXEL_RATIO) return null;

  const outputs  = bestInterval.outputs as Record<string, unknown>;
  const interval = bestInterval.interval as Record<string, unknown>;
  const imageDate = ((interval?.from as string | undefined) ?? "").split("T")[0]
    || new Date().toISOString().split("T")[0];

  const extractStats = (indexOutput: unknown): IndexStats => {
    const bands = (indexOutput as Record<string, unknown>)
      ?.bands as Record<string, unknown> | undefined;
    const stats = (bands?.B0 as Record<string, unknown>)
      ?.stats as Record<string, unknown> | undefined;

    if (!stats) return { mean: null, min: null, max: null, stDev: null };
    return {
      mean:  typeof stats.mean  === "number" ? stats.mean  : null,
      min:   typeof stats.min   === "number" ? stats.min   : null,
      max:   typeof stats.max   === "number" ? stats.max   : null,
      stDev: typeof stats.stDev === "number" ? stats.stDev : null,
    };
  };

  // Cloud cover estimate
  const ndviBands   = (outputs?.ndvi as Record<string, unknown>)
    ?.bands as Record<string, unknown> | undefined;
  const ndviStats   = (ndviBands?.B0 as Record<string, unknown>)
    ?.stats as Record<string, unknown> | undefined;
  const sampleCount = typeof ndviStats?.sampleCount === "number" ? ndviStats.sampleCount : 1;
  const noDataCount = typeof ndviStats?.noDataCount  === "number" ? ndviStats.noDataCount  : 0;
  const cloudCoverPct = Math.round((noDataCount / sampleCount) * 100);

  return {
    ndvi: extractStats(outputs?.ndvi),
    ndre: extractStats(outputs?.ndre),
    ndwi: extractStats(outputs?.ndwi),
    cloudCoverPct,
    imageDate,
  };
}

// ─── Derive Health Score ──────────────────────────────────────────────────────

function deriveHealthScore(indices: ParsedIndices): {
  score: number;
  label: "good" | "watch" | "stress" | "critical";
} {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const ndviNorm = indices.ndvi.mean !== null
    ? clamp((indices.ndvi.mean - 0.20) / 0.65)
    : 0.5;

  const ndreNorm = indices.ndre.mean !== null
    ? clamp((indices.ndre.mean - 0.05) / 0.50)
    : 0.5;

  const ndwiNorm = indices.ndwi.mean !== null
    ? clamp((indices.ndwi.mean + 0.30) / 0.60)
    : 0.5;

  const score = Math.round(
    clamp(ndviNorm * 0.50 + ndreNorm * 0.30 + ndwiNorm * 0.20) * 100
  );

  const label =
    score >= 70 ? "good"    :
    score >= 50 ? "watch"   :
    score >= 30 ? "stress"  : "critical";

  return { score, label };
}

// ─── Process One Plot ─────────────────────────────────────────────────────────

async function processPlot(
  plot: PlotRecord,
  token: string,
  sb: SupabaseClient,
): Promise<ProcessResult> {
  const plotId = plot.id;

  // Skip if fetched within last 5 days
  const { data: recent } = await sb
    .from("coffee_satellite_indices")
    .select("image_date")
    .eq("plot_id", plotId)
    .order("image_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.image_date) {
    const daysSince = Math.floor(
      (Date.now() - new Date(recent.image_date as string).getTime()) / 86_400_000,
    );
    if (daysSince < 5) {
      return { status: "skipped", plotId, message: `Fetched ${daysSince}d ago` };
    }
  }

  const dateTo   = new Date().toISOString().split("T")[0];
  const dateFrom = new Date(Date.now() - DAYS_TO_LOOK_BACK * 86_400_000)
    .toISOString().split("T")[0];

  if (!plot.boundary_geojson) {
    await sb.from("coffee_satellite_fetch_log").insert({
      plot_id: plotId, status: "error",
      date_range_from: dateFrom, date_range_to: dateTo,
      error_message: "No boundary_geojson on plot",
    });
    return { status: "error", plotId, message: "No plot boundary" };
  }

  // Call CDSE Statistical API
  let raw: Record<string, unknown>;
  try {
    const res = await fetch(CDSE_STATS_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
        "Accept":        "application/json",
      },
      body: JSON.stringify(buildRequest(plot.boundary_geojson, dateFrom, dateTo)),
    });

    if (!res.ok) {
      throw new Error(`CDSE ${res.status}: ${await res.text()}`);
    }
    raw = await res.json() as Record<string, unknown>;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await sb.from("coffee_satellite_fetch_log").insert({
      plot_id: plotId, status: "error",
      date_range_from: dateFrom, date_range_to: dateTo,
      error_message: message,
    });
    return { status: "error", plotId, message };
  }

  const indices = parseCDSEResponse(raw);
  if (!indices) {
    await sb.from("coffee_satellite_fetch_log").insert({
      plot_id: plotId, status: "cloudy",
      date_range_from: dateFrom, date_range_to: dateTo,
      cloud_cover_pct: 100,
      error_message: "No cloud-free image in 30 days",
    });
    return { status: "cloudy", plotId, message: "No usable image in 30 days" };
  }

  // Previous reading for change calculation
  const { data: prev } = await sb
    .from("coffee_satellite_indices")
    .select("ndvi_mean, health_score, weeks_of_decline")
    .eq("plot_id", plotId)
    .order("image_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { score, label } = deriveHealthScore(indices);

  const prevNdvi  = typeof prev?.ndvi_mean    === "number" ? prev.ndvi_mean    : null;
  const prevScore = typeof prev?.health_score === "number" ? prev.health_score : null;
  const prevDecline = typeof prev?.weeks_of_decline === "number" ? prev.weeks_of_decline : 0;

  const ndviChange   = prevNdvi !== null && indices.ndvi.mean !== null
    ? parseFloat((indices.ndvi.mean - prevNdvi).toFixed(4))
    : null;

  const scoreChange  = prevScore !== null ? score - prevScore : null;
  const weeksOfDecline = ndviChange !== null && ndviChange < 0 ? prevDecline + 1 : 0;

  let alertTriggered = false;
  let alertReason: string | null = null;

  if (scoreChange !== null && scoreChange <= -ALERT_DROP_THRESHOLD) {
    alertTriggered = true;
    alertReason    = `Health score dropped ${Math.abs(scoreChange)} points this week`;
  } else if (indices.ndvi.mean !== null && indices.ndvi.mean < NDVI_CRITICAL) {
    alertTriggered = true;
    alertReason    = `NDVI critically low (${indices.ndvi.mean.toFixed(3)}) — severe canopy stress`;
  } else if (weeksOfDecline >= 3) {
    alertTriggered = true;
    alertReason    = `${weeksOfDecline} consecutive weeks of declining health`;
  }

  const { error: upsertErr } = await sb
    .from("coffee_satellite_indices")
    .upsert({
      farm_id:             plot.farm_id,
      plot_id:             plotId,
      image_date:          indices.imageDate,
      cloud_cover_pct:     indices.cloudCoverPct,
      ndvi_mean:           indices.ndvi.mean,
      ndvi_min:            indices.ndvi.min,
      ndvi_max:            indices.ndvi.max,
      ndvi_std:            indices.ndvi.stDev,
      ndre_mean:           indices.ndre.mean,
      ndre_min:            indices.ndre.min,
      ndre_max:            indices.ndre.max,
      ndwi_mean:           indices.ndwi.mean,
      ndwi_min:            indices.ndwi.min,
      ndwi_max:            indices.ndwi.max,
      health_score:        score,
      health_label:        label,
      ndvi_change:         ndviChange,
      health_score_change: scoreChange,
      weeks_of_decline:    weeksOfDecline,
      alert_triggered:     alertTriggered,
      alert_reason:        alertReason,
      raw_cdse_response:   raw,
    }, { onConflict: "plot_id,image_date" });

  if (upsertErr) {
    return { status: "error", plotId, message: upsertErr.message };
  }

  await sb.from("coffee_satellite_fetch_log").insert({
    plot_id: plotId, status: "success",
    cloud_cover_pct: indices.cloudCoverPct,
    date_range_from: dateFrom, date_range_to: dateTo,
  });

  return {
    status: "success",
    plotId,
    message: `${plot.plot_name}: NDVI=${indices.ndvi.mean?.toFixed(3)}, score=${score} (${label})${alertTriggered ? " ⚠️" : ""}`,
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")             ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const CDSE_CLIENT_ID            = Deno.env.get("CDSE_CLIENT_ID")            ?? "";
    const CDSE_CLIENT_SECRET        = Deno.env.get("CDSE_CLIENT_SECRET")        ?? "";

    if (!CDSE_CLIENT_ID || !CDSE_CLIENT_SECRET) {
      throw new Error("CDSE_CLIENT_ID and CDSE_CLIENT_SECRET must be set in Supabase secrets");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({})) as {
      plot_id?: string;
      farm_id?: string;
    };

    let query = sb
      .from("coffee_plots")
      .select("id, farm_id, plot_name, boundary_geojson, area_hectares, region_name");

    if (body.plot_id)       query = query.eq("id",       body.plot_id);
    else if (body.farm_id)  query = query.eq("farm_id",  body.farm_id);

    const { data: plots, error: plotsErr } = await query;
    if (plotsErr) throw plotsErr;

    if (!plots || plots.length === 0) {
      return new Response(JSON.stringify({ error: "No plots found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token   = await getCDSEToken(CDSE_CLIENT_ID, CDSE_CLIENT_SECRET);
    const results: ProcessResult[] = [];

    for (const plot of plots) {
      results.push(await processPlot(plot as PlotRecord, token, sb));
      if (plots.length > 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    }

    return new Response(
      JSON.stringify({
        summary: {
          total:     plots.length,
          succeeded: results.filter((r) => r.status === "success").length,
          cloudy:    results.filter((r) => r.status === "cloudy").length,
          skipped:   results.filter((r) => r.status === "skipped").length,
          failed:    results.filter((r) => r.status === "error").length,
        },
        results,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fetch-plot-indices:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});