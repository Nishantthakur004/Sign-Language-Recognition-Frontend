import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Home, Menu, ScanLine, Upload, X } from 'lucide-react';
import Logo from '../components/ui/Logo';

const navigation = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/live', label: 'Live recognition', shortLabel: 'Live', icon: ScanLine },
  { to: '/upload', label: 'Upload', shortLabel: 'Upload', icon: Upload },
  { to: '/dictionary', label: 'Dictionary', icon: BookOpen },
];

function navClass({ isActive }) {
  return `rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-slate-50 hover:text-navy'}`;
}

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-white">
      <a href="#main-content" className="fixed left-4 top-3 z-[120] -translate-y-20 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition focus:translate-y-0">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-lg">
        <div className="container-app flex h-[72px] items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>{item.label}</NavLink>
            ))}
          </nav>
          <button className="grid h-11 w-11 place-items-center rounded-xl text-navy hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {menuOpen && (
          <div id="mobile-menu" className="border-t border-slate-100 bg-white px-4 py-4 shadow-soft lg:hidden">
            <nav className="container-app flex flex-col gap-1 px-0" aria-label="Mobile navigation">
              {navigation.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>{item.label}</NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main id="main-content" className="min-h-[calc(100vh-72px)] pb-24 lg:pb-0">
        <Outlet />
      </main>

      <footer className="hidden bg-navy text-white md:block">
        <div className="container-app grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">A thoughtful space for real-time sign recognition and learning, built around privacy and user control.</p>
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold">Explore</h2>
            <div className="mt-4 flex flex-col items-start gap-3 text-sm text-slate-300">
              <Link className="rounded hover:text-white" to="/live">Live recognition</Link>
              <Link className="rounded hover:text-white" to="/upload">Upload</Link>
              <Link className="rounded hover:text-white" to="/dictionary">Sign dictionary</Link>
            </div>
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold">Your privacy</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">Camera access is always initiated by you. Landmarks are processed in memory; no video or image is stored without consent.</p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-app flex flex-col gap-2 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SignTrans. Built for clearer communication.</p>
            <p>Predictions come directly from your configured recognition service.</p>
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden" aria-label="Quick navigation">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`}>
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.shortLabel || item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
