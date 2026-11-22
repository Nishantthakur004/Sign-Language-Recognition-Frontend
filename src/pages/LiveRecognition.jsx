import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, CameraOff, Check, Clipboard, Clock3, Hand, LoaderCircle, Pause, Play,
  RotateCcw, Save, ScanLine, Sparkles, Square, Volume2, VolumeX,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { Notice } from '../components/ui/States';
import useCamera from '../hooks/useCamera';
import { getWebSocketUrl, recognitionApi } from '../services/api';
import { normalizePrediction } from '../services/prediction';
import { GestureStabilizer } from '../services/stabilization';
import { clearCanvas, detectHands, drawHands, handsToFrame, loadHandLandmarker } from '../services/mediapipe';
import { speak, speechSupported, stopSpeaking } from '../services/speech';
import { errorText, formatConfidence } from '../services/format';

const DETECTION_INTERVAL_MS = 66;
const SEQUENCE_INTERVAL_MS = 700;
// The model resamples any window to its trained 30 steps, so a longer buffer
// (~3s at 66ms) captures the full motion of slower signs instead of clipping it.
const SEQUENCE_LENGTH = 45;
const MIN_SEQUENCE_FRAMES = 15;
const MAX_RECENT = 8;

export default function LiveRecognition() {
  const { videoRef, running, starting, error: cameraError, start, stop } = useCamera();
  const overlayRef = useRef(null);
  const socketRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(0);
  const sequenceTimerRef = useRef(0);
  const inFlightRef = useRef(false);
  const inFlightTimeoutRef = useRef(0);
  const lastDetectRef = useRef(0);
  const bufferRef = useRef([]);
  const sessionStartRef = useRef(0);
  const sessionIdRef = useRef('');
  const stabilizerRef = useRef(new GestureStabilizer());
  const pausedRef = useRef(false);
  const autoAppendRef = useRef(true);
  const runningRef = useRef(false);

  const [socketStatus, setSocketStatus] = useState('idle');
  const [recognitionPaused, setRecognitionPaused] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [stability, setStability] = useState({ status: 'idle', votes: 0, required: 5 });
  const [sentence, setSentence] = useState('');
  const [recent, setRecent] = useState([]);
  const [threshold, setThreshold] = useState(0.6);
  const [autoAppend, setAutoAppend] = useState(true);
  const [smoothing, setSmoothing] = useState(true);
  const [notice, setNotice] = useState('');
  const [modelError, setModelError] = useState('');
  const [landmarkError, setLandmarkError] = useState('');
  const [buffered, setBuffered] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { pausedRef.current = recognitionPaused; }, [recognitionPaused]);
  useEffect(() => { autoAppendRef.current = autoAppend; }, [autoAppend]);
  useEffect(() => {
    stabilizerRef.current.configure({
      minConfidence: threshold,
      minVotes: smoothing ? 3 : 1,
      windowSize: smoothing ? 6 : 1,
    });
  }, [threshold, smoothing]);

  const appendSign = useCallback((sign, confidence) => {
    if (!sign) return;
    setSentence((previous) => (previous ? `${previous} ${sign}` : sign));
    setRecent((previous) => [{ sign, confidence, at: Date.now() }, ...previous].slice(0, MAX_RECENT));
  }, []);

  const handlePrediction = useCallback((raw) => {
    const normalized = normalizePrediction(raw);
    if (!normalized.sign) return;
    setPrediction(normalized);
    setSaved(false);
    const result = stabilizerRef.current.push(normalized);
    setStability(result);
    if (result.status === 'stable' && result.isNew && autoAppendRef.current) {
      appendSign(result.sign, result.confidence);
    }
  }, [appendSign]);

  const closeSocket = useCallback(() => {
    window.clearTimeout(inFlightTimeoutRef.current);
    inFlightRef.current = false;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    setSocketStatus('idle');
  }, []);

  const stopLoops = useCallback(() => {
    runningRef.current = false;
    window.cancelAnimationFrame(rafRef.current);
    window.clearInterval(sequenceTimerRef.current);
    rafRef.current = 0;
    sequenceTimerRef.current = 0;
  }, []);

  const stopSession = useCallback(() => {
    stopLoops();
    closeSocket();
    stop();
    clearCanvas(overlayRef.current);
    stabilizerRef.current.reset();
    bufferRef.current = [];
    setBuffered(0);
    setRecognitionPaused(false);
    setStability({ status: 'idle', votes: 0, required: 3 });
    setSocketStatus('idle');
  }, [closeSocket, stop, stopLoops]);

  useEffect(() => () => {
    stopLoops();
    closeSocket();
    stopSpeaking();
    landmarkerRef.current?.close?.();
  }, [closeSocket, stopLoops]);

  const startLandmarkLoop = useCallback(() => {
    const tick = (time) => {
      if (!runningRef.current) return;
      if (time - lastDetectRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectRef.current = time;
        try {
          const hands = detectHands(landmarkerRef.current, videoRef.current, time);
          drawHands(overlayRef.current, hands);
          if (!pausedRef.current) {
            if (hands.length) {
              bufferRef.current.push(handsToFrame(hands));
              if (bufferRef.current.length > SEQUENCE_LENGTH) bufferRef.current.shift();
            } else if (bufferRef.current.length) {
              bufferRef.current.shift();
            }
            setBuffered(bufferRef.current.length);
          }
        } catch {
          // A transient detection failure must not stop the recognition loop.
        }
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }, [videoRef]);

  const startSequenceLoop = useCallback(() => {
    window.clearInterval(sequenceTimerRef.current);
    sequenceTimerRef.current = window.setInterval(() => {
      const socket = socketRef.current;
      if (!runningRef.current || pausedRef.current || !socket || socket.readyState !== WebSocket.OPEN || inFlightRef.current) return;
      if (bufferRef.current.length < MIN_SEQUENCE_FRAMES) return;
      const sequence = bufferRef.current.slice(-SEQUENCE_LENGTH);
      inFlightRef.current = true;
      try {
        socket.send(JSON.stringify({ sequence }));
      } catch {
        inFlightRef.current = false;
        return;
      }
      window.clearTimeout(inFlightTimeoutRef.current);
      inFlightTimeoutRef.current = window.setTimeout(() => { inFlightRef.current = false; }, 8000);
    }, SEQUENCE_INTERVAL_MS);
  }, []);

  const connectSocket = useCallback(() => {
    closeSocket();
    setSocketStatus('connecting');
    setModelError('');
    let socket;
    try {
      socket = new WebSocket(getWebSocketUrl(null));
    } catch {
      setSocketStatus('error');
      setModelError('The live recognition connection could not be created.');
      return;
    }
    socketRef.current = socket;
    socket.onopen = () => {
      setSocketStatus('open');
      inFlightRef.current = false;
    };
    socket.onmessage = (event) => {
      inFlightRef.current = false;
      window.clearTimeout(inFlightTimeoutRef.current);
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload?.type === 'prediction' && payload.prediction) {
        handlePrediction(payload.prediction);
        return;
      }
      if (payload?.type === 'error') {
        const code = payload.error?.code;
        if (code === 'model_unavailable') {
          setModelError('No trained model is loaded. Open Model studio to download data and train.');
        } else if (code === 'rate_limited') {
          setNotice('Predictions are being sent too quickly; slowing down.');
        } else if (code === 'invalid_frame') {
          setNotice('The landmark sequence could not be read. Raise your hands into view.');
        } else {
          setNotice(payload.error?.message || 'The recognition service reported an error.');
        }
      }
    };
    socket.onerror = () => {
      setSocketStatus('error');
      setModelError('The live recognition connection failed. Check that the backend is running.');
    };
    socket.onclose = () => {
      setSocketStatus('closed');
      inFlightRef.current = false;
    };
  }, [closeSocket, handlePrediction]);

  async function startSession() {
    setNotice('');
    setModelError('');
    setLandmarkError('');
    setSaved(false);
    const started = await start();
    if (!started) return;
    runningRef.current = true;
    sessionStartRef.current = Date.now();
    sessionIdRef.current = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
    stabilizerRef.current.reset();
    bufferRef.current = [];
    setBuffered(0);
    setStability({ status: 'idle', votes: 0, required: smoothing ? 3 : 1 });
    connectSocket();
    startSequenceLoop();
    startLandmarkLoop();
    if (!landmarkerRef.current) {
      loadHandLandmarker()
        .then((landmarker) => { landmarkerRef.current = landmarker; })
        .catch(() => setLandmarkError('The browser hand tracker could not load. Recognition needs it, so check your connection.'));
    }
  }

  function togglePause() {
    setRecognitionPaused((value) => {
      const next = !value;
      if (next) {
        stabilizerRef.current.reset();
        bufferRef.current = [];
        setBuffered(0);
      }
      return next;
    });
  }

  async function captureGesture() {
    if (bufferRef.current.length < MIN_SEQUENCE_FRAMES) {
      setNotice('Hold your sign in view for a moment so a full sequence can be captured.');
      return;
    }
    setCapturing(true);
    setNotice('');
    try {
      const result = normalizePrediction(await recognitionApi.predictSequence(bufferRef.current.slice(-SEQUENCE_LENGTH)));
      setPrediction(result);
      setStability({ status: result.confidence >= threshold ? 'stable' : 'uncertain', votes: 1, required: 1 });
      appendSign(result.sign, result.confidence);
      setSaved(false);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setCapturing(false);
    }
  }

  function addCurrentToSentence() {
    if (!prediction?.sign) return;
    appendSign(prediction.sign, prediction.confidence);
  }

  async function copySentence() {
    if (!sentence) return;
    try {
      await navigator.clipboard.writeText(sentence);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice('Clipboard access was denied by the browser.');
    }
  }

  async function saveToHistory() {
    if (!prediction?.prediction_id) {
      setNotice('Capture a fresh gesture before saving; live predictions expire quickly.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      await recognitionApi.save({
        prediction_id: prediction.prediction_id,
        session_id: sessionIdRef.current || null,
        duration_ms: Math.max(0, Date.now() - (sessionStartRef.current || Date.now())),
      });
      setSaved(true);
      setNotice('Gesture saved to your history.');
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  const confidence = prediction ? Math.round((prediction.confidence || 0) * 100) : 0;
  const belowThreshold = prediction && prediction.confidence < threshold;
  const statusLabel = recognitionPaused
    ? 'Recognition paused'
    : socketStatus === 'open'
      ? 'Live'
      : socketStatus === 'connecting'
        ? 'Connecting…'
        : running ? 'Camera on' : 'Camera off';

  return (
    <div className="container-app py-10">
      <PageHeader
        eyebrow="Live studio"
        title="Real-time recognition"
        description="Start your camera, hold a sign steady, and let the model build your sentence. Hand landmarks stay in memory; no images are sent or stored."
        actions={
          running ? (
            <Button variant="dangerGhost" onClick={stopSession}><Square className="h-4 w-4" />Stop camera</Button>
          ) : (
            <Button onClick={startSession} loading={starting}><Camera className="h-4 w-4" />Start camera</Button>
          )
        }
      />

      {modelError && <div className="mb-5"><Notice tone="red">{modelError}</Notice></div>}
      {cameraError && <div className="mb-5"><Notice tone="red">{cameraError}</Notice></div>}
      {landmarkError && <div className="mb-5"><Notice tone="amber">{landmarkError}</Notice></div>}
      {notice && <div className="mb-5"><Notice tone="purple">{notice}</Notice></div>}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="card overflow-hidden">
          <div className="relative aspect-video bg-navy">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted aria-label="Live camera preview" />
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/80 px-6 text-center text-white">
                <CameraOff className="h-10 w-10 text-brand-200" />
                <p className="font-heading text-lg font-bold">Camera is off</p>
                <p className="max-w-sm text-sm text-slate-300">Start the camera to track hand landmarks and recognize ISL words. No login is required.</p>
              </div>
            )}
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-navy/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              <span className={`h-2 w-2 rounded-full ${socketStatus === 'open' && !recognitionPaused ? 'animate-pulse bg-emerald-400' : 'bg-slate-400'}`} />
              {statusLabel}
            </div>
            {prediction?.hand_detected === false && running && (
              <div className="absolute bottom-3 left-3 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-bold text-white">No hand detected</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-4">
            <Button variant="outline" size="sm" onClick={togglePause} disabled={!running}><Pause className="h-4 w-4" />{recognitionPaused ? 'Resume' : 'Pause'}</Button>
            <Button variant="outline" size="sm" onClick={captureGesture} loading={capturing} disabled={!running}><ScanLine className="h-4 w-4" />Capture gesture</Button>
            <Button variant="secondary" size="sm" onClick={addCurrentToSentence} disabled={!prediction?.sign}><Hand className="h-4 w-4" />Add to sentence</Button>
            <span className="ml-auto text-xs font-medium text-muted">{buffered} landmark frames buffered</span>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Recognized sign</p>
              <p className="mt-2 font-heading text-4xl font-bold text-navy">
                {prediction ? (belowThreshold ? 'Uncertain Sign' : prediction.sign) : '—'}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${belowThreshold ? 'bg-amber-50 text-amber-800' : prediction ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {prediction ? `${confidence}%` : 'Waiting'}
            </span>
          </div>

          <div className="mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${belowThreshold ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${confidence}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {prediction
                ? belowThreshold
                  ? `Below your ${Math.round(threshold * 100)}% confidence threshold.`
                  : stability.status === 'stable'
                    ? `Stable after ${stability.votes} agreeing predictions.`
                    : `Stabilizing ${stability.votes}/${stability.required} predictions…`
                : 'Start the camera to receive predictions.'}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Top 3 predictions</p>
            <ul className="mt-2 space-y-2">
              {(prediction?.top3 || []).length === 0 && <li className="text-sm text-muted">No alternatives yet.</li>}
              {(prediction?.top3 || []).map((item, index) => (
                <li key={`${item.sign}-${index}`} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-bold text-slate-400">#{index + 1}</span>
                  <span className="w-20 truncate font-heading text-sm font-bold text-navy">{item.sign}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.round((item.confidence || 0) * 100)}%` }} /></span>
                  <span className="w-10 text-right text-xs font-semibold text-muted">{formatConfidence(item.confidence)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-[14px] bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Recognized text</p>
            <p className="mt-2 min-h-12 whitespace-pre-wrap font-heading text-lg font-semibold text-navy">{sentence || 'Your sentence will appear here.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copySentence} disabled={!sentence}>{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</Button>
              <Button variant="outline" size="sm" onClick={() => speak(sentence)} disabled={!sentence || !speechSupported()}><Volume2 className="h-4 w-4" />Speak</Button>
              <Button variant="ghost" size="sm" onClick={stopSpeaking} disabled={!speechSupported()}><VolumeX className="h-4 w-4" />Stop</Button>
              <Button variant="ghost" size="sm" onClick={() => setSentence('')} disabled={!sentence}><RotateCcw className="h-4 w-4" />Clear</Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={saveToHistory} loading={saving} disabled={!prediction?.prediction_id || saved}><Save className="h-4 w-4" />{saved ? 'Saved' : 'Save to history'}</Button>
            {prediction?.model_version && <span className="text-xs text-slate-400">Model {prediction.model_version}</span>}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-navy"><Sparkles className="h-5 w-5 text-brand-700" />Recognition settings</h2>
          <div className="mt-4">
            <label className="label" htmlFor="threshold">Confidence threshold · {Math.round(threshold * 100)}%</label>
            <input id="threshold" type="range" min="0.3" max="0.95" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="w-full accent-brand-700" />
            <p className="mt-1 text-xs text-muted">Predictions below this value are shown as “Uncertain Sign”.</p>
          </div>
          <label className="mt-4 flex items-center justify-between gap-4 rounded-[14px] bg-surface px-4 py-3 text-sm font-semibold text-navy">
            Temporal smoothing
            <input type="checkbox" checked={smoothing} onChange={(event) => setSmoothing(event.target.checked)} className="h-5 w-5 accent-brand-700" />
          </label>
          <label className="mt-2 flex items-center justify-between gap-4 rounded-[14px] bg-surface px-4 py-3 text-sm font-semibold text-navy">
            Auto-append stable signs
            <input type="checkbox" checked={autoAppend} onChange={(event) => setAutoAppend(event.target.checked)} className="h-5 w-5 accent-brand-700" />
          </label>
        </section>

        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-navy"><Clock3 className="h-5 w-5 text-brand-700" />Recent gestures</h2>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Stable gestures will appear here as you sign.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {recent.map((item, index) => (
                <li key={`${item.at}-${index}`} className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2">
                  <p className="font-heading text-sm font-bold text-brand-800">{item.sign}</p>
                  <p className="text-[11px] font-medium text-brand-700">{formatConfidence(item.confidence)} · {new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex items-center gap-2 text-xs text-muted">
            {socketStatus === 'open' ? <Check className="h-4 w-4 text-emerald-600" /> : socketStatus === 'connecting' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {socketStatus === 'open' ? 'WebSocket connected to the recognition service.' : socketStatus === 'connecting' ? 'Opening the recognition stream…' : 'The recognition stream starts with the camera.'}
          </div>
        </section>
      </div>

    </div>
  );
}
