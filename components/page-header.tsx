export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-1 pr-16 sm:pr-20">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-[1.75rem]">{title}</h1>
      {subtitle && <p className="max-w-2xl text-sm text-ink-dim">{subtitle}</p>}
    </div>
  );
}
