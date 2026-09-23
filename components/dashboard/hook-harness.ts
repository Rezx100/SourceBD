// Test-only: call a client component function as React would, with a
// recording hook dispatcher, and get back the element tree it returned — so a
// test can find the real Save / Clear / Export elements and invoke their real
// handlers. Source-text checks of that wiring could be satisfied by a comment
// or a dead string (cycles 13–14); invoking the handler cannot.
//
// Effects are recorded, not run: a test may call one itself. State setters record what they were called
// with. No DOM: a test stubs the globals (fetch, document, window) the handler
// touches.

import * as React from "react";
import type { ReactNode } from "react";

type Dispatcher = Record<string, unknown>;
const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: Dispatcher | null } })
  .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

export type HookRun = {
  out: ReactNode;
  /** Every setState call, in order, with the hook's index and the value. */
  sets: { hook: number; value: unknown }[];
  /** Every useRef object, in call order, so a test can move a ref mid-flight. */
  refs: { current: unknown }[];
  /** Every useEffect body, in call order, for a test to run when it chooses. */
  effects: (() => unknown)[];
  /** Each of those effects' dependency lists, in the same order. */
  deps: (readonly unknown[] | undefined)[];
};

export function callWithHooks<P>(
  component: (props: P) => ReactNode,
  props: P,
  opts: { contexts?: Map<unknown, unknown>; state?: unknown[] } = {},
): HookRun {
  const sets: HookRun["sets"] = [];
  const refs: HookRun["refs"] = [];
  const effects: HookRun["effects"] = [];
  const deps: HookRun["deps"] = [];
  let stateIndex = 0;
  const dispatcher: Dispatcher = {
    useState: (init: unknown) => {
      const hook = stateIndex++;
      const value = opts.state && hook < opts.state.length ? opts.state[hook] : typeof init === "function" ? (init as () => unknown)() : init;
      return [value, (next: unknown) => sets.push({ hook, value: next })];
    },
    useRef: (current: unknown) => {
      const ref = { current };
      refs.push(ref);
      return ref;
    },
    useEffect: (f: () => unknown, d?: readonly unknown[]) => {
      effects.push(f);
      deps.push(d);
    },
    useLayoutEffect: () => {},
    useInsertionEffect: () => {},
    useId: () => ":h0:",
    useMemo: (f: () => unknown) => f(),
    useCallback: (f: unknown) => f,
    useContext: (ctx: { _currentValue?: unknown }) => (opts.contexts?.has(ctx) ? opts.contexts.get(ctx) : ctx._currentValue),
    useTransition: () => [false, (f: () => void) => f()],
    useDebugValue: () => {},
  };
  const prev = internals.H;
  internals.H = dispatcher;
  try {
    return { out: component(props), sets, refs, effects, deps };
  } finally {
    internals.H = prev;
  }
}

type El = { type: unknown; props: Record<string, unknown> & { children?: ReactNode } };

function isEl(n: unknown): n is El {
  return typeof n === "object" && n !== null && "props" in n && "type" in n;
}

/** Visible text under a node, flattened. Elements of component types are NOT
 * expanded (their output is not in this tree) — their string children are. */
export function textOf(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isEl(n)) return textOf(n.props.children as ReactNode);
  return "";
}

/** Every element in the returned tree matching `pred`, depth-first. */
export function findAll(n: ReactNode, pred: (el: El) => boolean): El[] {
  const out: El[] = [];
  const walk = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!isEl(x)) return;
    if (pred(x)) out.push(x);
    walk(x.props.children);
  };
  walk(n);
  return out;
}
