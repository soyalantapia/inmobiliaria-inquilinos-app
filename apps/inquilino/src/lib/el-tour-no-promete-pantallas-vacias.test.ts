/**
 * El tour de onboarding no puede mandar a un inquilino real a una pantalla vacía.
 *
 * EL DEFECTO, Y POR QUÉ VUELVE. La PWA tiene pantallas que en producción devuelven un cartel de
 * «Próximamente» — cinco, hoy — porque todavía no hay endpoint que las alimente. El tour de
 * onboarding es lo PRIMERO que ve un inquilino nuevo, y no tenía ningún gate: vendía un slide
 * entero de «Mi calendario» con su botón, y ese botón llevaba justo a uno de esos carteles.
 *
 * Ya había pasado con el slide del Asistente, que se sacó por lo mismo. La pasada quedó a
 * medias, y ése es el patrón: **una pantalla se gatea y el tour no se entera.** Un test que
 * mirara sólo el texto de los slides no lo hubiera visto; éste cruza los dos lados.
 *
 * CÓMO FUNCIONA. Barre las pantallas de la app, junta las que gatean con `<Proximamente>` detrás
 * de `apiEnabled`, y exige que ningún CTA del tour de PRODUCCIÓN apunte a una de ésas. El build
 * demo sí puede: ahí las pantallas muestran su versión mock, que es de lo que la demo vive.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { pasosDelTour, TODOS_LOS_PASOS } from './pasos-del-tour';

const APP = fileURLToPath(new URL('../app', import.meta.url));

function paginas(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '.next') continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) paginas(ruta, acc);
    else if (entrada === 'page.tsx') acc.push(ruta);
  }
  return acc;
}

/** `app/(app)/contrato/renovacion/page.tsx` → `/contrato/renovacion`. Los grupos no son ruta. */
function rutaDe(archivo: string): string {
  const rel = archivo.slice(APP.length).replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
  const segmentos = rel.split('/').filter((s) => s && !s.startsWith('('));
  return `/${segmentos.join('/')}`;
}

/**
 * Las líneas que son ENTERAMENTE comentario, afuera.
 *
 * Sin esto el detector lee los comentarios como código, y en este repo los comentarios hablan
 * justo de esto: una pantalla que explique en su docblock que «antes acá había un
 * `<Proximamente>` detrás de `if (apiEnabled)`» quedaría contada como gateada, y el tour se
 * comería un rojo por un CTA que funciona.
 *
 * NO se hace strip de `//` a fin de línea, a propósito: una línea como
 * `if (apiEnabled) { // ver nota` perdería el gate real, y ese error va para el lado peligroso
 * —una pantalla gateada que el detector no ve, y el CTA roto pasa—. Los comentarios sueltos
 * que queden son inofensivos.
 */
function soloCodigo(src: string): string {
  return src
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

/**
 * Las rutas que producción tapa con un «Próximamente». Se piden las DOS marcas juntas —el gate
 * por `apiEnabled` y el componente— para no contar una pantalla que sólo lo importe de paso.
 */
const GATEADAS = paginas(APP)
  .map((archivo) => ({ archivo, src: soloCodigo(readFileSync(archivo, 'utf8')) }))
  .filter(({ src }) => src.includes('<Proximamente') && src.includes('if (apiEnabled)'))
  .map(({ archivo }) => rutaDe(archivo));

describe('el tour no promete pantallas vacías', () => {
  it('el barrido encuentra pantallas gateadas: si no, el test no está midiendo nada', () => {
    // Si mañana se renombra `<Proximamente>` o cambia la forma del gate, esta lista queda vacía
    // y el test pasaría en verde sin haber comparado nada — que es como un guard deja de avisar.
    expect(GATEADAS.length).toBeGreaterThanOrEqual(4);
    expect(GATEADAS).toContain('/calendario');
  });

  it('🔴 ningún CTA del tour de PRODUCCIÓN lleva a una de ellas', () => {
    const rotos = pasosDelTour(false)
      .filter((p) => p.cta && GATEADAS.includes(p.cta.href))
      .map((p) => `«${p.titulo}» → ${p.cta!.href}`);

    expect(
      rotos,
      'Estos slides le venden a un inquilino nuevo una pantalla que en producción es un cartel ' +
        'de «Próximamente». Marcá el paso con `soloDemo: true` en `lib/pasos-del-tour.ts`, o ' +
        'esperá a que la pantalla exista.',
    ).toEqual([]);
  });

  it('el build demo sí puede mostrarlos: es una vidriera, no una promesa', () => {
    const demo = pasosDelTour(true);
    expect(demo.length).toBeGreaterThan(pasosDelTour(false).length);
    expect(demo.some((p) => p.cta?.href === '/calendario')).toBe(true);
  });

  it('producción nunca dice MÁS que el demo: cada bullet suyo está también allá', () => {
    // La dirección importa. `bulletsDemo` SUMA sobre lo cierto; si alguien invirtiera la
    // relación —poner en producción un bullet que el demo no tiene— estaría prometiendo de más
    // justo donde hay gente de verdad.
    const enDemo = new Set(pasosDelTour(true).flatMap((p) => p.bullets));
    const soloEnProd = pasosDelTour(false)
      .flatMap((p) => p.bullets)
      .filter((b) => !enDemo.has(b));
    expect(soloEnProd).toEqual([]);
  });

  it('el detector lee CÓDIGO, no comentarios', () => {
    // El caso que lo motivó: en este repo los comentarios cuentan la historia de la pantalla,
    // así que un docblock que diga «acá había un <Proximamente> detrás de if (apiEnabled)» hacía
    // que el detector la contara como gateada — y el tour se comía un rojo por un CTA que anda.
    const conMarcasSoloEnComentarios = [
      '// antes esto devolvía <Proximamente /> cuando if (apiEnabled)',
      '/**',
      ' * y el docblock lo vuelve a nombrar: <Proximamente> con if (apiEnabled).',
      ' */',
      'export default function Pantalla() { return <Real />; }',
    ].join('\n');
    expect(soloCodigo(conMarcasSoloEnComentarios)).not.toContain('<Proximamente');
    expect(soloCodigo(conMarcasSoloEnComentarios)).not.toContain('if (apiEnabled)');

    // Y el gate de verdad sobrevive, incluso con un comentario pegado al final de la línea:
    // perderlo sería el error peligroso —una pantalla gateada que el detector no ve—.
    const gateReal = ['if (apiEnabled) { // ver nota de arriba', '  return <Proximamente />;', '}'].join('\n');
    expect(soloCodigo(gateReal)).toContain('if (apiEnabled)');
    expect(soloCodigo(gateReal)).toContain('<Proximamente');
  });

  it('las marcas `soloDemo` corresponden a una pantalla realmente gateada', () => {
    // Una marca de más también miente: esconde en producción algo que sí funciona.
    const deMas = TODOS_LOS_PASOS.filter((p) => p.soloDemo && p.cta && !GATEADAS.includes(p.cta.href)).map(
      (p) => `«${p.titulo}» → ${p.cta!.href}`,
    );
    expect(deMas, 'este paso está marcado soloDemo pero su pantalla funciona en producción').toEqual([]);
  });
});
