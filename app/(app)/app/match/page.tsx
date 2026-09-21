import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find matches · SourceBD",
};

export default function MatchRedirectPage() {
  redirect("/app/discover?ask=1");
}
