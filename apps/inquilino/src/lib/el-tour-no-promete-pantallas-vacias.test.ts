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
import { pasosDelTour, TODOS_LOS_PASOS } from './pasos-del-tour';
import { GATEADAS, soloCodigo } from './pantallas-gateadas';

/**
 * El barrido de pantallas y el filtro de comentarios se mudaron a `lib/pantallas-gateadas.ts`
 * cuando apareció un SEGUNDO consumidor: el control de Mi Cuenta, la pantalla de al lado, que
 * tenía este mismo defecto. Dos copias de esta regla se desincronizan.
 *
 * En la mudanza `soloCodigo` ganó una regla que acá faltaba: los bloques `{/* … *\/}` de JSX.
 * Abren con `{/*` —que no empieza por `//` ni por `*`— y sus líneas del medio empiezan por texto
 * común, así que se colaban enteros. Lo destapó un rojo de verdad, no una hipótesis.
 */

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

    // 🔴 Y LOS BLOQUES JSX `{/* … */}`, que es como comenta una pantalla. Ésta faltaba, y no es
    // teórica: el comentario que explica el arreglo de Mi Cuenta empezó siendo un bloque así,
    // nombrando las dos marcas, y puso ESTE test en rojo con
    // «expected [ '«Y mucho más» → /cuenta' ] to deeply equal []» — un CTA que anda, marcado
    // como roto, por la prosa que documenta el arreglo de la pantalla de al lado.
    //
    // Se cuela porque abre con `{/*`, que no empieza por `//` ni por `*`, y sus líneas del medio
    // empiezan por texto común. El filtro sigue el estado de apertura línea por línea; un regex
    // sobre todo el archivo se comería el código real que quede entre dos bloques lejanos.
    const bloqueJsx = [
      '<Card>',
      '  {/* Las dos pantallas se gatean con `if (apiEnabled) return <Proximamente',
      '      …>` porque se arman con mocks. Las filas no se sacan. */}',
      '  <LinkRow href="/calendario" />',
      '</Card>',
    ].join('\n');
    expect(soloCodigo(bloqueJsx)).not.toContain('<Proximamente');
    expect(soloCodigo(bloqueJsx)).not.toContain('if (apiEnabled)');
    // Y lo que NO es comentario sigue estando: filtrar de más es el error peligroso.
    expect(soloCodigo(bloqueJsx)).toContain('<LinkRow href="/calendario" />');
  });

  it('las marcas `soloDemo` corresponden a una pantalla realmente gateada', () => {
    // Una marca de más también miente: esconde en producción algo que sí funciona.
    const deMas = TODOS_LOS_PASOS.filter((p) => p.soloDemo && p.cta && !GATEADAS.includes(p.cta.href)).map(
      (p) => `«${p.titulo}» → ${p.cta!.href}`,
    );
    expect(deMas, 'este paso está marcado soloDemo pero su pantalla funciona en producción').toEqual([]);
  });
});
