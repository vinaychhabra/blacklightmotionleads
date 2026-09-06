export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <div className="mb-2 inline-flex items-center rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber">
        Overview
      </div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-[2rem]">{title}</h1>
      {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-ink-dim">{subtitle}</p>}
    </div>
  );
}
