import { useEffect, useRef, useState } from 'react';
import {
  Check, Clipboard, Clock3, Film, LoaderCircle, RotateCcw, ScanLine, Sparkles,
  Upload, Volume2, VolumeX,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { Notice } from '../components/ui/States';
import { recognitionApi } from '../services/api';
import { speak, speechSupported, stopSpeaking } from '../services/speech';
import { errorText, formatConfidence } from '../services/format';

const ACCEPTED = '.mp4,.mov,.avi,.mkv,.webm,.m4v,video/*';
const MAX_MB = 100;

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export default function VideoRecognition() {
  const inputRef = useRef(null);
  const previewUrlRef = useRef('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    stopSpeaking();
  }, []);

  function chooseFile(nextFile) {
    if (!nextFile) return;
    const looksLikeVideo = nextFile.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(nextFile.name);
    if (!looksLikeVideo) {
      setError('Choose a video file (MP4, MOV, AVI, MKV, WEBM, or M4V).');
      return;
    }
    if (nextFile.size > MAX_MB * 1024 * 1024) {
      setError(`That video is larger than the ${MAX_MB} MB limit.`);
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(nextFile);
    setResult(null);
    setError('');
    setCopied(false);
  }

  function clearFile() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreviewUrl('');
    setFile(null);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function recognize() {
    if (!file) return;
    setProcessing(true);
    setError('');
    setResult(null);
    try {
      const payload = await recognitionApi.recognizeVideo(file);
      setResult(payload);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setProcessing(false);
    }
  }

  // The recognized text leads with the most confident sign, so the best match
  // is always first.
  const recognizedText = result?.segments?.length
    ? [...result.segments]
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .map((segment) => segment.sign)
      .join(' ')
    : (result?.text || '');

  async function copyText() {
    if (!recognizedText) return;
    try {
      await navigator.clipboard.writeText(recognizedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access was denied by the browser.');
    }
  }

  return (
    <div className="container-app py-10">
      <PageHeader
        eyebrow="Video studio"
        title="Recognize a sign video"
        description="Upload a recorded ISL clip. The server extracts real MediaPipe hand landmarks, classifies each window with the trained model, and returns the recognized words as text."
        actions={
          file ? (
            <Button variant="outline" onClick={clearFile} disabled={processing}><RotateCcw className="h-4 w-4" />Choose another</Button>
          ) : (
            <Button onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" />Select video</Button>
          )
        }
      />

      {error && <div className="mb-5"><Notice tone="red">{error}</Notice></div>}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="card overflow-hidden">
          <div
            className={`relative aspect-video bg-navy ${dragging ? 'ring-2 ring-inset ring-brand-400' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
          >
            {previewUrl ? (
              <video src={previewUrl} className="h-full w-full object-contain" controls playsInline aria-label="Uploaded sign video preview" />
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-white transition hover:bg-navy/80"
              >
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10"><Film className="h-8 w-8 text-brand-200" /></span>
                <span className="font-heading text-lg font-bold">Drop a sign video here</span>
                <span className="max-w-sm text-sm text-slate-300">MP4, MOV, AVI, MKV, WEBM, or M4V · up to {MAX_MB} MB. No login required.</span>
              </button>
            )}
            {processing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/80 text-white">
                <LoaderCircle className="h-9 w-9 animate-spin text-brand-200" />
                <p className="font-heading text-base font-bold">Extracting landmarks and recognizing…</p>
                <p className="text-xs text-slate-300">Longer clips take a little more time.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 p-4">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <Button onClick={recognize} loading={processing} disabled={!file || processing}>
              <ScanLine className="h-4 w-4" />Recognize video
            </Button>
            {file && (
              <span className="text-xs font-medium text-muted">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Recognized text</p>
              <p className="mt-2 min-h-12 whitespace-pre-wrap font-heading text-2xl font-bold text-navy">
                {result ? (recognizedText || 'No confident sign found') : '—'}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${recognizedText ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {result ? `${result.segments?.length || 0} sign${result.segments?.length === 1 ? '' : 's'}` : 'Waiting'}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyText} disabled={!recognizedText}>
              {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => speak(recognizedText)} disabled={!recognizedText || !speechSupported()}>
              <Volume2 className="h-4 w-4" />Speak
            </Button>
            <Button variant="ghost" size="sm" onClick={stopSpeaking} disabled={!speechSupported()}><VolumeX className="h-4 w-4" />Stop</Button>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Detected signs <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">· highest confidence first</span></p>
            {!result?.segments?.length ? (
              <p className="mt-2 text-sm text-muted">
                {result ? 'No window passed the confidence threshold. Try a clearer, well-lit clip with the hands fully visible.' : 'Upload a clip and run recognition to see the sign timeline.'}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {[...result.segments]
                  .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                  .map((segment, index) => (
                    <li key={`${segment.sign}-${segment.start_seconds}-${index}`} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
                      <span className="w-6 text-xs font-bold text-slate-400">#{index + 1}</span>
                      <span className="w-24 truncate font-heading text-sm font-bold text-navy">{segment.sign}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.round((segment.confidence || 0) * 100)}%` }} />
                      </span>
                      <span className="w-10 text-right text-xs font-semibold text-muted">{formatConfidence(segment.confidence)}</span>
                      <span className="w-24 text-right text-[11px] font-medium text-slate-400">
                        {segment.start_seconds.toFixed(1)}–{segment.end_seconds.toFixed(1)}s
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {result && (
            <div className="mt-5 grid grid-cols-3 gap-2 rounded-[14px] bg-surface p-3 text-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Duration</p>
                <p className="mt-1 font-heading text-sm font-bold text-navy">{formatDuration(result.duration_seconds)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Hands seen</p>
                <p className="mt-1 font-heading text-sm font-bold text-navy">{result.hands_detected_frames}/{result.total_frames}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">FPS</p>
                <p className="mt-1 font-heading text-sm font-bold text-navy">{result.fps}</p>
              </div>
            </div>
          )}

          {result?.model_version && <p className="mt-3 text-xs text-slate-400">Model {result.model_version}</p>}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-navy"><Sparkles className="h-5 w-5 text-brand-700" />How it works</h2>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-muted">
            <li>1. The clip is decoded on the server with OpenCV.</li>
            <li>2. MediaPipe extracts two-hand landmarks for every frame.</li>
            <li>3. Overlapping 30-frame windows are classified by the trained BiLSTM.</li>
            <li>4. Consecutive identical signs are merged into readable text.</li>
          </ol>
        </section>
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-navy"><Clock3 className="h-5 w-5 text-brand-700" />Tips for better results</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
            <li>Keep both hands inside the frame and avoid motion blur.</li>
            <li>Use even lighting and a plain background where possible.</li>
            <li>Sign one word at a time with a short pause between words.</li>
            <li>Only the trained vocabulary can be recognized; unknown signs are reported as uncertain.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
