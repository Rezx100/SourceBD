"use client"

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type MotionProps,
} from "motion/react"

import { cn } from "@/lib/utils"

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  const animations: MotionProps = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      }
    : {
        // New row drops in from the top; the shared `layout` animation pushes
        // every row below it down one slot. The oldest row exits by sliding
        // further DOWN as it fades into the background — never snapping back up
        // (the old in-place fade let popLayout pin it at its previous slot,
        // which read as a ping-pong). One calm, continuous loop.
        initial: { opacity: 0, y: -40 },
        animate: { opacity: 1, y: 0 },
        exit: {
          opacity: 0,
          y: 40,
          transition: { duration: 0.55, ease: "easeIn" },
        },
        transition: { type: "tween", duration: 0.5, ease: "easeOut" },
      }

  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  )
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode
  delay?: number
  /** How many rows are visible in the rolling window. */
  maxItems?: number
}

export const AnimatedList = React.memo(
  ({ children, className, delay = 1000, maxItems = 5, ...props }: AnimatedListProps) => {
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children]
    )
    const [tick, setTick] = useState(0)

    useEffect(() => {
      if (childrenArray.length <= 1) return
      const id = setInterval(() => setTick((t) => t + 1), delay)
      return () => clearInterval(id)
    }, [delay, childrenArray.length])

    // A continuously cycling window of the most-recent rows. Each tick a new
    // row enters the top and the oldest leaves the bottom, so the feed scrolls
    // forever in one direction and never collapses back to a single row (the
    // old slice(0, index) approach rebuilt the whole stack every cycle, which
    // read as an ugly restart).
    const itemsToShow = useMemo(() => {
      const len = childrenArray.length
      if (len === 0) return []
      const windowSize = Math.min(maxItems, len)
      return Array.from({ length: windowSize }, (_, i) => {
        const childIdx = (((tick - i) % len) + len) % len
        return { uid: tick - i, node: childrenArray[childIdx] }
      })
    }, [tick, childrenArray, maxItems])

    return (
      <div
        className={cn(`flex flex-col items-center gap-4`, className)}
        {...props}
      >
        <AnimatePresence mode="popLayout">
          {itemsToShow.map(({ uid, node }) => (
            <AnimatedListItem key={uid}>{node}</AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    )
  }
)

AnimatedList.displayName = "AnimatedList"
