export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-2 pr-16 sm:flex-row sm:items-center sm:justify-between sm:pr-20">
      <div className={`flex min-w-0 ${subtitle ? "items-baseline gap-3" : "items-center gap-3"}`}>
        <h1 className="shrink-0 font-display text-2xl font-bold tracking-tight text-ink md:text-[2rem]">{title}</h1>
        {subtitle && <p className="min-w-0 truncate text-xs text-ink-dim sm:text-sm">{subtitle}</p>}
        {!subtitle && (
          <div className="inline-flex w-fit items-center rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber">
            Overview
          </div>
        )}
      </div>
      {subtitle && (
        <div className="inline-flex w-fit items-center rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber">
          Overview
        </div>
      )}
    </div>
  );
}
