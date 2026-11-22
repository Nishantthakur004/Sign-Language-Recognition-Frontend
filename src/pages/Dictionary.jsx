import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Heart, ImageOff, Search } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState, Notice } from '../components/ui/States';
import { dictionaryApi, datasetApi, resolveMediaUrl } from '../services/api';
import useConnectionStatus from '../hooks/useConnectionStatus';
import useDebounce from '../hooks/useDebounce';
import { asArray, collectionTotal, errorText, itemId, itemLabel } from '../services/format';

const PAGE_SIZE = 24;
const LETTERS = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), ...'0123456789'.split('')];
const CATEGORY_LABELS = { alphabet: 'Alphabet', numeral: 'Numbers', hindi_vowel: 'Hindi vowels', sign: 'Signs' };

function categoryLabel(value) {
  return CATEGORY_LABELS[value] || value || 'Sign';
}

export default function Dictionary() {
  const connection = useConnectionStatus();
  const backendOffline = connection.status === 'offline';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [letter, setLetter] = useState('All');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: '' });
  const [favourites, setFavourites] = useState(new Set());
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [notice, setNotice] = useState('');
  const [availableClasses, setAvailableClasses] = useState([]);

  const debouncedSearch = useDebounce(search, 350);

  const loadEntries = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const payload = await dictionaryApi.list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        category: category === 'All' ? undefined : category,
        letter: letter === 'All' ? undefined : letter,
      });
      setState({ items: asArray(payload), total: collectionTotal(payload, asArray(payload).length), loading: false, error: '' });
    } catch (error) {
      setState({ items: [], total: 0, loading: false, error: errorText(error) });
    }
  }, [page, debouncedSearch, category, letter]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  useEffect(() => { setPage(1); }, [debouncedSearch, category, letter]);

  // Only the words the trained model can actually recognize are shown.
  useEffect(() => {
    datasetApi.status()
      .then((payload) => setAvailableClasses(asArray(payload?.classes).map((word) => String(word).toLowerCase())))
      .catch(() => setAvailableClasses([]));
  }, []);

  useEffect(() => {
    dictionaryApi.favourites().then((payload) => {
      setFavourites(new Set(asArray(payload).map(itemId)));
    }).catch(() => setFavourites(new Set()));
  }, []);

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const availableSet = useMemo(() => new Set(availableClasses), [availableClasses]);
  const visibleItems = useMemo(
    () => (availableSet.size ? state.items.filter((entry) => availableSet.has(itemLabel(entry).toLowerCase())) : state.items),
    [state.items, availableSet],
  );
  const letterOptions = useMemo(() => {
    if (!availableSet.size) return LETTERS;
    const firstLetters = new Set(availableClasses.map((word) => word[0]?.toUpperCase()));
    return ['All', ...LETTERS.slice(1).filter((value) => firstLetters.has(value))];
  }, [availableSet, availableClasses]);
  const selected = selectedIndex >= 0 ? visibleItems[selectedIndex] : null;

  async function toggleFavourite(entry) {
    const id = itemId(entry);
    const next = new Set(favourites);
    try {
      if (next.has(id)) {
        await dictionaryApi.unfavourite(id);
        next.delete(id);
      } else {
        await dictionaryApi.favourite(id);
        next.add(id);
      }
      setFavourites(next);
      setNotice('');
    } catch (error) {
      setNotice(errorText(error));
    }
  }

  return (
    <div className="container-app py-10">
      <PageHeader
        eyebrow="Reference"
        title="Sign dictionary"
        description="Browse the words the trained model can recognize. Sample images appear when the dataset provides them; otherwise the entry is marked clearly."
      />

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="field pl-10" placeholder="Search signs by name" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search dictionary" />
          </div>
        </div>
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
          {letterOptions.map((value) => (
            <button key={value} onClick={() => setLetter(value)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${letter === value ? 'bg-brand-700 text-white' : 'bg-slate-100 text-muted hover:bg-brand-50 hover:text-brand-700'}`}>
              {value}
            </button>
          ))}
        </div>
      </div>

      {backendOffline && (
        <div className="mt-4">
          <Notice tone="red">Server is currently unavailable. Please try again later.</Notice>
        </div>
      )}
      {notice && <div className="mt-4"><Notice tone="amber">{notice}</Notice></div>}

      <div className="mt-6">
        {state.loading ? (
          <LoadingState label="Loading dictionary…" />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={loadEntries} />
        ) : state.items.length === 0 ? (
          <EmptyState icon={BookOpen} title="No signs match these filters" description="Try a different search term, category, or letter." action={<Button variant="outline" onClick={() => { setSearch(''); setCategory('All'); setLetter('All'); }}>Reset filters</Button>} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {visibleItems.map((entry, index) => {
                const id = itemId(entry);
                const hasImage = entry.image_available && entry.image_url && !brokenImages.has(id);
                return (
                  <button key={id} onClick={() => setSelectedIndex(index)} className="card group overflow-hidden text-left transition hover:shadow-lift focus-visible:shadow-lift">
                    {hasImage && (
                      <div className="relative aspect-square bg-surface">
                        <img src={resolveMediaUrl(entry.image_url)} alt={`Sample image for ${itemLabel(entry)}`} className="h-full w-full object-cover" loading="lazy" onError={() => setBrokenImages((previous) => new Set(previous).add(id))} />
                        <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-bold text-brand-700">{categoryLabel(entry.category)}</span>
                      </div>
                    )}
                    <div className={`flex items-center justify-between gap-2 px-3 ${hasImage ? 'py-2.5' : 'py-5'}`}>
                      <span className="truncate font-heading text-sm font-bold text-navy">{itemLabel(entry)}</span>
                      {favourites.has(id) && <Heart className="h-4 w-4 shrink-0 fill-brand-600 text-brand-600" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">{state.total} sign{state.total === 1 ? '' : 's'} · page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelectedIndex(-1)} title={selected ? itemLabel(selected) : ''} description={selected ? `Dataset label · ${categoryLabel(selected.category)}` : ''} size="max-w-3xl">
        {selected && (
          <div className="grid gap-5 p-5 sm:grid-cols-[1fr_1.1fr] sm:p-6">
            <div className="overflow-hidden rounded-[14px] border border-slate-100 bg-surface">
              {selected.image_available && selected.image_url && !brokenImages.has(itemId(selected)) ? (
                <img src={resolveMediaUrl(selected.image_url)} alt={`Sample image for ${itemLabel(selected)}`} className="aspect-square w-full object-cover" onError={() => setBrokenImages((previous) => new Set(previous).add(itemId(selected)))} />
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 text-sm font-medium text-slate-400"><ImageOff className="h-7 w-7" />Image not available</div>
              )}
            </div>
            <div>
              <h3 className="font-heading text-2xl font-bold text-navy">{itemLabel(selected)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{selected.description || 'Dictionary entry from the labelled dataset.'}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Category</dt><dd className="font-semibold text-navy">{categoryLabel(selected.category)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Source</dt><dd className="font-semibold text-navy">{selected.language || 'dataset'}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant={favourites.has(itemId(selected)) ? 'secondary' : 'outline'} onClick={() => toggleFavourite(selected)} disabled={backendOffline}>
                  <Heart className={`h-4 w-4 ${favourites.has(itemId(selected)) ? 'fill-brand-600 text-brand-600' : ''}`} />
                  {favourites.has(itemId(selected)) ? 'Favourite' : 'Add to favourites'}
                </Button>
                <Button variant="ghost" size="sm" disabled={selectedIndex <= 0} onClick={() => setSelectedIndex((value) => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button>
                <Button variant="ghost" size="sm" disabled={selectedIndex >= visibleItems.length - 1} onClick={() => setSelectedIndex((value) => Math.min(visibleItems.length - 1, value + 1))}>Next<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
