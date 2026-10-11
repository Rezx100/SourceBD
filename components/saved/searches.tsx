"use client";

// The saved searches (Paper `10 · Saved · saved searches`, `11 · Saved · searches`): each is its
// name, its filters in words, how many suppliers it finds (a remembered count, and the row says
// when it was taken), Run search, and a menu with Rename and Delete. Rename is a name field in a
// dialog (a sheet on a phone); only the name changes, never the filters. Delete asks first (a dialog;
// a sheet on a phone) because a deleted search cannot be brought back. "Email me new matches every
// Monday" is a switch saved at once (0113's `alert_weekly`, sent by the Monday job,
// lib/email/jobs/saved-search-alerts.ts); it is drawn only when the database answered it.

import { DotsThree, MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, ButtonLink, Dialog, Field, IconButton, Input, Menu, MenuItem, Sheet, Switch } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import { alertWords, type SearchItem } from "./words";

function useDelete(item: SearchItem) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/saved-searches?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete it. Nothing was removed. Try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not delete it. Nothing was removed. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { open, setOpen, busy, error, run };
}

function useRename(item: SearchItem) {
  const router = useRouter();
  const [open, setOpenState] = useState(false);
  const [name, setName] = useState(item.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every opening starts from the name the search has now, with no old refusal on it.
  const setOpen = (next: boolean) => {
    if (!next && busy) return; // a save in flight finishes (or fails) where the buyer can see it
    if (next) {
      setName(item.name);
      setError(null);
    }
    setOpenState(next);
  };
  const run = async () => {
    const next = name.trim();
    if (busy || !next) return;
    if (next === item.name) {
      setOpenState(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/saved-searches", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, name: next }) });
      if (!res.ok) {
        setError(res.status === 404 ? "This search is gone. Reload the page." : "Could not rename it. The name was not changed. Try again.");
        return;
      }
      setOpenState(false);
      router.refresh();
    } catch {
      setError("Could not rename it. There is no connection. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { open, setOpen, name, setName, busy, error, run };
}

/** "Email me new matches every Monday": saved at once (`PATCH {id, alert_weekly}`); a refusal puts the switch back and says why. */
function useAlert(item: SearchItem) {
  const router = useRouter();
  const [on, setOn] = useState(item.alert === true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/saved-searches", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, alert_weekly: next }) });
      if (!res.ok) {
        setError(res.status === 404 ? "This search is gone. Reload the page." : "Could not change that. The switch was not saved. Try again.");
        return;
      }
      setOn(next);
      router.refresh();
    } catch {
      setError("Could not change that. There is no connection. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { shown: item.alert !== null, on, busy, error, set };
}

function AlertSwitch({ a, phone }: { a: ReturnType<typeof useAlert>; phone: boolean }) {
  if (!a.shown) return null;
  return (
    <div className="flex flex-col gap-1">
      <Switch size={phone ? "touch" : "md"} className={phone ? "border-y-0 py-0" : undefined} checked={a.on} disabled={a.busy} onChange={(e) => void a.set(e.currentTarget.checked)}>
        {alertWords(a.on)}
      </Switch>
      <p role="status" aria-live="polite" className={a.error ? "text-sm text-danger" : "sr-only"}>
        {a.error ?? ""}
      </p>
    </div>
  );
}

function RenameDialog({ item, r }: { item: SearchItem; r: ReturnType<typeof useRename> }) {
  const phone = useIsPhone();
  const id = useId();
  const body = (
    <form
      id={`${id}-rename`}
      onSubmit={(e) => {
        e.preventDefault();
        void r.run();
      }}
      className="flex flex-col gap-2"
    >
      <Field label="Name">
        {(a) => (
          <Input {...a} name="name" value={r.name} onChange={(e) => r.setName(e.target.value)} onFocus={(e) => e.currentTarget.select()} maxLength={120} required autoFocus size={phone ? "touch" : "md"} />
        )}
      </Field>
      <p role="status" aria-live="polite" className={r.error ? "text-sm text-danger" : "sr-only"}>
        {r.error ?? ""}
      </p>
    </form>
  );
  const save = (
    <Button type="submit" form={`${id}-rename`} kind="primary" size={phone ? "touch" : "md"} full={phone} loading={r.busy} loadingLabel="Saving" disabled={!r.name.trim()}>
      Save name
    </Button>
  );
  const cancel = (
    <Button kind={phone ? "secondary" : "quiet"} size={phone ? "touch" : "md"} full={phone} onClick={() => r.setOpen(false)}>
      Cancel
    </Button>
  );
  return phone ? (
    <Sheet open={r.open} onOpenChange={r.setOpen} title={`Rename “${item.name}”`} footer={<>{save}{cancel}</>}>
      {body}
    </Sheet>
  ) : (
    <Dialog open={r.open} onOpenChange={r.setOpen} kind="form" title="Rename this search" footer={<>{cancel}{save}</>}>
      {body}
    </Dialog>
  );
}

function DeleteConfirm({ item, d }: { item: SearchItem; d: ReturnType<typeof useDelete> }) {
  const phone = useIsPhone();
  const title = `Delete “${item.name}”?`;
  const body = (
    <>
      <p>It is removed from your saved searches and cannot be brought back. Run it again from search to save it anew.</p>
      {d.error ? (
        <p role="alert" className="pt-2 text-sm text-danger">
          {d.error}
        </p>
      ) : null}
    </>
  );
  return phone ? (
    <Sheet
      open={d.open}
      onOpenChange={d.setOpen}
      kind="confirm"
      title={title}
      footer={
        <>
          <Button kind="danger" size="touch" full loading={d.busy} loadingLabel="Deleting" onClick={d.run}>
            Delete search
          </Button>
          <Button kind="secondary" size="touch" full data-autofocus onClick={() => d.setOpen(false)}>
            Keep search
          </Button>
        </>
      }
    >
      {body}
    </Sheet>
  ) : (
    <Dialog
      open={d.open}
      onOpenChange={d.setOpen}
      kind="confirm"
      title={title}
      footer={
        <>
          <Button kind="secondary" data-autofocus onClick={() => d.setOpen(false)}>
            Keep search
          </Button>
          <Button kind="danger" loading={d.busy} loadingLabel="Deleting" onClick={d.run}>
            Delete search
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}

function RowMenu({ item, d, r }: { item: SearchItem; d: ReturnType<typeof useDelete>; r: ReturnType<typeof useRename> }) {
  return (
    <Menu align="end" trigger={<IconButton icon={DotsThree} label={`More actions for ${item.name}`} kind="quiet" className="max-md:size-11" />}>
      <MenuItem href={item.runHref}>Run search</MenuItem>
      <MenuItem onSelect={() => r.setOpen(true)}>Rename search</MenuItem>
      <MenuItem onSelect={() => d.setOpen(true)}>Delete search</MenuItem>
    </Menu>
  );
}

/** What it finds: "101" over "suppliers today", or the count's age. */
function Count({ item }: { item: SearchItem }) {
  return (
    <div className="flex w-[140px] shrink-0 flex-col items-end max-md:w-auto">
      {item.count ? <p className="text-lg font-semibold tabular-nums text-ink">{item.count}</p> : <p className="text-lg font-semibold text-ink-3">—</p>}
      <p className="text-xs text-ink-3">{item.countWords}</p>
    </div>
  );
}

function SearchRow({ item }: { item: SearchItem }) {
  const d = useDelete(item);
  const r = useRename(item);
  const a = useAlert(item);
  return (
    <li className="border-b border-line">
      <div className="flex items-center gap-6 py-4 max-md:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-md font-semibold text-ink [overflow-wrap:anywhere]">{item.name}</p>
          <p className="text-sm text-ink-2">{item.filters}</p>
          <AlertSwitch a={a} phone={false} />
        </div>
        <Count item={item} />
        <div className="flex shrink-0 items-center gap-2">
          <ButtonLink href={item.runHref} prefetch={false}>
            Run search
          </ButtonLink>
          <RowMenu item={item} d={d} r={r} />
        </div>
      </div>
      <div className="flex flex-col gap-2.5 p-4 md:hidden">
        <div className="-mr-2 -mt-2 flex items-start justify-between gap-3">
          <p className="pt-2 text-md/[22px] font-medium text-ink [overflow-wrap:anywhere]">{item.name}</p>
          <RowMenu item={item} d={d} r={r} />
        </div>
        <p className="text-sm text-ink-2">{item.filters}</p>
        <AlertSwitch a={a} phone />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-3">
            {item.count ? (
              <>
                <span className="font-medium tabular-nums text-ink">{item.count}</span> {item.countWords}
              </>
            ) : (
              item.countWords
            )}
          </p>
          <ButtonLink href={item.runHref} prefetch={false} kind="quiet" className="h-11 gap-1.5 rounded-full bg-sunken px-3.5 text-base text-ink active:bg-line">
            <MagnifyingGlass size={16} className="shrink-0" aria-hidden />
            Run search
          </ButtonLink>
        </div>
      </div>
      <RenameDialog item={item} r={r} />
      <DeleteConfirm item={item} d={d} />
    </li>
  );
}

export function SearchList({ items }: { items: readonly SearchItem[] }) {
  return (
    <>
      {/* A phone draws them as one card (Paper page 36, `saved-searches`). */}
      <ul aria-label="Saved searches" className="px-6 py-2 max-md:mx-5 max-md:overflow-clip max-md:rounded-[10px] max-md:border max-md:border-line max-md:p-0 max-md:[&>li:last-child]:border-b-0">
        {items.map((i) => (
          <SearchRow key={i.id} item={i} />
        ))}
      </ul>
      {items.some((i) => i.alert !== null) ? <p className="px-5 pb-6 pt-4 text-xs text-ink-3 md:hidden">Alert emails go out on Monday, only when something new matches.</p> : null}
    </>
  );
}
