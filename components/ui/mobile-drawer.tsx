"use client";

// Spec R1 — MobileDrawer.
//
// Thin wrapper over <Sheet side="left"|"right"/>. Used by the topbar
// hamburger (R2) and the marketing top-nav hamburger (R3) to surface
// the full nav slot list off-canvas on phones. No new behaviour beyond
// what Sheet already provides.

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Edge to slide in from. Defaults to left (matches typical app-nav
   *  drawer convention). */
  side?: "left" | "right";
  label: string;
  children: React.ReactNode;
  className?: string;
};

export function MobileDrawer({
  open,
  onClose,
  side = "left",
  label,
  children,
  className,
}: MobileDrawerProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      side={side}
      label={label}
      // Drawers shouldn't swipe-to-close (gesture conflicts with
      // horizontal page-scroll on touch lists inside the drawer).
      swipeToClose={false}
      className={className}
    >
      {children}
    </Sheet>
  );
}
