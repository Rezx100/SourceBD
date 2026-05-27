import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";

// Placeholder login page. F2 middleware redirects unauthenticated access to
// `/admin` and `/supplier` here. Real auth UI (email/password + magic link
// + role provisioning) ships in Spec F3 — do NOT pull that work in.

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardMeta>Spec F3</CardMeta>
        </CardHeader>
        <CardContent className="text-ink-secondary">
          Sign-in arrives in the next foundation spec.
        </CardContent>
      </Card>
    </main>
  );
}
