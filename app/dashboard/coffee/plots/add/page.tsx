import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddPlotClient from "./AddPlotClient";

export default async function AddPlotPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  return <AddPlotClient />;
}
