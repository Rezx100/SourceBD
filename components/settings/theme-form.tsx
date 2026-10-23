"use client";

// Settings · Profile · Appearance: Light or Dark. A choice applies at once (the frame's `data-theme`, which
// `tailwind.config.ts` turns into the app's dark set) and is kept in a cookie the layout reads next time.

import { useState } from "react";
import { Segmented } from "@/components/kit";
import { themeCookie, type Theme } from "@/lib/theme";

export function ThemeForm({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  function choose(value: string) {
    const next: Theme = value === "dark" ? "dark" : "light";
    setTheme(next);
    document.cookie = themeCookie(next);
    const shell = document.querySelector<HTMLElement>("[data-shell]");
    if (!shell) return;
    if (next === "dark") shell.dataset.theme = "dark";
    else delete shell.dataset.theme;
  }
  return (
    <Segmented
      name="theme"
      label="Theme"
      value={theme}
      onValueChange={choose}
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}
