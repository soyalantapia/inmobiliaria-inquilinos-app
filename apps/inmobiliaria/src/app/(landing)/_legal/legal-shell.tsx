import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Isotipo } from '@/components/isotipo';

/**
 * Shell compartido de las páginas legales (Términos, Privacidad). Mantiene el
 * look de la marca sin depender del bundle pesado de la landing: header con
 * logo + volver, cuerpo tipo "prose" legible, aviso de BORRADOR y footer con
 * contacto. Server component (contenido estático, indexable).
 */

const PROSE = `
.legal-prose h2 { font-size:1.15rem; font-weight:700; margin-top:2.25rem; letter-spacing:-0.01em; color:#1c1726; }
.legal-prose h2:first-child { margin-top:0; }
.legal-prose p { margin-top:0.75rem; color:#413c50; }
.legal-prose ul { margin-top:0.75rem; padding-left:1.25rem; list-style:disc; color:#413c50; }
.legal-prose li { margin-top:0.4rem; }
.legal-prose a { color:#6D28D9; text-decoration:underline; }
.legal-prose strong { color:#1c1726; }
`;

export function LegalShell({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-foreground">
      <style dangerouslySetInnerHTML={{ __html: PROSE }} />

      <header className="border-b border-black/[0.06] bg-[#faf8f5]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/inicio" className="flex items-center gap-2.5">
            <Isotipo size={32} />
            <span className="text-[15px] font-bold tracking-tight">My Alquiler</span>
          </Link>
          <Link
            href="/inicio"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14 md:py-20">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: {actualizado}</p>

        {/* Aviso de borrador — honestidad: no somos abogados. */}
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900">
          <strong>Borrador.</strong> Este texto es un punto de partida redactado según cómo
          funciona hoy la plataforma. Antes de publicarlo, revisalo con un profesional legal y
          completá los datos de la empresa (razón social, CUIT y domicilio, marcados como{' '}
          <code className="rounded bg-amber-100 px-1">[entre corchetes]</code>).
        </div>

        <div className="legal-prose mt-10 text-[15px] leading-relaxed">{children}</div>
      </main>

      <footer className="border-t border-black/[0.06]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[13px] text-muted-foreground">
          <span>© 2026 My Alquiler</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/terminos" className="hover:text-foreground">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-foreground">
              Privacidad
            </Link>
            <a
              href="https://wa.me/5491154596266?text=Hola%2C%20tengo%20una%20consulta%20sobre%20My%20Alquiler"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
