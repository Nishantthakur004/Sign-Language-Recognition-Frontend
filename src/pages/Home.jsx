import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Cpu, Gauge, Hand, ScanLine, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import HandLandmarkIllustration from '../assets/HandLandmarkIllustration';
import { buttonStyles } from '../components/ui/Button';
import { LoadingState } from '../components/ui/States';
import useConnectionStatus from '../hooks/useConnectionStatus';
import { publicApi, dictionaryApi } from '../services/api';

const features = [
  { icon: ScanLine, title: 'Real-time webcam', copy: 'Start your camera and see sign recognition streamed back over a secure WebSocket.' },
  { icon: Cpu, title: 'Real model predictions', copy: 'Static and temporal neural networks produce labels, confidence, and top-3 alternatives.' },
  { icon: Gauge, title: 'Stabilized gestures', copy: 'Temporal smoothing and a confidence threshold stop flicker and duplicate additions.' },
  { icon: Volume2, title: 'Text and speech', copy: 'Recognized signs become a sentence you can copy, clear, or speak with your device.' },
  { icon: BookOpen, title: 'Sign dictionary', copy: 'Browse the dataset A–Z and numbers, with real sample images when available.' },
  { icon: ShieldCheck, title: 'Private by design', copy: 'Camera access is on-demand, and history is only stored when you save it.' },
];

export default function Home() {
  const connection = useConnectionStatus();
  const [status, setStatus] = useState({ health: null, dictionary: null, loading: true, error: '' });

  useEffect(() => {
    if (connection.status !== 'online') {
      setStatus({ health: null, dictionary: null, loading: connection.status === 'waking', error: '' });
      return undefined;
    }

    let mounted = true;
    setStatus((current) => ({ ...current, loading: true }));

    Promise.allSettled([publicApi.health(), dictionaryApi.list({ page_size: 1 })]).then(([health, dictionary]) => {
      if (!mounted) return;
      setStatus({
        health: health.status === 'fulfilled' ? health.value : null,
        dictionary: dictionary.status === 'fulfilled' ? dictionary.value : null,
        loading: false,
        error: health.status === 'rejected' ? String(health.reason?.message || '') : '',
      });
    });
    return () => { mounted = false; };
  }, [connection.status]);

  const health = status.health && typeof status.health === 'object' ? status.health : null;
  const serviceReachable = Boolean(health);
  const modelAvailable = Boolean(health?.model?.available);

  return (
    <div className="container-app py-10 sm:py-14">
      <section className="card overflow-hidden md:grid md:grid-cols-[1.2fr_1fr]">
        <div className="p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Real-time Indian Sign Language</p>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight text-navy sm:text-5xl">
            Turn gestures into words, instantly.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            SignTrans captures your sign language gestures with your webcam, runs them through a real
            recognition model, and converts the result into text and speech you can copy, speak, and save.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/live" className={buttonStyles({ variant: 'primary', size: 'lg' })}><ScanLine className="h-5 w-5" />Start live recognition</Link>
            <Link to="/dictionary" className={buttonStyles({ variant: 'outline', size: 'lg' })}><BookOpen className="h-5 w-5" />Browse dictionary</Link>
          </div>
          {status.loading ? (
            <div className="mt-8"><LoadingState label="Checking service status…" compact /></div>
          ) : !serviceReachable ? (
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold">
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">Service offline — start the backend to see live status</span>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold">
              <span className={`rounded-full px-3 py-1.5 ${modelAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                {modelAvailable ? 'Dataset available' : 'Dataset unavailable'}
              </span>
              <span className={`rounded-full px-3 py-1.5 ${modelAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {modelAvailable ? 'Recognition model ready' : 'Model not trained yet'}
              </span>
            </div>
          )}
        </div>
        <div className="relative hidden items-center justify-center bg-gradient-to-br from-brand-50 via-white to-surface p-8 md:flex">
          <HandLandmarkIllustration className="h-full max-h-72 w-full" />
          <span className="absolute bottom-5 left-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-700"><Sparkles className="h-4 w-4" />Landmark overlay</span>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold text-navy sm:text-3xl">How SignTrans works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="card p-5">
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-heading text-base font-bold text-navy">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 card grid gap-6 bg-navy p-8 text-white sm:grid-cols-3 sm:p-10">
        <div>
          <Hand className="h-8 w-8 text-brand-200" />
          <h3 className="mt-4 font-heading text-lg font-bold">A dictionary built from the dataset</h3>
          {status.dictionary ? (
            <p className="mt-2 text-sm text-slate-300">{status.dictionary.total} labelled signs are available, with real sample images when the dataset provides them.</p>
          ) : (
            <p className="mt-2 text-sm text-slate-300">The dictionary loads sample images only when a trained dataset is available.</p>
          )}
        </div>
        <div>
          <Gauge className="h-8 w-8 text-brand-200" />
          <h3 className="mt-4 font-heading text-lg font-bold">Confidence you can control</h3>
          <p className="mt-2 text-sm text-slate-300">Adjust the threshold and smoothing in the live studio, and see “Uncertain sign” whenever the model is not confident.</p>
        </div>
        <div>
          <ShieldCheck className="h-8 w-8 text-brand-200" />
          <h3 className="mt-4 font-heading text-lg font-bold">Your data, your call</h3>
          <p className="mt-2 text-sm text-slate-300">No camera frames are stored automatically. Save gestures to your history, export CSV, or keep everything local.</p>
        </div>
      </section>
    </div>
  );
}
