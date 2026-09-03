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
import { GATEADAS } from './pantallas-gateadas';

/**
 * El detector vive en `pantallas-gateadas.ts` desde que un SEGUNDO control lo necesitó (el de Mi
 * Cuenta, que es la pantalla de al lado y tenía el mismo defecto). Dos copias de esta regla se
 * desincronizan — es el defecto que este repo ya pagó en `uploads.ts`, donde una copia de la
 * vigencia del link mágico se quedó con dos de las tres reglas.
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

  it('las marcas `soloDemo` corresponden a una pantalla realmente gateada', () => {
    // Una marca de más también miente: esconde en producción algo que sí funciona.
    const deMas = TODOS_LOS_PASOS.filter((p) => p.soloDemo && p.cta && !GATEADAS.includes(p.cta.href)).map(
      (p) => `«${p.titulo}» → ${p.cta!.href}`,
    );
    expect(deMas, 'este paso está marcado soloDemo pero su pantalla funciona en producción').toEqual([]);
  });
});
