import { useCallback, useEffect, useRef, useState } from 'react';

function cameraError(error) {
  if (!window.isSecureContext) return 'Camera access requires HTTPS or localhost. Open SignTrans in a secure browser context.';
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Camera permission was denied. Allow camera access in your browser settings, then try again.';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return 'No compatible camera was found. Connect a camera or try a different facing mode.';
  if (error?.name === 'NotReadableError') return 'The camera is already in use by another application. Close it and try again.';
  return error?.message || 'The camera could not be started. Check your device and browser permissions.';
}

export default function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const facingRef = useRef('user');
  const operationRef = useRef(0);
  const mountedRef = useRef(true);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    operationRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) {
      setRunning(false);
      setStarting(false);
      setPaused(false);
    }
  }, []);

  const start = useCallback(async (requestedFacing = facingRef.current) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support webcam access. Try a current version of Chrome, Edge, Firefox, or Safari.');
      return false;
    }
    const operation = ++operationRef.current;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStarting(true);
    setRunning(false);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: requestedFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (!mountedRef.current || operation !== operationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = stream;
      facingRef.current = requestedFacing;
      setFacingMode(requestedFacing);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!mountedRef.current || operation !== operationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current === stream) stop();
      }, { once: true });
      setRunning(true);
      setPaused(false);
      return true;
    } catch (cameraFailure) {
      if (operation === operationRef.current && mountedRef.current) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRunning(false);
        setError(cameraError(cameraFailure));
      }
      return false;
    } finally {
      if (operation === operationRef.current && mountedRef.current) setStarting(false);
    }
  }, [stop]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(async () => {
    try {
      await videoRef.current?.play();
      setPaused(false);
      setError('');
      return true;
    } catch (resumeFailure) {
      setError(cameraError(resumeFailure));
      return false;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const next = facingRef.current === 'user' ? 'environment' : 'user';
    stop();
    return start(next);
  }, [start, stop]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return {
    videoRef,
    streamRef,
    running,
    starting,
    paused,
    facingMode,
    error,
    setError,
    start,
    stop,
    pause,
    resume,
    switchCamera,
  };
}
