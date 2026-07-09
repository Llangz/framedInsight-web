import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { unwrapOr } from "@/lib/safe-query";
import EUDRFleetClient from "./EUDRFleetClient";

type RiskLevel = 'green' | 'yellow' | 'red' | 'unknown'

function computeRisk(
  deforestationRisk: string,
  complianceStatus: string,
  hasLandDoc: boolean,
  hasGps: boolean,
): RiskLevel {
  if (deforestationRisk === 'high') return 'red'
  if (deforestationRisk === 'medium') return 'yellow'
  if (!hasLandDoc || !hasGps) return 'yellow'
  if (complianceStatus === 'verified' && deforestationRisk === 'low') return 'green'
  if (deforestationRisk === 'unknown' || !deforestationRisk) return 'unknown'
  return 'yellow'
}

export default async function EUDRFleetPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!farmManager) {
    redirect("/onboarding");
  }

  const farmId = farmManager.farm_id;

  // Parallel data fetching on the server
  const [plotRes, eudrRes, eventsRes] = await Promise.all([
    supabase
      .from('coffee_plots')
      .select('id, plot_name, area_hectares')
      .eq('farm_id', farmId),
    supabase
      .from('coffee_eudr_compliance')
      .select('*')
      .eq('farm_id', farmId),
    supabase
      .from('v_compliance_timeline')
      .select('*')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  // A failed coffee_eudr_compliance fetch previously fell straight through
  // to eudrData = [], which computeRisk() then reads as "no land doc" and
  // renders every plot as amber/incomplete — a plausible-looking but
  // wrong compliance state for an EUDR (EU Regulation 2023/1115) fleet
  // view, where the whole point is that a farmer or cooperative officer
  // can trust what's on screen without re-verifying it against source
  // records. unwrapOr throws these into app/dashboard/error.tsx instead.
  const coffeePlots = unwrapOr(plotRes as any, [], 'coffee_plots');
  const eudrData = unwrapOr(eudrRes as any, [], 'coffee_eudr_compliance');
  const events = unwrapOr(eventsRes as any, [], 'v_compliance_timeline');

  // Fetch latest satellite reading per plot
  const plotIds = coffeePlots.map(p => p.id);
  let latestSat: Record<string, any> = {};
  if (plotIds.length > 0) {
    const { data: satData } = await supabase
      .from('coffee_satellite_indices')
      .select('plot_id, ndvi_mean, health_label, image_date')
      .in('plot_id', plotIds)
      .order('image_date', { ascending: false });

    (satData || []).forEach(s => {
      if (!latestSat[s.plot_id]) latestSat[s.plot_id] = s;
    });
  }

  const plots = coffeePlots.map(plot => {
    const eudr = eudrData.find(e => e.plot_id === plot.id);
    const sat = latestSat[plot.id];
    const deforestationRisk = eudr?.risk_level || 'unknown';
    const hasLandDoc = !!eudr?.notes;
    const hasGps = !!plot.area_hectares;

    return {
      plotId: plot.id,
      plotName: plot.plot_name,
      areaHectares: plot.area_hectares,
      riskLevel: computeRisk(deforestationRisk, eudr?.compliance_status || '', hasLandDoc, hasGps),
      deforestationRisk,
      forestCoverPct: eudr?.forest_cover_pct || 0,
      hasLandDoc,
      hasGps,
      complianceStatus: eudr?.compliance_status || 'incomplete',
      lastCheck: eudr?.assessment_date || null,
      latestNdvi: sat?.ndvi_mean ?? null,
      healthLabel: sat?.health_label ?? null,
    };
  });

  return (
    <EUDRFleetClient
      plots={plots}
      recentEvents={events}
    />
  );
}
