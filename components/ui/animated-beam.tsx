"use client";

import { RefObject, useEffect, useId, useState } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export interface AnimatedBeamProps {
  className?: string;
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  /** "curved" (default Bézier), "straight" line, or "angular" L/elbow route. */
  pathType?: "curved" | "straight" | "angular";
  /** For angular routing: 0..1 fraction of the way the riser sits. */
  elbowAt?: number;
  /**
   * Primary travel axis for the angular elbow. "horizontal" (default) routes
   * H → V → H — a vertical riser between two mostly side-by-side points.
   * "vertical" routes V → H → V — a horizontal jog between two mostly
   * stacked points (e.g. a card grid fanning into a hub above/below it).
   */
  axis?: "horizontal" | "vertical";
  /** Rounds the angular elbow's corner(s) instead of a sharp 90° turn —
   *  PCB-trace style routing. 0 (default) keeps the existing sharp corner. */
  cornerRadius?: number;
  reverse?: boolean;
  /** Axis the comet gradient travels along. Use "vertical" for beams whose
   *  path runs mostly up/down — the default horizontal sweep cannot animate
   *  a vertical line. */
  gradientDirection?: "horizontal" | "vertical";
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  /** Motion easing for the comet travel. Linear = calm, even, no flash. */
  ease?: "linear" | [number, number, number, number];
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
  /** "round" (default) or "butt" / "square" for sharp comet ends on angular paths. */
  strokeLinecap?: "round" | "butt" | "square";
  strokeLinejoin?: "round" | "miter" | "bevel";
  /**
   * Renders the neutral base track as a dotted/dashed trace (PCB-style)
   * instead of a solid line, and slowly marches the dash pattern along the
   * path — so the track itself always reads as "carrying data" even before
   * the brighter comet gradient sweeps over it. Off by default.
   */
  dashed?: boolean;
  dashArray?: string;
  dashDuration?: number;
}

/**
 * Rounded step/elbow path between two points, routed through one
 * intermediate axis-aligned riser (H→V→H, or V→H→V for `vertical` axis).
 * `bendAt` is the 0..1 fraction along the primary axis where the riser
 * sits. Corners are quarter-circle arcs of `radius` — never a sharp turn,
 * never a bézier curve, matching an engineering / PCB-trace look.
 */
export function roundedElbowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bendAt: number,
  radius: number,
  axis: "horizontal" | "vertical",
): string {
  if (axis === "vertical") {
    const midY = y1 + (y2 - y1) * bendAt;
    if (Math.abs(x2 - x1) < 0.5 || radius <= 0) {
      return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    }
    const right = x2 > x1;
    const r1 = Math.min(radius, Math.abs(midY - y1), Math.abs(x2 - x1) / 2);
    const r2 = Math.min(radius, Math.abs(y2 - midY), Math.abs(x2 - x1) / 2);
    const sweep1 = right ? 1 : 0;
    const sweep2 = right ? 0 : 1;
    return [
      `M ${x1} ${y1}`,
      `L ${x1} ${midY - r1}`,
      `A ${r1} ${r1} 0 0 ${sweep1} ${x1 + (right ? r1 : -r1)} ${midY}`,
      `L ${x2 - (right ? r2 : -r2)} ${midY}`,
      `A ${r2} ${r2} 0 0 ${sweep2} ${x2} ${midY + r2}`,
      `L ${x2} ${y2}`,
    ].join(" ");
  }

  const midX = x1 + (x2 - x1) * bendAt;
  if (Math.abs(y2 - y1) < 0.5 || radius <= 0) {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  const down = y2 > y1;
  const r1 = Math.min(radius, Math.abs(midX - x1), Math.abs(y2 - y1) / 2);
  const r2 = Math.min(radius, Math.abs(x2 - midX), Math.abs(y2 - y1) / 2);
  const sweep1 = down ? 1 : 0;
  const sweep2 = down ? 0 : 1;
  return [
    `M ${x1} ${y1}`,
    `L ${midX - r1} ${y1}`,
    `A ${r1} ${r1} 0 0 ${sweep1} ${midX} ${y1 + (down ? r1 : -r1)}`,
    `L ${midX} ${y2 - (down ? r2 : -r2)}`,
    `A ${r2} ${r2} 0 0 ${sweep2} ${midX + r2} ${y2}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}

export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  pathType = "curved",
  elbowAt = 0.5,
  axis = "horizontal",
  cornerRadius = 0,
  reverse = false,
  gradientDirection = "horizontal",
  duration = Math.random() * 3 + 4,
  delay = 0,
  ease = "linear",
  pathColor = "gray",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#1f4d3a",
  gradientStopColor = "#4e9268",
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  strokeLinecap = "round",
  strokeLinejoin = "round",
  dashed = false,
  dashArray = "1.5 6",
  dashDuration = 22,
}: AnimatedBeamProps) {
  const id = useId();
  const [pathD, setPathD] = useState("");
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  const gradientCoordinates =
    gradientDirection === "vertical"
      ? reverse
        ? {
            x1: ["0%", "0%"],
            x2: ["0%", "0%"],
            y1: ["90%", "-10%"],
            y2: ["100%", "0%"],
          }
        : {
            x1: ["0%", "0%"],
            x2: ["0%", "0%"],
            y1: ["10%", "110%"],
            y2: ["0%", "100%"],
          }
      : reverse
        ? {
            x1: ["90%", "-10%"],
            x2: ["100%", "0%"],
            y1: ["0%", "0%"],
            y2: ["0%", "0%"],
          }
        : {
            x1: ["10%", "110%"],
            x2: ["0%", "100%"],
            y1: ["0%", "0%"],
            y2: ["0%", "0%"],
          };

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const rectA = fromRef.current.getBoundingClientRect();
        const rectB = toRef.current.getBoundingClientRect();

        const svgWidth = containerRect.width;
        const svgHeight = containerRect.height;
        setSvgDimensions({ width: svgWidth, height: svgHeight });

        const startX =
          rectA.left - containerRect.left + rectA.width / 2 + startXOffset;
        const startY =
          rectA.top - containerRect.top + rectA.height / 2 + startYOffset;
        const endX =
          rectB.left - containerRect.left + rectB.width / 2 + endXOffset;
        const endY =
          rectB.top - containerRect.top + rectB.height / 2 + endYOffset;

        let d: string;
        if (pathType === "straight") {
          d = `M ${startX},${startY} L ${endX},${endY}`;
        } else if (pathType === "angular") {
          // L / elbow route: axis-aligned riser, optionally rounded.
          d = roundedElbowPath(
            startX,
            startY,
            endX,
            endY,
            elbowAt,
            cornerRadius,
            axis,
          );
        } else {
          const controlY = startY - curvature;
          d = `M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`;
        }
        setPathD(d);
      }
    };

    const resizeObserver = new ResizeObserver(() => updatePath());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    updatePath();

    return () => resizeObserver.disconnect();
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    pathType,
    elbowAt,
    axis,
    cornerRadius,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ]);

  return (
    <svg
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      className={cn(
        "pointer-events-none absolute left-0 top-0 transform-gpu stroke-2 [backface-visibility:hidden]",
        className,
      )}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
    >
      {dashed ? (
        <motion.path
          d={pathD}
          stroke={pathColor}
          strokeWidth={pathWidth}
          strokeOpacity={pathOpacity}
          strokeLinecap="round"
          strokeLinejoin={strokeLinejoin}
          strokeDasharray={dashArray}
          vectorEffect="non-scaling-stroke"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: reverse ? [0, 200] : [0, -200] }}
          transition={{
            duration: dashDuration,
            ease: "linear",
            repeat: Infinity,
          }}
        />
      ) : (
        <path
          d={pathD}
          stroke={pathColor}
          strokeWidth={pathWidth}
          strokeOpacity={pathOpacity}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={pathD}
        strokeWidth={pathWidth}
        stroke={`url(#${id})`}
        strokeOpacity="1"
        strokeLinecap={strokeLinecap}
        strokeLinejoin={strokeLinejoin}
        vectorEffect="non-scaling-stroke"
      />
      <defs>
        <motion.linearGradient
          className="transform-gpu"
          id={id}
          gradientUnits={"userSpaceOnUse"}
          initial={{
            x1: "0%",
            x2: "0%",
            y1: "0%",
            y2: "0%",
          }}
          animate={{
            x1: gradientCoordinates.x1,
            x2: gradientCoordinates.x2,
            y1: gradientCoordinates.y1,
            y2: gradientCoordinates.y2,
          }}
          transition={{
            delay,
            duration,
            ease,
            repeat: Infinity,
            repeatDelay: 0,
          }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop stopColor={gradientStartColor} />
          <stop offset="32.5%" stopColor={gradientStopColor} />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
}
