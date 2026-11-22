import { useCallback, useEffect, useState } from 'react';
import { BarChart3, CalendarDays, Clock3, Download, Gauge, Search, Trash2, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState, Notice } from '../components/ui/States';
import { analyticsApi, recognitionApi } from '../services/api';
import useDebounce from '../hooks/useDebounce';
import { asArray, collectionTotal, errorText, formatConfidence, formatDate, formatDuration, formatNumber, historyDate, itemId, saveBlob } from '../services/format';

const PAGE_SIZE = 10;

export default function History() {
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState({ items: [], total: 0, loading: true, error: '' });
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [period, setPeriod] = useState('daily');
  const [popular, setPopular] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const loadHistory = useCallback(async () => {
    setHistory((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const payload = await recognitionApi.history({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        date: date || undefined,
      });
      setHistory({ items: asArray(payload), total: collectionTotal(payload, asArray(payload).length), loading: false, error: '' });
    } catch (error) {
      setHistory({ items: [], total: 0, loading: false, error: errorText(error) });
    }
  }, [page, debouncedSearch, date]);

  const loadAnalytics = useCallback(async () => {
    const [overviewResult, trendsResult, popularResult] = await Promise.allSettled([
      analyticsApi.overview(),
      analyticsApi.trends(period),
      analyticsApi.popularSigns({ limit: 8 }),
    ]);
    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
    if (trendsResult.status === 'fulfilled') setTrends(asArray(trendsResult.value));
    if (popularResult.status === 'fulfilled') setPopular(asArray(popularResult.value));
  }, [period]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { setPage(1); }, [debouncedSearch, date]);

  const totalPages = Math.max(1, Math.ceil(history.total / PAGE_SIZE));

  async function deleteItem(id) {
    setBusy(true);
    try {
      await recognitionApi.remove(id);
      setNotice('Recognition removed.');
      await Promise.all([loadHistory(), loadAnalytics()]);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    if (!window.confirm('Delete every saved recognition? This cannot be undone.')) return;
    setBusy(true);
    try {
      await recognitionApi.clear();
      setNotice('Recognition history cleared.');
      setPage(1);
      await Promise.all([loadHistory(), loadAnalytics()]);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportHistory() {
    setBusy(true);
    try {
      const blob = await recognitionApi.exportCsv();
      saveBlob(blob, 'recognition-history.csv');
      setNotice('History exported as CSV.');
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-app py-10">
      <PageHeader
        eyebrow="Your activity"
        title="Recognition history"
        description="Review saved gestures, track confidence over time, and export your data. Only gestures you explicitly saved are stored."
        actions={
          <>
            <Button variant="outline" onClick={exportHistory} disabled={busy}><Download className="h-4 w-4" />Export CSV</Button>
            <Button variant="dangerGhost" onClick={clearHistory} disabled={busy || history.total === 0}><Trash2 className="h-4 w-4" />Clear all</Button>
          </>
        }
      />

      {notice && <div className="mb-5"><Notice tone="purple">{notice}</Notice></div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BarChart3} label="Total recognitions" value={overview ? formatNumber(overview.total_recognitions) : '—'} />
        <StatCard icon={Gauge} label="Average confidence" value={overview ? formatConfidence(overview.average_confidence) : '—'} />
        <StatCard icon={Clock3} label="Sessions" value={overview ? formatNumber(overview.total_sessions) : '—'} />
        <StatCard icon={CalendarDays} label="Time recognized" value={overview ? formatDuration(overview.total_duration_seconds) : '—'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-navy"><TrendingUp className="h-5 w-5 text-brand-700" />Recognition trend</h2>
            <select className="field w-auto" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Trend period">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="mt-4 h-64">
            {trends.length === 0 ? (
              <p className="grid h-full place-items-center text-sm text-muted">No trend data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Recognitions" stroke="#6D28D9" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-navy"><BarChart3 className="h-5 w-5 text-brand-700" />Most recognized signs</h2>
          <div className="mt-4 h-64">
            {popular.length === 0 ? (
              <p className="grid h-full place-items-center text-sm text-muted">No popular signs yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popular} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="sign" width={70} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Count" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="field pl-10" placeholder="Search by sign or category" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search history" />
          </div>
          <input type="date" className="field sm:w-48" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filter by date" />
          {(search || date) && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDate(''); }}>Reset</Button>}
        </div>

        {history.loading ? (
          <LoadingState label="Loading history…" />
        ) : history.error ? (
          <div className="p-5"><ErrorState message={history.error} onRetry={loadHistory} /></div>
        ) : history.items.length === 0 ? (
          <EmptyState icon={Clock3} title="No saved recognitions" description="Use the live studio and save a gesture to see it here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.items.map((item) => (
              <li key={itemId(item)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-base font-bold text-navy">{item.sign}</p>
                    {item.category && <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{item.category}</span>}
                    {item.recognition_type && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{item.recognition_type}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{formatDate(historyDate(item))} · {formatConfidence(item.confidence)} confidence{item.duration_ms ? ` · ${formatDuration(item.duration_ms, 'milliseconds')}` : ''}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-slate-400">{item.model_version || 'model version unavailable'}</span>
                  <Button variant="dangerGhost" size="sm" onClick={() => deleteItem(itemId(item))} disabled={busy} aria-label={`Delete ${item.sign} recognition`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {history.total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4">
            <p className="text-sm text-muted">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
