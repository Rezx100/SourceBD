import { redirect } from "next/navigation";
import { savedSearchRedirectHref } from "@/lib/saved-searches";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SavedSearchByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getServerRole();
  if (role !== "buyer" && role !== "admin") {
    redirect("/login");
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("saved_searches").select("query_state").eq("id", id).maybeSingle();
  if (!data) redirect("/app/searches");
  redirect(savedSearchRedirectHref((data as { query_state?: unknown }).query_state));
}
