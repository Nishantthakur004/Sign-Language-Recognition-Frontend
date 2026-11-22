import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, description, children, size = 'max-w-2xl' }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    panel?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className={`max-h-[92vh] w-full ${size} overflow-y-auto rounded-t-[18px] bg-white shadow-2xl sm:rounded-[18px]`} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={description ? 'modal-description' : undefined}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <h2 id="modal-title" className="font-heading text-xl font-bold text-navy">{title}</h2>
            {description && <p id="modal-description" className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-slate-100 hover:text-navy" onClick={onClose} aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
