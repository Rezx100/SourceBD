// A new instance on every navigation, so the page's content fades in (200 ms,
// opacity only) under a rail and topbar that hold still. The layout above
// draws the shell once; this is the only thing that changes between pages.

export default function BuyerTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col animate-fade motion-reduce:animate-none">{children}</div>;
}
