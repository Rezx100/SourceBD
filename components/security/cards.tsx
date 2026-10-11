"use client";

// Security's three cards (Paper `10 · Settings · Security`): two-step sign-in (a dialog with the QR code, a
// sheet on a phone), where you're signed in (this device first, Sign out for each other one, Sign out
// everywhere else) and the password row. Every write is a server action in `./actions`; a refusal is a
// sentence under the field or beside the button, and a failed read is said, never an empty list.

import { CaretRight, Desktop, DeviceMobile, Globe, Key, Lock, Shield, ShieldCheck, ShieldWarning } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button, Dialog, Field, Input, Sheet } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import { PHONE_PILL } from "@/components/settings/phone";
import { cn } from "@/lib/utils";
import { cancelTwoStep, endDevice, finishTwoStep, signOutOtherDevices, startTwoStep, turnOffTwoStep, type Started } from "./actions";
import { SECURITY_COPY, deviceLabel, deviceLine, type Device, type Factor } from "./model";

const row = "flex items-center gap-3 border-b border-line py-3 last:border-b-0 max-md:min-h-16 max-md:border-b-0 max-md:border-t max-md:py-2.5 max-md:pl-4 max-md:pr-3 max-md:first:border-t-0";
const touch = "max-md:h-input-touch max-md:text-md";

/** Dialog from 768, sheet under it: one body, two frames. */
function Modal({ title, description, onClose, footer, children }: { title: string; description?: ReactNode; onClose: () => void; footer: ReactNode; children: ReactNode }) {
  const phone = useIsPhone();
  const onOpenChange = (open: boolean) => !open && onClose();
  return phone ? (
    <Sheet open onOpenChange={onOpenChange} title={title} description={description} footer={footer}>
      {children}
    </Sheet>
  ) : (
    <Dialog open onOpenChange={onOpenChange} kind="form" title={title} description={description} footer={footer}>
      {children}
    </Dialog>
  );
}

function CodeField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string | null }) {
  return (
    <Field label="Code" error={error} help="The 6 digits your app shows now.">
      {(a) => <Input {...a} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={value} onChange={(e) => onChange(e.target.value)} className={`font-mono tracking-widest ${touch}`} />}
    </Field>
  );
}

// --------------------------------------------------------------------------- two-step

function TurnOn({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [started, setStarted] = useState<Started | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const factor = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    void startTwoStep().then((s) => {
      if (!live) return;
      if (s.factorId) factor.current = s.factorId;
      setStarted(s);
    });
    return () => {
      live = false;
    };
  }, []);
  const close = () => {
    // Closing before the code removes the unfinished factor; a finished one is kept.
    if (factor.current) void cancelTwoStep(factor.current);
    onClose();
  };
  const submit = () =>
    startTransition(async () => {
      if (!started || !started.factorId) return;
      setError(null);
      const r = await finishTwoStep(started.factorId, code);
      if (!r.ok) return setError(r.error);
      factor.current = null;
      router.refresh();
      onClose();
    });
  const ready = Boolean(started && started.factorId);
  return (
    <Modal
      title="Turn on two-step sign-in"
      description="Scan the code with an authenticator app (1Password, Google Authenticator, Authy), then enter the 6 digits it shows."
      onClose={close}
      footer={
        <>
          <Button kind="secondary" size="md" className={touch} onClick={close}>
            Cancel
          </Button>
          <Button kind="primary" size="md" className={touch} loading={busy} loadingLabel="Checking" disabled={!ready || code.replace(/\s+/g, "").length < 6} onClick={submit}>
            Turn on
          </Button>
        </>
      }
    >
      {started === null ? <p className="text-base text-ink-3">Preparing your code&hellip;</p> : null}
      {started && started.error ? <p role="alert" className="text-sm text-danger">{started.error}</p> : null}
      {started && started.factorId ? (
        <div className="flex flex-col gap-4">
          {/* Auth's own SVG, as a data address: nothing here builds markup from it. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: SVG is not an optimisable image. */}
          <img src={started.qr} alt="QR code for your authenticator app" width={176} height={176} className="size-44 rounded-md border border-line bg-surface p-2" />
          <p className="text-sm text-ink-3">
            Can&rsquo;t scan it? Enter this key instead: <span className="font-mono text-ink [overflow-wrap:anywhere]">{started.secret}</span>
          </p>
          <CodeField value={code} onChange={setCode} error={error} />
          <p className="text-sm text-ink-3">{SECURITY_COPY.lostPhone}</p>
        </div>
      ) : null}
    </Modal>
  );
}

function TurnOff({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await turnOffTwoStep(code);
      if (!r.ok) return setError(r.error);
      router.refresh();
      onClose();
    });
  return (
    <Modal
      title="Turn off two-step sign-in"
      description="Enter a code from your app to turn it off. Your account is then protected by your password alone."
      onClose={onClose}
      footer={
        <>
          <Button kind="secondary" size="md" className={touch} onClick={onClose}>
            Cancel
          </Button>
          <Button kind="danger" size="md" className={touch} loading={busy} loadingLabel="Turning off" disabled={code.replace(/\s+/g, "").length < 6} onClick={submit}>
            Turn off
          </Button>
        </>
      }
    >
      <CodeField value={code} onChange={setCode} error={error} />
    </Modal>
  );
}

export function TwoStepCard({ factors }: { factors: Factor[] | null }) {
  const [dialog, setDialog] = useState<"on" | "off" | null>(null);
  const on = factors?.some((f) => f.verified) ?? false;
  const words = factors === null ? "We couldn't load this setting just now. Nothing was changed." : on ? SECURITY_COPY.twoStepOn : SECURITY_COPY.twoStepOff;
  return (
    <>
      {/* Paper `11 · Security`: the state on top (Off in caution), the name, what it does, the pill. */}
      <section aria-label="Two-step sign-in" className="flex flex-col gap-2.5 rounded-[10px] border border-line p-4 md:hidden">
        {factors ? (
          <p className={cn("flex items-center gap-1.5 text-xs font-medium", on ? "text-brand-ink" : "text-caution")}>
            {on ? <ShieldCheck size={16} className="shrink-0" aria-hidden /> : <ShieldWarning size={16} className="shrink-0 text-caution-icon" aria-hidden />}
            {on ? "On" : "Off"}
          </p>
        ) : null}
        <h2 className="text-md/[22px] font-medium text-ink">Two-step sign-in</h2>
        <p className="text-sm text-ink-2">{words}</p>
        {on ? <p className="text-sm text-ink-3">{SECURITY_COPY.lostPhone}</p> : null}
        {factors ? (
          <div>
            <Button className={PHONE_PILL} onClick={() => setDialog(on ? "off" : "on")}>
              {on ? "Turn off" : "Turn on"}
            </Button>
          </div>
        ) : null}
      </section>
    <section aria-label="Two-step sign-in" className="flex flex-col gap-3 rounded-lg border border-line p-5 max-md:hidden">
      <div className="flex items-start gap-3">
        <Shield size={20} className={on ? "mt-0.5 shrink-0 text-brand-ink" : "mt-0.5 shrink-0 text-caution-icon"} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="flex items-center gap-2 text-md font-semibold text-ink">
            Two-step sign-in
            {factors ? <span className={on ? "text-sm font-medium text-brand-ink" : "text-sm font-medium text-ink-3"}>{on ? "On" : "Off"}</span> : null}
          </h2>
          <p className="text-base text-ink-2">{words}</p>
          {on ? <p className="pt-1 text-sm text-ink-3">{SECURITY_COPY.lostPhone}</p> : null}
        </div>
        {factors ? (
          <Button kind={on ? "secondary" : "primary"} size="md" className={touch} onClick={() => setDialog(on ? "off" : "on")}>
            {on ? "Turn off" : "Turn on"}
          </Button>
        ) : null}
      </div>
    </section>
      {dialog === "on" ? <TurnOn onClose={() => setDialog(null)} /> : null}
      {dialog === "off" ? <TurnOff onClose={() => setDialog(null)} /> : null}
    </>
  );
}

// --------------------------------------------------------------------------- password

export function PasswordRow() {
  return (
    <>
      {/* Paper `11 · Security`: the whole row goes to Profile. */}
      <Link href="/app/settings/profile" className="flex min-h-[60px] items-center gap-3 rounded-[10px] border border-line px-4 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:bg-sunken md:hidden">
        <span className="flex w-6 shrink-0 justify-center">
          <Key size={20} className="text-ink-2" aria-hidden />
        </span>
        <span className="flex min-w-0 grow basis-0 flex-col">
          <span className="text-md/[22px] text-ink">Password</span>
          <span className="text-sm text-ink-3">{SECURITY_COPY.passwordPhone}</span>
        </span>
        <CaretRight size={16} className="shrink-0 text-ink-3" aria-hidden />
      </Link>
    <section aria-label="Password" className="flex items-center gap-3 rounded-lg border border-line p-5 max-md:hidden">
      <Lock size={20} className="shrink-0 text-ink-2" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-md font-semibold text-ink">Password</h2>
        <p className="text-base text-ink-2">{SECURITY_COPY.passwordNote}</p>
      </div>
      <Link href="/app/settings/profile" prefetch={false} className="flex h-control items-center rounded-sm border border-line-strong px-3 text-base font-medium text-ink hover:bg-subtle max-md:h-input-touch max-md:text-md">
        Change password
      </Link>
    </section>
    </>
  );
}

// --------------------------------------------------------------------------- devices

function DeviceRow({ d, onEnded }: { d: Device; onEnded: (words: string | null, error: string | null) => void }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const mobile = /iphone|android|ipad/i.test(d.agent ?? "");
  const Glyph = mobile ? DeviceMobile : Desktop;
  const end = () =>
    startTransition(async () => {
      const r = await endDevice(d.id);
      if (!r.ok) return onEnded(null, r.error);
      onEnded(SECURITY_COPY.ended, null);
      router.refresh();
    });
  return (
    <li className={row}>
      <span className="flex shrink-0 justify-center max-md:w-6">
        <Glyph size={20} className="text-ink-2 max-md:hidden" aria-hidden />
        {mobile ? <DeviceMobile size={20} className="text-ink-2 md:hidden" aria-hidden /> : <Globe size={20} className="text-ink-2 md:hidden" aria-hidden />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-base font-medium text-ink max-md:text-md/[22px] max-md:font-normal">{deviceLabel(d)}</p>
        <p className="text-sm text-ink-3 max-md:first-letter:uppercase">{d.current ? `This browser · ${deviceLine(d)}` : deviceLine(d)}</p>
      </div>
      {d.current ? null : (
        <Button kind="secondary" size="md" className={PHONE_PILL} loading={busy} loadingLabel="Signing out" onClick={end} aria-label={`Sign out ${deviceLabel(d)}`}>
          Sign out
        </Button>
      )}
    </li>
  );
}

export function DevicesCard({ devices }: { devices: Device[] | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const others = devices?.filter((d) => !d.current).length ?? 0;
  const told = (words: string | null, err: string | null) => {
    setStatus(words);
    setError(err);
  };
  const everywhere = () =>
    startTransition(async () => {
      const r = await signOutOtherDevices();
      if (!r.ok) return told(null, r.error);
      told(SECURITY_COPY.signedOutOthers, null);
      router.refresh();
    });
  return (
    <section aria-label="Where you're signed in" className="flex flex-col gap-2 rounded-lg border border-line p-5 max-md:gap-3 max-md:rounded-none max-md:border-0 max-md:p-0">
      <h2 className="flex items-baseline gap-2 pt-3 text-lg font-medium tracking-tight text-ink md:hidden">
        Where you&rsquo;re signed in
        {devices ? <span className="font-normal tracking-normal text-ink-3">{devices.length}</span> : null}
      </h2>
      <div className="flex items-center justify-between gap-3 max-md:hidden">
        <div className="flex flex-col">
          <h2 className="text-md font-semibold text-ink">Where you&rsquo;re signed in</h2>
          {devices ? <p className="text-sm text-ink-3">{devices.length === 1 ? "1 device" : `${devices.length} devices`}</p> : null}
        </div>
        {others > 0 ? (
          <Button kind="secondary" size="md" className={touch} loading={busy} loadingLabel="Signing out" onClick={everywhere}>
            Sign out everywhere else
          </Button>
        ) : null}
      </div>
      {devices === null ? (
        <p role="alert" className="py-2 text-base text-ink-2">
          We couldn&rsquo;t load your devices just now. Nothing was changed.
        </p>
      ) : (
        <ul className="flex flex-col max-md:overflow-clip max-md:rounded-[10px] max-md:border max-md:border-line">
          {devices.map((d) => (
            <DeviceRow key={d.id} d={d} onEnded={told} />
          ))}
        </ul>
      )}
      {others > 0 ? (
        <div className="md:hidden">
          <Button className={PHONE_PILL} loading={busy} loadingLabel="Signing out" onClick={everywhere}>
            Sign out everywhere else
          </Button>
        </div>
      ) : null}
      {status ? <p role="status" className="text-sm text-ink-2">{status}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}
