export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>}
        <h1 className="font-heading text-3xl font-bold tracking-tight text-navy sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 text-sm leading-6 text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
