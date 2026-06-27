import { ShieldCheck } from 'lucide-react';

/**
 * Banda de confianza. Prueba REAL, no inventada: convenios con colegios y
 * cámaras inmobiliarias (CPI Córdoba, CUCICBA, Edifica) + la escasez honesta de
 * la beta. No mostramos números de adopción porque estamos en pre-launch y un
 * conteo inflado es lo que más rompe la confianza.
 *
 * Los "logos" se recrean en HTML/CSS (el de CPI ya existía en el login). Para
 * usar los assets oficiales: dejar el SVG en /public y reemplazar cada chip.
 */
export function TrustLogos() {
  return (
    <section className="border-y border-black/[0.06] bg-white/60">
      <div className="mx-auto max-w-6xl px-5 py-9 md:px-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Con convenio para los matriculados de
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          <CpiLogo />
          <Divider />
          <CucicbaLogo />
          <Divider />
          <EdificaLogo />
        </div>
        <p className="mx-auto mt-7 flex max-w-fit items-center gap-2 rounded-full bg-primary/[0.07] px-4 py-1.5 text-center text-[13px] font-medium text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Beta abierta · sé de las primeras 50 inmobiliarias de Córdoba (−20% para siempre)
        </p>
      </div>
    </section>
  );
}

function Divider() {
  return <span className="hidden h-8 w-px bg-black/[0.08] sm:block" />;
}

/** Sello CPI Córdoba recreado (verde petróleo + amarillo) + wordmark. */
function CpiLogo() {
  return (
    <div className="flex items-center gap-2 opacity-90 grayscale transition-all hover:opacity-100 hover:grayscale-0">
      <div className="flex flex-col items-center justify-center rounded-md bg-[#0E4C46] px-2 py-1 leading-none">
        <span className="text-[18px] font-extrabold leading-none tracking-tight text-[#F3D24E]">CPI</span>
        <span className="mt-px text-[5px] font-bold leading-none tracking-[0.18em] text-[#F3D24E]">CÓRDOBA</span>
      </div>
      <div className="leading-[1.15]">
        <p className="text-[8px] font-extrabold uppercase tracking-wide text-[#0E4C46]">Colegio Profesional</p>
        <p className="text-[8px] font-extrabold uppercase tracking-wide text-[#0E4C46]">de Inmobiliarios</p>
      </div>
    </div>
  );
}

/** Cámara de la Propiedad CABA — wordmark tipográfico. */
function CucicbaLogo() {
  return (
    <div className="flex items-center gap-2 opacity-90 grayscale transition-all hover:opacity-100 hover:grayscale-0">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-[#1f3a5f] text-white">
        <span className="text-[8px] font-black leading-none">CC</span>
      </div>
      <div className="leading-[1.1]">
        <p className="text-[15px] font-extrabold tracking-tight text-[#1f3a5f]">CUCICBA</p>
        <p className="text-[7.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Corredores · CABA
        </p>
      </div>
    </div>
  );
}

/** Edifica — cámara/colegio inmobiliario, wordmark. */
function EdificaLogo() {
  return (
    <div className="flex items-center gap-2 opacity-90 grayscale transition-all hover:opacity-100 hover:grayscale-0">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-[#0f766e] text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M4 21V9l8-6 8 6v12h-6v-7h-4v7H4z" />
        </svg>
      </div>
      <div className="leading-[1.1]">
        <p className="text-[16px] font-extrabold tracking-tight text-[#0f766e]">edifica</p>
        <p className="text-[7.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Cámara inmobiliaria
        </p>
      </div>
    </div>
  );
}
