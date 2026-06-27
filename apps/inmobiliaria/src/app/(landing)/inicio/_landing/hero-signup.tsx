'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Captura de email del hero. Es la puerta del auto-onboarding: el email que
 * la inmobiliaria escribe acá viaja a /registro precargado, así la landing y
 * el alta se sienten una sola cosa (el alta real ya existe: POST /auth/registro).
 *
 * El microcopy dice lo que la inmobiliaria teme ("sin vendedores") — eso no lo
 * escribe un template.
 */
export function HeroSignup({
  cta = 'Empezá gratis',
  microcopy = 'Sin spam. Sin vendedores. Solo el link para crear tu inmobiliaria.',
  tone = 'light',
}: {
  cta?: string;
  microcopy?: string;
  /** 'light' sobre fondo claro · 'dark' sobre la banda oscura del cierre. */
  tone?: 'light' | 'dark';
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = email.trim().toLowerCase();
    if (!EMAIL_RE.test(v)) {
      setError('Escribí un email válido para arrancar.');
      return;
    }
    router.push(`/registro?email=${encodeURIComponent(v)}`);
  };

  const dark = tone === 'dark';

  return (
    <form onSubmit={submit} className="w-full max-w-md" noValidate>
      <div
        className={[
          'flex flex-col gap-2 rounded-2xl p-1.5 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:pr-1.5',
          'ring-1 transition-shadow focus-within:ring-2',
          dark
            ? 'bg-white/10 ring-white/20 focus-within:ring-white/40'
            : 'bg-white shadow-[0_8px_30px_-12px_rgba(80,40,160,0.25)] ring-black/[0.08] focus-within:ring-primary/50',
        ].join(' ')}
      >
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="tu@inmobiliaria.com"
          aria-label="Tu email de trabajo"
          aria-invalid={error ? true : undefined}
          className={[
            'min-w-0 flex-1 rounded-full bg-transparent px-5 py-3.5 text-base outline-none',
            dark
              ? 'text-white placeholder:text-white/50'
              : 'text-foreground placeholder:text-muted-foreground',
          ].join(' ')}
        />
        <button
          type="submit"
          className={[
            'group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-6 py-3.5 text-sm font-semibold transition-all',
            dark
              ? 'bg-white text-[#1b1228] hover:bg-white/90'
              : 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30',
          ].join(' ')}
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      {error ? (
        <p className={`mt-2 pl-2 text-sm ${dark ? 'text-amber-200' : 'text-destructive'}`}>{error}</p>
      ) : (
        <p className={`mt-2.5 pl-2 text-xs ${dark ? 'text-white/55' : 'text-muted-foreground'}`}>
          {microcopy}
        </p>
      )}
    </form>
  );
}
