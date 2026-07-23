"use client";

import { useEffect, useRef, type ReactNode } from "react";

import {
  ArrowLeft,
  Buildings,
  ChatCircleText,
  CheckCircle,
  FileText,
  MapPin,
  Storefront,
} from "@phosphor-icons/react";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import {
  ProfileCard,
  ProfileSourceMark,
} from "@/components/supplier/profile-ui";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { DataList, Pill } from "@/components/ui/page-kit";
import { cn } from "@/lib/utils";

export type BuyerWorkflowScene =
  | "rfq"
  | "detail"
  | "thread"
  | "inbox";

export const BUYER_WORKFLOW_DEMO = {
  buyerName: "Oliver Bennett",
  // Knitwear factory — product-fit for French terry hoodies (not woven/denim).
  supplierName: "Crown Knitwear Ltd",
  supplierType: "Factory",
  supplierLocation: "Mymensingh",
  supplierAddress:
    "Valuka Industrial Area, Mymensingh, 2200, Mymensingh, Bangladesh",
  verifiedLine: "Verified · 4 authorities · 27 Jun 2026",
  productTitle:
    "Men's heavyweight French terry hoodies, 420gsm - 2026-07-18T18:33",
  description:
    "Hello, we are sourcing a bulk hoodie program for the UK market. We need black, charcoal, and navy colourways, private neck labels, recycled polybag packing, and confirmation on sample timing, bulk lead time, MOQ by colour, and available monthly capacity.",
  quantity: "12,000",
  unit: "pcs",
  targetUnitPrice: "8.95 USD",
  shipTo: "United Kingdom",
  shipBy: "10/30/2026",
  rfqId: "46c33de8",
  createdAt: "Created 7/18/2026",
  updatedAt: "Updated just now",
  buyerMessage:
    "Hello Imran, we are sourcing 12,000 heavyweight French terry hoodies for a UK retail program. Please confirm whether your knitwear lines can support black, charcoal, and navy with private neck labels and recycled polybag packing.",
  supplierReply:
    "Hello Oliver, yes, we can support this hoodie program. Development samples can be ready in 10 to 12 days, bulk lead time would be around 55 to 60 days after PP approval, MOQ is 2,500 pieces per colour, and we can handle private labels plus recycled polybag packing.",
  followUpDraft:
    "Thank you. Please also confirm whether you can share colour fastness and shrinkage test results once the sampling stage begins.",
  // Same French terry RFQ sent to four knit/hoodie-plausible factories.
  inboxRows: [
    {
      supplierName: "Crown Knitwear Ltd",
      supplierType: "Factory",
      count: "2 messages",
      when: "just now",
      active: true,
    },
    {
      supplierName: "Artex Fashion Limited",
      supplierType: "Factory",
      count: "1 message",
      when: "1m ago",
    },
    {
      supplierName: "S M Knitwears Limited",
      supplierType: "Factory",
      count: "0 messages",
      when: "35m ago",
    },
    {
      supplierName: "Bengal Knitcraft Ltd.",
      supplierType: "Factory",
      count: "0 messages",
      when: "39m ago",
    },
  ] satisfies readonly {
    supplierName: string;
    supplierType: string;
    count: string;
    when: string;
    active?: boolean;
  }[],
} as const;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function segment(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp01((progress - start) / (end - start));
}

function typedText(text: string, progress: number, start = 0, end = 1) {
  const pct = segment(progress, start, end);
  const count = Math.max(0, Math.floor(text.length * pct));
  return text.slice(0, count);
}

function showAt(progress: number, threshold: number) {
  return progress >= threshold;
}

function monogram(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]!.charAt(0)}${words[1]!.charAt(0)}`.toUpperCase();
}

function ChromeButton({
  children,
  tone = "ghost",
  className,
}: {
  children: ReactNode;
  tone?: "ghost" | "primary";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-semibold",
        tone === "primary"
          ? "bg-brand-forest text-white shadow-sm"
          : "border border-hairline-strong bg-surface-l1 text-ink-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}

function StaticField({
  label,
  value,
  multiline = false,
  wrap = false,
  reveal = 1,
  className,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  /** Allow long single-line values (e.g. product titles) to wrap instead of clipping. */
  wrap?: boolean;
  reveal?: number;
  className?: string;
}) {
  const shown = multiline ? typedText(value, reveal, 0, 1) : value;
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[12px] text-ink-tertiary">{label}</span>
      {multiline ? (
        // Reserve full-text height so typing reveal never grows the box / shifts the scene.
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-input border border-hairline-strong bg-white px-2 py-1 text-[12px] leading-4 text-ink-primary",
            className,
          )}
        >
          <div className="invisible whitespace-pre-wrap break-words" aria-hidden>
            {value}
          </div>
          <div className="absolute inset-0 overflow-hidden px-2 py-1 whitespace-pre-wrap break-words">
            {shown}
            {reveal < 1 ? (
              <span className="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-neutral-400 align-middle" />
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "w-full rounded-input border border-hairline-strong bg-white px-2 py-1 text-[12px] text-ink-primary",
            wrap ? "break-words whitespace-normal leading-snug" : "truncate",
            className,
          )}
        >
          {shown}
        </div>
      )}
    </label>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-24 shrink-0 text-[12px] text-ink-tertiary">{label}</span>
      <span className="text-[13px] text-ink-primary">{children}</span>
    </div>
  );
}

function ThreadBubble({
  self,
  body,
  time,
  status,
  typing,
}: {
  self?: boolean;
  body: string;
  time: string;
  status?: string;
  typing?: boolean;
}) {
  return (
    <div className={self ? "flex justify-end" : "flex justify-start"}>
      <div
        className={cn(
          "flex max-w-[92%] items-end gap-2",
          self ? "flex-row-reverse" : "flex-row",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[12px] font-semibold shadow-[0_1px_3px_rgba(15,15,20,0.08)]",
            self
              ? "border-slate-200 bg-gradient-to-br from-slate-100 to-white text-slate-700"
              : "border-brand-forest/15 bg-gradient-to-br from-brand-forest/[0.14] via-brand-forest/[0.06] to-white text-brand-forest",
          )}
          aria-hidden
        >
          {self ? monogram(BUYER_WORKFLOW_DEMO.buyerName) : monogram(BUYER_WORKFLOW_DEMO.supplierName)}
        </span>
        <div className={self ? "flex flex-col items-end" : "flex flex-col items-start"}>
          <div
            className={
              self
                ? "max-w-[86%] rounded-2xl rounded-br-sm border border-neutral-200 bg-neutral-100 px-2.5 py-1.5 text-[12px] leading-5 text-neutral-900 shadow-sm"
                : "max-w-[86%] rounded-2xl rounded-bl-sm border border-hairline bg-surface-l1 px-2.5 py-1.5 text-[12px] leading-5 text-ink-primary shadow-sm"
            }
          >
            {typing ? (
              <span className="inline-flex items-center gap-1 py-1">
                <span className="size-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:0ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:120ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:240ms]" />
              </span>
            ) : (
              body
            )}
          </div>
          <span className="mt-1 font-mono text-[12px] text-ink-tertiary">
            {time}
            {status ? <span className="ml-2">{status}</span> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

function SceneFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="h-full min-h-0 overflow-hidden rounded-[13px] bg-white p-1">
      <div className="h-full min-h-0">{children}</div>
    </div>
  );
}

/** Top + left/right hairlines only — never a bottom edge (open bottom).
 *  Inset + inherited radius so corners aren't subpixel-clipped by
 *  overflow:hidden on rounded cards. */
function FrameHairlines() {
  return (
    <div
      className="pointer-events-none absolute inset-px z-10 rounded-[inherit] border border-b-0 border-neutral-200"
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
      }}
      aria-hidden
    />
  );
}

export function CompactSupplierProfileScene() {
  return (
    <SceneFrame>
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3">
        <ProfileCard className="relative border-0 p-4 sm:p-4">
          <FrameHairlines />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <CompanyAvatar
                name={BUYER_WORKFLOW_DEMO.supplierName}
                verified
                className="shrink-0"
              />
              <div className="min-w-0">
                <h3 className="truncate font-display text-[18px] font-bold tracking-[-0.03em] text-neutral-950 sm:text-[20px]">
                  {BUYER_WORKFLOW_DEMO.supplierName}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone="neutral">{BUYER_WORKFLOW_DEMO.supplierType}</Pill>
                  <Pill tone="neutral">{BUYER_WORKFLOW_DEMO.supplierLocation}</Pill>
                  <Pill tone="forest">{BUYER_WORKFLOW_DEMO.verifiedLine}</Pill>
                </div>
                <p className="mt-3 text-[12px] font-medium text-neutral-500">
                  Registered address
                </p>
                <p className="mt-1 text-[12.5px] font-medium leading-5 text-neutral-800">
                  {BUYER_WORKFLOW_DEMO.supplierAddress}
                </p>
              </div>
            </div>
            <div className="buyer-workflow-actions">
              <ChromeButton>Follow</ChromeButton>
              <ChromeButton tone="primary">Contact supplier</ChromeButton>
            </div>
          </div>
        </ProfileCard>

        <div className="buyer-workflow-split buyer-workflow-split--profile min-h-0">
          <ProfileCard className="relative border-0 p-4 sm:p-4">
          <FrameHairlines />
            <div className="mb-3 flex flex-wrap gap-1.5">
              <ChromeButton className="bg-[#FBFAF6]">Overview</ChromeButton>
              <ChromeButton>Compliance</ChromeButton>
              <ChromeButton>Contact</ChromeButton>
              <ChromeButton>Provenance</ChromeButton>
            </div>
            <h4 className="font-display text-[15px] font-semibold text-neutral-900">
              Company overview
            </h4>
            <p className="mt-2 text-[12.5px] leading-5 text-neutral-700">
              {BUYER_WORKFLOW_DEMO.supplierName} is a knitwear manufacturer
              based in {BUYER_WORKFLOW_DEMO.supplierLocation}, Bangladesh,
              with French terry and fleece hoodie capacity.
            </p>
            <div className="mt-3 flex items-start gap-3 rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <ProfileSourceMark tag="OEKO_TEX" size="sm" />
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-neutral-500">
                  Verification
                </p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-neutral-800">
                  Corroborated by 1 independent authority across 2 source
                  records: certification from OEKO-TEX.
                </p>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard className="relative border-0 p-4 sm:p-4">
          <FrameHairlines />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-display text-[15px] font-semibold text-neutral-900">
                  Locations & addresses
                </h4>
                <p className="mt-1 text-[12px] text-neutral-500">
                  1 unique location · 2 source records
                </p>
              </div>
              <Pill tone="neutral">OEKO-TEX</Pill>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-neutral-200 bg-white px-3 py-2.5">
              <MapPin size={16} weight="duotone" className="mt-0.5 text-brand-forest" />
              <p className="text-[12.5px] leading-5 text-neutral-800">
                {BUYER_WORKFLOW_DEMO.supplierAddress}
              </p>
            </div>
          </ProfileCard>
        </div>
      </div>
    </SceneFrame>
  );
}

export function CompactRfqComposeScene({
  progress,
}: {
  progress: number;
}) {
  const buttonLabel =
    progress < 0.72 ? "Send RFQ" : progress < 0.88 ? "Sending..." : "Sent";
  return (
    <SceneFrame>
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-0.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-brand-forest">
              Buyer
            </p>
            <h3 className="mt-0.5 font-display text-[15px] font-bold tracking-[-0.03em] text-neutral-950">
              Compose RFQ
            </h3>
          </div>
          <ChromeButton>
            <ArrowLeft size={14} weight="bold" />
            Back to profile
          </ChromeButton>
        </div>

        <Card className="relative flex h-full min-h-0 flex-col border-0 shadow-none">
          <FrameHairlines />
          <CardHeader className="shrink-0 px-3 pb-0.5 pt-1.5">
            <CardTitle className="text-[12.5px]">
              New RFQ to {BUYER_WORKFLOW_DEMO.supplierName}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col justify-start px-0 pb-0 pt-0.5">
            <div className="min-h-0 space-y-1 overflow-y-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <StaticField
                label="Product title *"
                value={BUYER_WORKFLOW_DEMO.productTitle}
                wrap
              />
              <StaticField
                label="Description"
                value={BUYER_WORKFLOW_DEMO.description}
                multiline
                reveal={progress < 0.62 ? segment(progress, 0.08, 0.56) : 1}
              />

              <div className="grid grid-cols-2 gap-1">
                <StaticField label="Quantity *" value={BUYER_WORKFLOW_DEMO.quantity} />
                <StaticField label="Unit *" value={BUYER_WORKFLOW_DEMO.unit} />
              </div>

              <div className="grid grid-cols-2 gap-1">
                <StaticField
                  label="Target unit price (optional)"
                  value="8.95"
                />
                <StaticField label="Currency" value="USD" />
              </div>

              <div className="grid grid-cols-2 gap-1">
                <StaticField
                  label="Ship to country (optional)"
                  value={BUYER_WORKFLOW_DEMO.shipTo}
                />
                <StaticField
                  label="Ship by (optional)"
                  value={BUYER_WORKFLOW_DEMO.shipBy}
                />
              </div>
            </div>

            {/* Match messaging composer action padding: px-3 py-2.5 + mt-1.5 */}
            <div className="mt-1.5 flex shrink-0 items-center justify-end gap-2 px-3 py-2.5">
              <ChromeButton>Cancel</ChromeButton>
              <ChromeButton tone="primary">{buttonLabel}</ChromeButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </SceneFrame>
  );
}

export function CompactRfqDetailScene({
  progress,
}: {
  progress: number;
}) {
  return (
    <SceneFrame>
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2">
        <div className="px-0.5">
          <p className="text-[12px] text-ink-tertiary">
            RFQ · {BUYER_WORKFLOW_DEMO.rfqId}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <h3 className="line-clamp-2 font-display text-[18px] font-bold leading-tight tracking-[-0.03em] text-neutral-950">
              {BUYER_WORKFLOW_DEMO.productTitle}
            </h3>
            <Badge tone="active" className="min-w-0 px-2.5">
              Open
            </Badge>
          </div>
          <p className="mt-0.5 text-[12px] text-ink-tertiary">
            {BUYER_WORKFLOW_DEMO.createdAt} · {BUYER_WORKFLOW_DEMO.updatedAt}
          </p>
        </div>

        <div className="buyer-workflow-split buyer-workflow-split--detail min-h-0">
          <Card className="relative border-0 shadow-none">
          <FrameHairlines />
            <CardHeader className="px-3.5 pt-3">
              <CardTitle className="text-[14px]">Specification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3.5 py-2.5 text-[12px]">
              <DetailRow label="Quantity">
                {BUYER_WORKFLOW_DEMO.quantity} {BUYER_WORKFLOW_DEMO.unit}
              </DetailRow>
              <DetailRow label="Target unit price">
                {BUYER_WORKFLOW_DEMO.targetUnitPrice}
              </DetailRow>
              <DetailRow label="Ship to">{BUYER_WORKFLOW_DEMO.shipTo}</DetailRow>
              <DetailRow label="Ship by">{BUYER_WORKFLOW_DEMO.shipBy}</DetailRow>
              <div className="space-y-1 pt-1">
                <p className="text-[12px] text-ink-tertiary">Description</p>
                <p className="line-clamp-3 text-[12px] leading-5 text-ink-primary">
                  {BUYER_WORKFLOW_DEMO.description}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid min-h-0 gap-2">
            <Card className="relative border-0 shadow-none">
          <FrameHairlines />
              <CardHeader className="px-3.5 pt-3">
                <CardTitle className="text-[14px]">Targeted suppliers</CardTitle>
                <CardMeta>1 supplier</CardMeta>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <Storefront
                    size={14}
                    weight="duotone"
                    className="text-accent-indigo"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[12px] font-semibold text-ink-primary">
                      {BUYER_WORKFLOW_DEMO.supplierName}
                    </p>
                    <p className="truncate text-[12px] text-ink-tertiary">
                      Factory · {BUYER_WORKFLOW_DEMO.supplierLocation}
                    </p>
                  </div>
                  <ChromeButton tone={progress > 0.45 ? "primary" : "ghost"}>
                    Thread
                  </ChromeButton>
                </div>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-none">
          <FrameHairlines />
              <CardHeader className="px-3.5 pt-3">
                <CardTitle className="text-[14px]">Quotes</CardTitle>
                <CardMeta>0 submitted</CardMeta>
              </CardHeader>
              <CardContent className="flex items-center justify-center gap-2 px-3.5 py-4 text-[12px] text-ink-secondary">
                <FileText size={16} weight="duotone" className="text-ink-tertiary" />
                No quotes yet.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

function ThreadSurface({
  messages,
  draft,
  status,
  typing,
  draftProgress = 1,
  sending = false,
  backTone = "ghost",
  backPressed = false,
}: {
  messages: readonly { body: string; self?: boolean; time: string }[];
  draft?: string;
  status?: string;
  typing?: boolean;
  draftProgress?: number;
  sending?: boolean;
  backTone?: "ghost" | "primary";
  backPressed?: boolean;
}) {
  const draftText = draft ? typedText(draft, draftProgress, 0, 1) : "";
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll only the message well — never the document (avoids /home-demo page jerk).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length, typing]);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1.5">
      {/* Same width as the card below — no stepped chrome inset. */}
      <header className="flex w-full items-center justify-between gap-2">
        <ChromeButton
          tone={backTone}
          className={backPressed ? "translate-y-px shadow-none" : undefined}
        >
          <ArrowLeft size={14} weight="bold" />
          Back to inbox
        </ChromeButton>
        <ChromeButton>View profile</ChromeButton>
      </header>

      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-card border-0 bg-surface-l1 shadow-none">
        <FrameHairlines />
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-[14px] font-semibold tracking-[-0.01em] text-ink-primary">
                {BUYER_WORKFLOW_DEMO.supplierName}
              </h3>
              <Pill tone="neutral">{BUYER_WORKFLOW_DEMO.supplierType}</Pill>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-tertiary">
              {BUYER_WORKFLOW_DEMO.productTitle}
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
          <div
            ref={listRef}
            className="min-h-0 space-y-2.5 overflow-x-hidden overflow-y-auto bg-bg-l0 px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {messages.length === 0 ? (
              <p className="flex min-h-full items-center justify-center text-center text-[12px] text-ink-tertiary">
                No messages yet. Send the first one below.
              </p>
            ) : (
              messages.map((message, index) => (
                <ThreadBubble
                  key={`${message.time}-${index}`}
                  self={message.self}
                  body={message.body}
                  time={message.time}
                  status={message.self ? status : undefined}
                />
              ))
            )}
            {typing ? <ThreadBubble body="" time="now" typing /> : null}
          </div>

          <div className="border-t border-hairline bg-surface-l1 px-3 py-2.5">
            <div className="min-h-[54px] rounded-md border border-hairline-strong bg-bg-l0 px-2.5 py-1.5 text-[12px] leading-5 text-ink-primary">
              {draft ? (
                <>
                  {draftText}
                  {draftProgress < 1 ? (
                    <span className="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-neutral-400 align-middle" />
                  ) : null}
                </>
              ) : (
                <span className="text-ink-tertiary">Write a message...</span>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[12px] text-ink-tertiary">
                {draft ? `${draftText.length}/8000` : "0/8000"}
              </span>
              <ChromeButton tone="primary">
                {sending ? "Sending..." : "Send"}
              </ChromeButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompactThreadScene({
  progress,
}: {
  progress: number;
}) {
  const draftProgress = segment(progress, 0.04, 0.32);
  const buyerSending = progress >= 0.32 && progress < 0.38;
  const buyerSent = showAt(progress, 0.38);
  const supplierTyping = progress >= 0.46 && progress < 0.58;
  const supplierReply = showAt(progress, 0.58)
    ? BUYER_WORKFLOW_DEMO.supplierReply
    : "";
  const backTone = progress >= 0.88 ? "primary" : "ghost";
  const backPressed = progress >= 0.93;
  const messageStatus =
    progress < 0.38 ? "Drafting" : progress < 0.52 ? "Not seen" : "Seen";
  return (
    <SceneFrame>
      <ThreadSurface
        messages={[
          ...(buyerSent
            ? [
                {
                  body: BUYER_WORKFLOW_DEMO.buyerMessage,
                  self: true,
                  time: "Jul 19, 12:33 AM",
                },
              ]
            : []),
          ...(supplierReply
            ? [
                {
                  body: supplierReply,
                  time: "Jul 19, 12:34 AM",
                },
              ]
            : []),
        ]}
        draft={buyerSent ? undefined : BUYER_WORKFLOW_DEMO.buyerMessage}
        draftProgress={draftProgress}
        sending={buyerSending}
        typing={supplierTyping}
        status={buyerSent ? messageStatus : "Drafting"}
        backTone={backTone}
        backPressed={backPressed}
      />
    </SceneFrame>
  );
}

export function CompactInboxScene({
  progress,
}: {
  progress: number;
}) {
  return (
    <SceneFrame>
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-brand-forest">
              Buyer
            </p>
            <h3 className="mt-0.5 font-display text-[18px] font-bold tracking-[-0.03em] text-neutral-950">
              Messages
            </h3>
          </div>
          <Pill tone="forest">
            <CheckCircle size={14} weight="fill" />
            Thread updated
          </Pill>
        </div>

        <DataList className="relative border-0 shadow-none">
          <FrameHairlines />
          {BUYER_WORKFLOW_DEMO.inboxRows.map((row, index) => (
            <li
              key={`${row.supplierName}-${index}`}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 transition-colors",
                row.active && progress > 0.16 && "bg-brand-forest-tint/40",
              )}
            >
              <ChatCircleText
                size={15}
                weight="duotone"
                className="shrink-0 text-brand-forest"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-[13px] font-semibold text-ink-primary">
                    {row.supplierName}
                  </span>
                  <Pill tone="neutral">{row.supplierType}</Pill>
                </div>
                <p className="mt-0.5 truncate text-[12.5px] font-medium leading-5 text-neutral-600">
                  {BUYER_WORKFLOW_DEMO.productTitle} · {row.count}
                </p>
              </div>
              <span className="shrink-0 text-[12px] text-ink-tertiary">
                {row.when}
              </span>
            </li>
          ))}
        </DataList>
      </div>
    </SceneFrame>
  );
}

export function BuyerWorkflowSceneView({
  scene,
  progress,
  reduce,
}: {
  scene: BuyerWorkflowScene;
  progress: number;
  reduce?: boolean;
}) {
  const resolvedProgress = reduce ? 1 : progress;
  if (scene === "rfq") return <CompactRfqComposeScene progress={resolvedProgress} />;
  if (scene === "detail") return <CompactRfqDetailScene progress={resolvedProgress} />;
  if (scene === "thread") return <CompactThreadScene progress={resolvedProgress} />;
  return <CompactInboxScene progress={resolvedProgress} />;
}

export function BuyerWorkflowStageCaption() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        "Supplier profile -> Contact supplier",
        "Compose RFQ with real quantity, price, and ship-by fields",
        "Thread opens from the RFQ detail screen",
        "Buyer message -> supplier reply -> buyer follow-up",
      ].map((line) => (
        <div
          key={line}
          className="flex items-center gap-2 rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12.5px] font-medium text-neutral-700"
        >
          <Buildings size={14} weight="duotone" className="text-brand-forest" />
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
}
