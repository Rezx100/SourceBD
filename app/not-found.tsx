import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Not found</CardTitle>
          <CardMeta>404</CardMeta>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-ink-secondary">
            The page you were looking for isn&rsquo;t here. It may have moved, or the link
            may be stale.
          </p>
          <Button asChild variant="primary" size="sm">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
