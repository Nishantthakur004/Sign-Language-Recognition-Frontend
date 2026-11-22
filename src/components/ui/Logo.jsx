import { Link } from 'react-router-dom';

const LOGO_SRC = 'https://i.ibb.co/BHncbQDP/AI-Sign-Recognition-Monitor-Logo.png';

export default function Logo({ light = false, className = '' }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 rounded-lg ${className}`} aria-label="SignTrans home">
      <img
        src={LOGO_SRC}
        alt=""
        className={`h-10 w-10 rounded-[13px] object-contain ${light ? 'bg-white' : ''}`}
        aria-hidden="true"
      />
      <span className={`font-heading text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-navy'}`}>
        Sign<span className={light ? 'text-brand-200' : 'text-brand-700'}>Trans</span>
      </span>
    </Link>
  );
}
