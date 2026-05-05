import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddCowClient from "./AddCowClient";

export default async function AddCowPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  return <AddCowClient />;
}
