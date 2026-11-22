export default function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="card p-5">
      <div className="flex items-center gap-3">
        {Icon && <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" aria-hidden="true" /></span>}
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
      <p className="mt-4 font-heading text-2xl font-bold text-navy">{value ?? '—'}</p>
      {detail && <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>}
    </article>
  );
}
