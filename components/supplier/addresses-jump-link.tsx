"use client";

export function AddressesJumpLink({ count }: { count: number }) {
  function jump() {
    const trigger = document.getElementById("tab-trigger-overview");
    if (trigger) trigger.click();
    requestAnimationFrame(() => {
      setTimeout(() => {
        const target = document.getElementById("locations");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 60);
    });
  }
  return (
    <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--ink-tertiary)" }}>
      <button
        type="button"
        onClick={jump}
        style={{
          color: "var(--brand-forest)",
          fontWeight: 600,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 11,
        }}
      >
        + {count} other address{count === 1 ? "" : "es"} on file →
      </button>
    </p>
  );
}
