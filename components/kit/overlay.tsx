"use client";

// Overlays (`02 Components · 5`, and the phone sheets of `· 7`). The pane docks beside the
// list and never covers it (that is the shell's, B3); these are the rest. A dialog only for
// a decision that cannot be undone, everything else a toast with Undo. Radix under each,
// so focus is trapped and returned, Esc closes, and the page behind is inert.
//
// `DialogPanel` and `SheetPanel` are the drawn boxes on their own: the open overlays are
// portalled, so the gallery and the tests render these.

import { CheckCircle, X } from "@phosphor-icons/react";
import Link from "next/link";
import { Dialog as D, DropdownMenu as M, Popover as P, Tooltip as TT } from "radix-ui";
import { useRef, type ComponentProps, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";
import { ringInset } from "./classes";

/* ------------------------------------------------------------------ dialog */

const FOOTER = "flex justify-end gap-2 border-t border-line px-6 py-4";

/**
 * The box of a dialog. `confirm` is 480 wide, no close button, no edge: a question, a
 * consequence in words, two actions. `form` is the pane's width, with a close button.
 */
export function DialogPanel({
  kind = "confirm",
  title,
  description,
  children,
  footer,
  close,
  Title = "h2",
  Description = "p",
  className,
  ...rest
}: {
  kind?: "confirm" | "form";
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  close?: ReactNode;
  /** `Dialog` passes Radix's title and description so the dialog is named; the gallery draws plain ones. */
  Title?: ElementType;
  Description?: ElementType;
} & Omit<ComponentProps<"div">, "title">) {
  const form = kind === "form";
  return (
    <div className={cn("flex max-w-[calc(100vw-2rem)] flex-col rounded-lg bg-surface shadow-dialog", form ? "w-pane border border-line" : "w-dialog", className)} {...rest}>
      {form ? (
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <Title className="text-lg font-semibold text-ink">{title}</Title>
          {close}
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-6 pb-4 pt-6">
          <Title className="text-lg font-semibold text-ink">{title}</Title>
          {description ? <Description className="text-base text-ink-2">{description}</Description> : null}
        </div>
      )}
      {children ? <div className={cn(form ? "flex flex-col gap-4 px-6 pb-6 pt-2" : "px-6 pb-4 text-base text-ink-2")}>{children}</div> : null}
      {footer ? <div className={FOOTER}>{footer}</div> : null}
    </div>
  );
}

/**
 * A modal dialog. Focus starts on the control marked `data-autofocus` (the safe action in
 * a confirm: "Keep RFQ"), else on the first control.
 */
export function Dialog({
  open,
  onOpenChange,
  kind = "confirm",
  title,
  description,
  children,
  footer,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  kind?: "confirm" | "form";
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <D.Trigger asChild>{trigger}</D.Trigger> : null}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-modal bg-scrim animate-fade motion-reduce:animate-none" />
        <D.Content
          asChild
          onOpenAutoFocus={(e) => {
            const safe = content.current?.querySelector<HTMLElement>("[data-autofocus]");
            if (safe) {
              e.preventDefault();
              safe.focus();
            }
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <DialogPanel
            ref={content}
            Title={D.Title}
            Description={D.Description}
            kind={kind}
            title={title}
            description={description}
            footer={footer}
            className="fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2 outline-none animate-fade motion-reduce:animate-none"
            close={
              kind === "form" ? (
                <D.Close asChild>
                  <IconButton icon={X} label="Close" kind="quiet" />
                </D.Close>
              ) : undefined
            }
          >
            {children}
          </DialogPanel>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** A dialog's close control for a footer: wraps a button so it closes the dialog. */
export const DialogClose = D.Close;

/* ------------------------------------------------------------------- sheet */

/**
 * The box of a phone sheet. `sheet` has a handle, a title with a 44 close, rows, and an
 * action row; `confirm` is the same box with no handle and stacked 48 buttons.
 */
export function SheetPanel({
  kind = "sheet",
  title,
  description,
  children,
  footer,
  close,
  Title = "h2",
  Description = "p",
  className,
  ...rest
}: {
  kind?: "sheet" | "confirm";
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  close?: ReactNode;
  Title?: ElementType;
  Description?: ElementType;
} & Omit<ComponentProps<"div">, "title">) {
  const confirm = kind === "confirm";
  return (
    <div className={cn("flex max-h-[90dvh] w-full flex-col rounded-t-[12px] bg-surface shadow-dialog", className)} {...rest}>
      {confirm ? (
        <div className="flex flex-col gap-2 px-4 pt-5">
          <Title className="text-lg font-semibold text-ink">{title}</Title>
          {description ? <Description className="text-md text-ink-2">{description}</Description> : null}
        </div>
      ) : (
        <>
          <div className="flex justify-center pb-1 pt-2" aria-hidden>
            <div className="h-1 w-9 rounded-full bg-line-strong" />
          </div>
          <div className="flex items-center justify-between py-1 pl-4 pr-1">
            <Title className="text-lg font-semibold text-ink">{title}</Title>
            {close}
          </div>
        </>
      )}
      {children ? <div className="flex min-h-0 flex-col overflow-auto px-4">{children}</div> : null}
      {footer ? (
        <div className={cn("flex gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]", confirm ? "flex-col pt-4" : "border-t border-line pt-3")}>{footer}</div>
      ) : (
        <div className="pb-[env(safe-area-inset-bottom)]" />
      )}
    </div>
  );
}

/** A bottom sheet on a phone: filters, a confirmation. Drag-free: Close, Esc or a tap outside. */
export function Sheet({
  open,
  onOpenChange,
  kind = "sheet",
  title,
  description,
  children,
  footer,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  kind?: "sheet" | "confirm";
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <D.Trigger asChild>{trigger}</D.Trigger> : null}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-modal bg-scrim animate-fade motion-reduce:animate-none" />
        <D.Content
          asChild
          onOpenAutoFocus={(e) => {
            const safe = content.current?.querySelector<HTMLElement>("[data-autofocus]");
            if (safe) {
              e.preventDefault();
              safe.focus();
            }
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <SheetPanel
            ref={content}
            Title={D.Title}
            Description={D.Description}
            kind={kind}
            title={title}
            description={description}
            footer={footer}
            className="fixed inset-x-0 bottom-0 z-modal outline-none animate-rise motion-reduce:animate-none"
            close={
              kind === "sheet" ? (
                <D.Close asChild>
                  <IconButton icon={X} label="Close" kind="quiet" size={44} />
                </D.Close>
              ) : undefined
            }
          >
            {children}
          </SheetPanel>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* ------------------------------------------------------------------ drawer */

/**
 * The pane as a drawer, for widths where it cannot dock beside the list (under 1280):
 * full height, the pane's 640 at most, in from the right over a scrim.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  actions,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  /** Beside the close: "Open full page". */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-modal bg-scrim animate-fade motion-reduce:animate-none" />
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-modal flex w-pane max-w-full flex-col bg-surface shadow-dialog outline-none animate-sheet-in motion-reduce:animate-none"
        >
          <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-5">
            <D.Title className="text-lg font-semibold text-ink">{title}</D.Title>
            <div className="flex items-center gap-1">
              {actions}
              <D.Close asChild>
                <IconButton icon={X} label="Close" kind="quiet" />
              </D.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* -------------------------------------------------------------------- menu */

/** The menu box and its rows, shared with `Select`'s list and drawn static in the gallery. */
export const menuClass = "z-toast flex min-w-[180px] flex-col rounded-lg border border-line bg-surface p-1 shadow-menu outline-none";
export const menuItemClass =
  "flex h-8 cursor-default select-none items-center justify-between gap-2 rounded-sm px-2 text-base text-ink outline-none data-[highlighted]:bg-sunken data-[disabled]:text-disabled " +
  ringInset;
const MENU = menuClass;
const ITEM = menuItemClass;

/** A menu of actions: items 32 tall, a disabled item says why in `hint`. */
export function Menu({ trigger, children, align = "start" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content align={align} sideOffset={4} className={MENU}>
          {children}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

export function MenuItem({
  href,
  hint,
  children,
  ...rest
}: Omit<ComponentProps<typeof M.Item>, "asChild"> & { href?: string; hint?: ReactNode }) {
  const body = (
    <>
      <span>{children}</span>
      {hint ? <span className="text-xs text-disabled">{hint}</span> : null}
    </>
  );
  if (href)
    return (
      <M.Item asChild {...rest}>
        <Link href={href} className={ITEM}>
          {body}
        </Link>
      </M.Item>
    );
  return (
    <M.Item className={ITEM} {...rest}>
      {body}
    </M.Item>
  );
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px shrink-0 bg-line" />;
}

/* ------------------------------------------------- popover and tooltip */

export const popoverClass = "z-toast w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-4 shadow-menu outline-none";
export const tooltipClass = "z-toast max-w-60 rounded-sm bg-ink px-2 py-1.5 text-xs text-surface";

/** Opens on click, holds a link or a figure: a source's details. A tooltip cannot hold a link. */
export function Popover({ trigger, children, className }: { trigger: ReactNode; children: ReactNode; className?: string }) {
  return (
    <P.Root>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          sideOffset={4}
          align="start"
          className={cn(popoverClass, className)}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/**
 * A name or an expansion, 12px, on hover and keyboard focus. Never the only place a fact
 * lives: a tooltip is not reachable by touch.
 */
export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <TT.Provider delayDuration={300}>
      <TT.Root>
        <TT.Trigger asChild>{children}</TT.Trigger>
        <TT.Portal>
          <TT.Content sideOffset={6} className={tooltipClass}>
            {label}
          </TT.Content>
        </TT.Portal>
      </TT.Root>
    </TT.Provider>
  );
}

/* ------------------------------------------------------------------- toast */

/**
 * A toast, 48 tall at least, bottom centre for 5 s (the page places and times it).
 * `ink` offers Undo; `brand` only confirms the buyer's own action. An error never toasts:
 * it stays inline, next to what failed.
 */
export function Toast({
  tone = "ink",
  action,
  children,
  className,
}: {
  tone?: "ink" | "brand";
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-12 w-full max-w-[420px] items-center gap-2.5 rounded-lg text-base text-surface shadow-menu",
        tone === "ink" ? "justify-between gap-4 bg-ink pl-4 pr-2" : "bg-brand px-4",
        className,
      )}
    >
      {tone === "brand" ? <CheckCircle size={20} weight="fill" className="shrink-0" aria-hidden /> : null}
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Undo, in a toast: semibold, underlined, 32 tall. */
export const toastActionClass =
  "flex h-8 items-center rounded-sm px-3 font-semibold underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-surface";
