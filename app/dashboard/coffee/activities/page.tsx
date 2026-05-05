import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ActivitiesClient from "./ActivitiesClient";

export default async function CoffeeActivitiesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .single();

  if (!farmManager) {
    redirect("/onboarding");
  }

  const fId = farmManager.farm_id;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Load activities, season costs, and plots in parallel
  const [activitiesResponse, costsResponse, plotsResponse] = await Promise.all([
    supabase
      .from('coffee_activities')
      .select(`
        id, activity_type, activity_date, plot_id,
        weeding_method, fertilizer_type, spray_type, pruning_type, product_name,
        labour_mode, num_workers, days_worked, rate_per_day,
        cost_inputs, cost_labour, total_cost, notes,
        coffee_plots(plot_name)
      `)
      .eq('farm_id', fId)
      .order('activity_date', { ascending: false })
      .limit(100),
    supabase
      .from('v_season_cost_summary')
      .select('*')
      .eq('farm_id', fId)
      .eq('harvest_year', currentYear),
    supabase
      .from('coffee_plots')
      .select('gps_latitude, gps_longitude')
      .eq('farm_id', fId)
      .not('gps_latitude', 'is', null)
      .limit(1)
  ]);

  const activities = (activitiesResponse.data || []).map((a: any) => ({
    ...a,
    plot_name: a.coffee_plots?.plot_name || null,
  }));

  const seasonCosts = costsResponse.data || [];

  // Determine regional calendar
  let calendarRecs: any[] = [];
  const plot = plotsResponse.data?.[0];

  if (plot?.gps_latitude != null && plot?.gps_longitude != null) {
    try {
      // Note: We can't easily fetch Nominatim from server-side without a library or raw fetch
      // For now, we'll try a default regional lookup or a mock if it fails
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${plot.gps_latitude}&lon=${plot.gps_longitude}&format=json`,
        { headers: { 'User-Agent': 'framedInsight/1.0' } }
      );
      const geo = await res.json();
      const county = (geo.address?.county || geo.address?.state_district || '').replace(' County', '').trim();
      
      const { data: calendarData } = await supabase
        .from('coffee_calendar_regions')
        .select('recommended_activities')
        .contains('counties', [county])
        .eq('month', currentMonth)
        .single();
      
      if (calendarData?.recommended_activities) {
        calendarRecs = calendarData.recommended_activities as any[];
      }
    } catch (e) {
      // Fallback below
    }
  }

  if (calendarRecs.length === 0) {
    const { data: defaultCalendar } = await supabase
      .from('coffee_calendar_regions')
      .select('recommended_activities')
      .eq('region_name', 'Central Highlands')
      .eq('month', currentMonth)
      .single();
    
    calendarRecs = (defaultCalendar?.recommended_activities as any[]) || [];
  }

  return (
    <ActivitiesClient 
      initialActivities={activities} 
      calendarRecs={calendarRecs} 
      seasonCosts={seasonCosts} 
      currentYear={currentYear}
    />
  );
}

