import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonStyles } from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="container-app flex min-h-[70vh] items-center justify-center py-16 text-center">
      <div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-[18px] bg-brand-50 text-brand-700"><Compass className="h-8 w-8" /></span>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-brand-700">404 error</p>
        <h1 className="mt-3 font-heading text-4xl font-bold text-navy">This page is out of sight.</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">The page may have moved, or the address may be incorrect. You can return to the SignTrans home page.</p>
        <Link to="/" className={`${buttonStyles({ variant: 'primary', size: 'lg' })} mt-7`}><ArrowLeft className="h-5 w-5" />Back home</Link>
      </div>
    </div>
  );
}
