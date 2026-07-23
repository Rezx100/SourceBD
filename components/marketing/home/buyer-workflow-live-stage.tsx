"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";

import {
  BuyerWorkflowSceneView,
  type BuyerWorkflowScene,
} from "@/components/marketing/home/buyer-workflow-live-primitives";

const SCENES: readonly { id: BuyerWorkflowScene; durationMs: number }[] = [
  { id: "rfq", durationMs: 3600 },
  { id: "detail", durationMs: 1800 },
  { id: "thread", durationMs: 7600 },
  { id: "inbox", durationMs: 2200 },
] as const;

const FINAL_SCENE = SCENES[SCENES.length - 1]!.id;
const TOTAL_DURATION_MS = SCENES.reduce((sum, scene) => sum + scene.durationMs, 0);
const SCENE_SCALE_X = 0.955;
/** Tall enough that RFQ compose ship-row + actions stay inside the frame. */
const SCENE_SCALE_Y = 0.97;

export function BuyerWorkflowLiveStage({ active }: { active: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const [elapsedMs, setElapsedMs] = useState(reduce ? TOTAL_DURATION_MS : 0);

  useEffect(() => {
    if (reduce) {
      setElapsedMs(TOTAL_DURATION_MS);
      return;
    }
    if (!active) {
      setElapsedMs(0);
      return;
    }
    let raf = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      setElapsedMs((now - startedAt) % TOTAL_DURATION_MS);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, reduce]);

  const { scene, sceneProgress } = useMemo(() => {
    if (reduce) {
      return { scene: FINAL_SCENE, sceneProgress: 1 };
    }
    let remainder = elapsedMs;
    for (const entry of SCENES) {
      if (remainder <= entry.durationMs) {
        return {
          scene: entry.id,
          sceneProgress: Math.min(1, Math.max(0, remainder / entry.durationMs)),
        };
      }
      remainder -= entry.durationMs;
    }
    return { scene: FINAL_SCENE, sceneProgress: 1 };
  }, [elapsedMs, reduce]);

  return (
    <div className="buyer-workflow-cq h-full w-full [overflow-anchor:none]">
      {/*
        Size the scene in layout (not transform:scale). A full-size layer
        scaled down inside overflow:hidden subpixel-clips one vertical edge
        (left hairline disappears; right stays). Percentage width/height keeps
        the layout box inset and centered so card borders stay visible.
        `.buyer-workflow-cq` scopes container queries so inner scenes split
        on card width, not viewport width.
      */}
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[20px] bg-white">
        <div
          className="min-h-0 min-w-0"
          style={{
            width: `${SCENE_SCALE_X * 100}%`,
            height: `${SCENE_SCALE_Y * 100}%`,
          }}
        >
          <BuyerWorkflowSceneView
            scene={scene}
            progress={sceneProgress}
            reduce={reduce}
          />
        </div>
      </div>
    </div>
  );
}
