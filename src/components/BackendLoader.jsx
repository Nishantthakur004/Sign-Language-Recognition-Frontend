import { useEffect, useRef, useState } from 'react';
import Button from './ui/Button';
import Logo from './ui/Logo';
import { API_CONFIG } from '../config/api';
import { markRequestSuccess } from '../services/connection';

const RETRY_DELAY_MS = 3000;
const REQUEST_TIMEOUT_MS = 5000;
const SLOW_THRESHOLD_MS = 60000;
const FADE_OUT_MS = 500;

/**
 * Keeps the application unmounted until the backend health endpoint answers,
 * which covers Render cold starts without affecting normal in-app navigation.
 */
export default function BackendLoader({ children }) {
  const [phase, setPhase] = useState('loading');
  const [slow, setSlow] = useState(false);
  const [entered, setEntered] = useState(false);
  const checkNowRef = useRef(() => {});

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (phase !== 'loading') return undefined;
    const timer = window.setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    let done = false;
    let inFlight = false;
    let controller = null;
    let retryTimer = 0;
    let fadeTimer = 0;

    const finish = () => {
      done = true;
      window.clearTimeout(retryTimer);
      markRequestSuccess();
      setPhase('leaving');
      fadeTimer = window.setTimeout(() => setPhase('ready'), FADE_OUT_MS);
    };

    const check = async () => {
      if (cancelled || done || inFlight) return;
      window.clearTimeout(retryTimer);
      inFlight = true;
      controller = new AbortController();
      const timeoutTimer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let ok = false;

      try {
        const response = await fetch(API_CONFIG.healthUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        ok = response.ok;
      } catch {
        ok = false;
      } finally {
        window.clearTimeout(timeoutTimer);
        inFlight = false;
      }

      if (cancelled || done) return;
      if (ok) {
        finish();
        return;
      }
      retryTimer = window.setTimeout(check, RETRY_DELAY_MS);
    };

    checkNowRef.current = check;
    check();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(fadeTimer);
      controller?.abort();
      checkNowRef.current = () => {};
    };
  }, []);

  if (phase === 'ready') return children;

  return (
    <>
      {phase === 'leaving' && children}
      <div
        className={`fixed inset-0 z-[200] overflow-y-auto bg-white transition-opacity duration-500 ease-out ${entered && phase !== 'leaving' ? 'opacity-100' : 'opacity-0'}`}
        role="status"
        aria-live="polite"
        aria-label="Backend loading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(124,58,237,0.09),transparent_58%)]"
          aria-hidden="true"
        />
        <div className="relative flex min-h-full items-center justify-center px-6 py-12">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <div className="pointer-events-none" aria-hidden="true">
              <Logo />
            </div>

            <h1 className="mt-8 font-heading text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
              Backend Loading...
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
              Waking up the server. Please wait...
            </p>

            <div className="relative mt-8 h-12 w-12" aria-hidden="true">
              <span className="absolute inset-0 rounded-full border-[3px] border-brand-100" />
              <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand-600" />
            </div>

            <p className="mt-5 text-sm font-medium text-muted">Connecting to server...</p>

            {slow && (
              <div className="mt-6 w-full rounded-[14px] border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900">
                  Server is taking longer than expected.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => checkNowRef.current()}
                >
                  Retry Now
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
