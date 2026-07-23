import Link from "next/link";

import { BlurFade } from "@/components/ui/blur-fade";
import { DotPattern } from "@/components/ui/dot-pattern";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative mx-auto flex min-h-[60vh] max-w-lg items-center overflow-hidden px-6 py-16">
      <DotPattern
        width={20}
        height={20}
        cr={1}
        className="absolute inset-0 fill-brand-forest/[0.06] [mask-image:radial-gradient(400px_circle_at_50%_50%,white,transparent)]"
      />
      <BlurFade delay={0.05} className="relative z-10 w-full">
        <MagicCard
          className="w-full rounded-xl border border-hairline bg-surface-l1 px-8 py-10"
          gradientColor="#ecf3ee"
          gradientOpacity={0.08}
        >
          <p className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-brand-forest">
            404
          </p>
          <h1 className="mt-2 font-display text-[24px] font-bold tracking-tight text-ink-primary">
            Page not found
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-secondary">
            The page you were looking for isn&rsquo;t here. It may have moved,
            or the link may be stale.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="sm">
              <Link href="/">Back to home</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/discover">Browse suppliers</Link>
            </Button>
          </div>
        </MagicCard>
      </BlurFade>
    </main>
  );
}
