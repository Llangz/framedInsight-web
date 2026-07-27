/// <reference lib="deno.window" />

/**
 * sentinel-tile — Supabase Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Serves Sentinel-2 true-color imagery as standard XYZ/slippy-map PNG tiles,
 * so it can be dropped into Leaflet as a `L.tileLayer('.../sentinel-tile?z={z}
 * &x={x}&y={y}')` exactly like Esri or OSM.
 *
 * WHY THIS EXISTS:
 * Esri's free World Imagery has no real coverage over a lot of rural
 * farmland — see the long comments in lib/offline-tile-layer.ts and
 * components/coffee/PlotBoundaryMapper.tsx. Falling all the way back to
 * OSM's street map when that happens loses all satellite context (no crop
 * rows, no field boundaries — just roads). Sentinel-2 has real, if coarser
 * (10m/pixel vs Esri's <1m where it has coverage), imagery absolutely
 * everywhere — satellites orbit the whole planet, there's no "nobody
 * licensed imagery here" gap the way there is with a compiled commercial
 * mosaic. It's also freely licensed for any use under EU open-data law
 * (unlike Planet/NICFI, which is non-commercial-only), and this app
 * already has a working CDSE OAuth client (see fetch-plot-indices) — this
 * function reuses the same credentials, just against the Process API
 * instead of the Statistical API.
 *
 * WHY A SERVER-SIDE PROXY (not a direct client-side tile URL):
 * CDSE authentication is OAuth client-credentials with a client secret —
 * exactly the kind of thing that can never be shipped to the browser. A
 * plain <img> tag also can't attach an Authorization header. So this
 * function does what the browser can't: mint/cache a short-lived CDSE
 * token server-side, request the tile from the Process API, and stream
 * the resulting PNG back — publicly and cacheably, same as any other tile
 * server, just with the auth handled out of sight.
 *
 * CACHING:
 * Sentinel Hub's free/sandbox tier meters usage in "processing units," so
 * naively re-requesting the same tile on every page load for every farmer
 * would burn through quota fast for no benefit — a Sentinel-2 composite
 * for a given tile doesn't need to change on every request. Rendered
 * tiles are cached in the `sentinel-tiles` Supabase Storage bucket
 * (public bucket, keyed by z/x/y) and served straight from there on a
 * cache hit; only a cache miss touches the Process API. That bucket must
 * exist before this function is deployed (see deploy note at bottom of
 * this file).
 *
 * IMPORT NOTE:
 * Deliberately imported from a pinned esm.sh URL rather than the bare
 * "@supabase/supabase-js" specifier fetch-plot-indices uses. That bare
 * specifier only resolves via the import map in
 * supabase/functions/deno.json, which the Supabase CLI picks up
 * automatically but the Dashboard's paste-and-deploy bundler does not —
 * deploying this file's source directly through the Dashboard with the
 * bare specifier fails with "Relative import path ... not prefixed with
 * /, ./, or ../". Importing the esm.sh URL directly (same version pinned
 * in deno.json) works from either the CLI or the Dashboard.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ─── Constants ────────────────────────────────────────────────────────────────

const CDSE_TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

const CDSE_PROCESS_URL =
  "https://sh.dataspace.copernicus.eu/api/v1/process";

const TILE_SIZE = 256;
// Web Mercator (EPSG:3857) half-circumference in meters — the same
// constant every XYZ tile scheme (OSM, Esri, Google) is built on.
const ORIGIN_SHIFT = (2 * Math.PI * 6378137) / 2.0;

const STORAGE_BUCKET = "sentinel-tiles";

// Sentinel-2's native resolution is ~10m/pixel. Past zoom 16 a 256px tile
// is already sub-10m/pixel, so a higher zoom is just interpolation of the
// same underlying pixels — no more real detail, but a fresh, quota-costing
// Process API request every time. Leaflet's maxNativeZoom keeps re-using
// (and scaling up) the zoom-16 tile beyond this instead of requesting a
// pointless "sharper" one that doesn't exist.
const MAX_NATIVE_ZOOM = 16;

// Wide time window + least-cloud mosaicking so a request practically never
// comes back empty just because the most recent overpass was cloudy —
// correctness (some real imagery) matters far more than recency for a
// basemap used to trace a plot boundary.
const LOOKBACK_DAYS = 180;
const MAX_CLOUD_COVER_PCT = 60;

// True-color visualization — B04/B03/B02 (R/G/B) with a gain to brighten
// Sentinel-2's naturally dim reflectance values and dataMask as the alpha
// channel, so a tile with no valid pixel in the time window renders fully
// transparent (showing the map container's dark background) rather than
// black — consistent with how a failed/missing Esri tile is handled
// elsewhere in this app (see TRANSPARENT_TILE in lib/offline-tile-layer.ts).
const EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04", "dataMask"] }],
    output: { bands: 4 }
  };
}
function evaluatePixel(s) {
  const gain = 2.5;
  return [gain * s.B04, gain * s.B03, gain * s.B02, s.dataMask];
}
`;

// ─── Tile math ────────────────────────────────────────────────────────────────

function tileToBBox3857(z: number, x: number, y: number): [number, number, number, number] {
  const n = Math.pow(2, z);
  const tileSizeMeters = (2 * ORIGIN_SHIFT) / n;
  const minX = -ORIGIN_SHIFT + x * tileSizeMeters;
  const maxX = -ORIGIN_SHIFT + (x + 1) * tileSizeMeters;
  const maxY = ORIGIN_SHIFT - y * tileSizeMeters;
  const minY = ORIGIN_SHIFT - (y + 1) * tileSizeMeters;
  return [minX, minY, maxX, maxY];
}

// ─── CDSE Auth (same pattern as fetch-plot-indices) ────────────────────────────

async function getCDSEToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(CDSE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CDSE auth failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// ─── Fetch one tile from the Process API ───────────────────────────────────────

async function fetchSentinelTile(token: string, z: number, x: number, y: number): Promise<Uint8Array> {
  const bbox = tileToBBox3857(z, x, y);
  const now = new Date();
  const from = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const body = {
    input: {
      bounds: {
        bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/3857" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: { from: from.toISOString(), to: now.toISOString() },
            maxCloudCoverage: MAX_CLOUD_COVER_PCT,
            mosaickingOrder: "leastCC",
          },
        },
      ],
    },
    output: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: EVALSCRIPT,
  };

  const res = await fetch(CDSE_PROCESS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CDSE Process API failed (${res.status}): ${text}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const imageHeaders = {
    "Content-Type": "image/png",
    "Access-Control-Allow-Origin": "*",
    // A cached Sentinel-2 composite is fine to serve stale for a long time —
    // it only refreshes when the Storage cache entry is cleared/replaced.
    "Cache-Control": "public, max-age=2592000, immutable",
  };

  try {
    const url = new URL(req.url);
    const z = Number(url.searchParams.get("z"));
    const x = Number(url.searchParams.get("x"));
    const y = Number(url.searchParams.get("y"));

    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > MAX_NATIVE_ZOOM) {
      return new Response("Invalid or out-of-range tile coordinates", { status: 400 });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const CDSE_CLIENT_ID = Deno.env.get("CDSE_CLIENT_ID") ?? "";
    const CDSE_CLIENT_SECRET = Deno.env.get("CDSE_CLIENT_SECRET") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CDSE_CLIENT_ID || !CDSE_CLIENT_SECRET) {
      throw new Error(
        "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CDSE_CLIENT_ID and CDSE_CLIENT_SECRET must all be set in Supabase secrets"
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const storagePath = `${z}/${x}/${y}.png`;

    // Cache hit — serve straight from Storage, no CDSE call at all.
    const { data: cached } = await sb.storage.from(STORAGE_BUCKET).download(storagePath);
    if (cached) {
      return new Response(cached, { status: 200, headers: imageHeaders });
    }

    // Cache miss — render via CDSE, then persist for next time (best-effort;
    // a Storage write failure shouldn't fail the tile the farmer is waiting on).
    const token = await getCDSEToken(CDSE_CLIENT_ID, CDSE_CLIENT_SECRET);
    const png = await fetchSentinelTile(token, z, x, y);

    sb.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, png, { contentType: "image/png", upsert: true })
      .catch((err) => console.error("sentinel-tile: cache write failed:", err));

    return new Response(png, { status: 200, headers: imageHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("sentinel-tile:", message);
    // 502, not 500: this specifically means "the upstream tile provider
    // failed," which is exactly the signal the client's tileerror handler
    // is already listening for to fall back further (to OSM).
    return new Response(message, { status: 502, headers: { "Access-Control-Allow-Origin": "*" } });
  }
});

// ─── Deploy notes ─────────────────────────────────────────────────────────────
// 1. Create a PUBLIC Supabase Storage bucket named "sentinel-tiles" before
//    deploying (Dashboard → Storage → New bucket → Public). This function
//    uses the service role key so it can read/write it regardless of the
//    bucket's RLS policies, but it must exist first.
// 2. This function must be deployed with JWT verification OFF (it's a public
//    image endpoint called from a plain <img>/Leaflet tile request, which
//    can't attach an Authorization header) — e.g.
//    `supabase functions deploy sentinel-tile --no-verify-jwt`.
// 3. Reuses the same CDSE_CLIENT_ID / CDSE_CLIENT_SECRET secrets already
//    configured for fetch-plot-indices — no new credentials needed.