"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import shot01 from "@/artifacts/buyer-message-audit-success/01-buyer-supplier-profile.png";
import shot02 from "@/artifacts/buyer-message-audit-success/02-buyer-rfq-form.png";
import shot03 from "@/artifacts/buyer-message-audit-success/03-buyer-rfq-filled.png";
import shot04 from "@/artifacts/buyer-message-audit-success/04-buyer-rfq-detail.png";
import shot05 from "@/artifacts/buyer-message-audit-success/05-buyer-inbox-thread-listed.png";
import shot06 from "@/artifacts/buyer-message-audit-success/06-buyer-thread-opened.png";
import shot07 from "@/artifacts/buyer-message-audit-success/07-buyer-message-draft.png";
import shot08 from "@/artifacts/buyer-message-audit-success/08-buyer-message-sent.png";
import shot09 from "@/artifacts/buyer-message-audit-success/09-buyer-received-reply.png";
import shot10 from "@/artifacts/buyer-message-audit-success/10-buyer-follow-up-draft.png";
import shot11 from "@/artifacts/buyer-message-audit-success/11-buyer-follow-up-sent.png";
import shot12 from "@/artifacts/buyer-message-audit-success/12-buyer-inbox-updated.png";

type StaticShot = {
  src: string;
  width: number;
  height: number;
};

type FocusFrame = {
  scale: number;
  focusX: number;
  focusY: number;
};

type Shot = {
  id: string;
  src: StaticShot;
  durationMs: number;
  overlapMs: number;
  from: FocusFrame;
  to: FocusFrame;
  action: {
    x: number;
    y: number;
  };
};

const SHOTS: readonly Shot[] = [
  {
    id: "01",
    src: shot01,
    durationMs: 2500,
    overlapMs: 520,
    from: { scale: 1.12, focusX: 0.64, focusY: 0.18 },
    to: { scale: 1.34, focusX: 0.86, focusY: 0.22 },
    action: { x: 0.9, y: 0.2 },
  },
  {
    id: "02",
    src: shot02,
    durationMs: 1900,
    overlapMs: 420,
    from: { scale: 1.18, focusX: 0.54, focusY: 0.22 },
    to: { scale: 1.34, focusX: 0.57, focusY: 0.36 },
    action: { x: 0.58, y: 0.33 },
  },
  {
    id: "03",
    src: shot03,
    durationMs: 2400,
    overlapMs: 520,
    from: { scale: 1.28, focusX: 0.61, focusY: 0.48 },
    to: { scale: 1.58, focusX: 0.74, focusY: 0.72 },
    action: { x: 0.82, y: 0.67 },
  },
  {
    id: "04",
    src: shot04,
    durationMs: 2200,
    overlapMs: 480,
    from: { scale: 1.16, focusX: 0.63, focusY: 0.34 },
    to: { scale: 1.46, focusX: 0.86, focusY: 0.56 },
    action: { x: 0.91, y: 0.54 },
  },
  {
    id: "05",
    src: shot05,
    durationMs: 1800,
    overlapMs: 420,
    from: { scale: 1.12, focusX: 0.58, focusY: 0.29 },
    to: { scale: 1.34, focusX: 0.55, focusY: 0.32 },
    action: { x: 0.64, y: 0.31 },
  },
  {
    id: "06",
    src: shot06,
    durationMs: 1900,
    overlapMs: 440,
    from: { scale: 1.22, focusX: 0.6, focusY: 0.45 },
    to: { scale: 1.5, focusX: 0.66, focusY: 0.73 },
    action: { x: 0.71, y: 0.72 },
  },
  {
    id: "07",
    src: shot07,
    durationMs: 2400,
    overlapMs: 540,
    from: { scale: 1.34, focusX: 0.61, focusY: 0.69 },
    to: { scale: 1.62, focusX: 0.75, focusY: 0.74 },
    action: { x: 0.82, y: 0.73 },
  },
  {
    id: "08",
    src: shot08,
    durationMs: 1900,
    overlapMs: 440,
    from: { scale: 1.22, focusX: 0.62, focusY: 0.48 },
    to: { scale: 1.44, focusX: 0.72, focusY: 0.5 },
    action: { x: 0.73, y: 0.53 },
  },
  {
    id: "09",
    src: shot09,
    durationMs: 2500,
    overlapMs: 560,
    from: { scale: 1.22, focusX: 0.55, focusY: 0.35 },
    to: { scale: 1.42, focusX: 0.43, focusY: 0.32 },
    action: { x: 0.47, y: 0.37 },
  },
  {
    id: "10",
    src: shot10,
    durationMs: 2400,
    overlapMs: 540,
    from: { scale: 1.34, focusX: 0.62, focusY: 0.69 },
    to: { scale: 1.62, focusX: 0.75, focusY: 0.74 },
    action: { x: 0.82, y: 0.73 },
  },
  {
    id: "11",
    src: shot11,
    durationMs: 1900,
    overlapMs: 440,
    from: { scale: 1.22, focusX: 0.61, focusY: 0.46 },
    to: { scale: 1.42, focusX: 0.72, focusY: 0.5 },
    action: { x: 0.74, y: 0.51 },
  },
  {
    id: "12",
    src: shot12,
    durationMs: 2800,
    overlapMs: 0,
    from: { scale: 1.12, focusX: 0.59, focusY: 0.3 },
    to: { scale: 1.34, focusX: 0.55, focusY: 0.27 },
    action: { x: 0.62, y: 0.28 },
  },
] as const;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function buildTimeline(shots: readonly Shot[]) {
  let start = 0;
  return shots.map((shot, index) => {
    const end = start + shot.durationMs;
    const entry = { ...shot, start, end, index };
    start = end - shot.overlapMs;
    return entry;
  });
}

const TIMELINE = buildTimeline(SHOTS);
const TOTAL_DURATION_MS = TIMELINE[TIMELINE.length - 1]?.end ?? 0;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      setSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

function frameForShot(
  shot: (typeof TIMELINE)[number],
  progress: number,
  frameWidth: number,
  frameHeight: number,
) {
  const eased = easeInOutCubic(progress);
  const scale = lerp(shot.from.scale, shot.to.scale, eased);
  const focusX = lerp(shot.from.focusX, shot.to.focusX, eased);
  const focusY = lerp(shot.from.focusY, shot.to.focusY, eased);
  const imageWidth = frameWidth;
  const imageHeight = frameWidth * (shot.src.height / shot.src.width);
  const x = frameWidth * 0.5 - focusX * imageWidth * scale;
  const y = frameHeight * 0.5 - focusY * imageHeight * scale;

  return {
    scale,
    x,
    y,
    imageWidth,
    imageHeight,
  };
}

function actionPointForShot(
  shot: (typeof TIMELINE)[number],
  frame: ReturnType<typeof frameForShot>,
) {
  return {
    x: frame.x + frame.imageWidth * frame.scale * shot.action.x,
    y: frame.y + frame.imageHeight * frame.scale * shot.action.y,
  };
}

export function BuyerWorkflowStage({
  reduce,
  active,
}: {
  reduce: boolean;
  active: boolean;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(reduce ? TOTAL_DURATION_MS : 0);

  useEffect(() => {
    if (reduce || started || !active) return;
    setStarted(true);
  }, [active, reduce, started]);

  useEffect(() => {
    if (reduce) {
      setElapsedMs(TOTAL_DURATION_MS);
      return;
    }
    if (!started) return;

    let raf = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const nextElapsed = Math.min(now - startedAt, TOTAL_DURATION_MS);
      setElapsedMs(nextElapsed);
      if (nextElapsed < TOTAL_DURATION_MS) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [reduce, started]);

  const frameWidth = size.width || 568;
  const frameHeight = size.height || 245;

  const visibleShots = TIMELINE.map((shot) => {
    const localProgress = clamp((elapsedMs - shot.start) / shot.durationMs);
    const frame = frameForShot(shot, localProgress, frameWidth, frameHeight);

    let opacity = 0;
    if (reduce && shot.index === TIMELINE.length - 1) {
      opacity = 1;
    } else if (elapsedMs >= shot.start && elapsedMs <= shot.end) {
      opacity = 1;
      const introMs = shot.index === 0 ? 0 : Math.min(shot.overlapMs || 0, 520);
      if (introMs > 0 && elapsedMs < shot.start + introMs) {
        opacity = easeOutCubic(clamp((elapsedMs - shot.start) / introMs));
      }
      if (shot.overlapMs > 0 && elapsedMs > shot.end - shot.overlapMs) {
        opacity = Math.min(
          opacity,
          1 -
            easeInOutCubic(
              clamp((elapsedMs - (shot.end - shot.overlapMs)) / shot.overlapMs),
            ),
        );
      }
    }

    return {
      shot,
      opacity,
      frame,
      actionPoint: actionPointForShot(shot, frame),
    };
  }).filter((entry) => entry.opacity > 0.001);

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden rounded-[16px] border border-neutral-200 bg-neutral-50 shadow-[0_10px_28px_-22px_rgba(15,15,20,0.35)]"
    >
      <div className="absolute inset-0 overflow-hidden bg-white">
        {visibleShots.map((entry) => (
          <div
            key={entry.shot.id}
            className="absolute inset-0 overflow-hidden"
            style={{ opacity: entry.opacity }}
          >
            <img
              src={entry.shot.src.src}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
              style={{
                width: entry.frame.imageWidth,
                height: entry.frame.imageHeight,
                transform: `translate3d(${entry.frame.x}px, ${entry.frame.y}px, 0) scale(${entry.frame.scale})`,
                transformOrigin: "0 0",
              }}
            />
          </div>
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.72) 72%, rgba(255,255,255,0.94) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.04) 100%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
