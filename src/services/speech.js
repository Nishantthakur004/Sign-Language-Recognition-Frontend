export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text, { rate = 0.95, pitch = 1, lang = 'en-IN' } = {}) {
  if (!speechSupported() || !text?.trim()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
