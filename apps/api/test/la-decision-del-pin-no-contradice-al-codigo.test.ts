/**
 * T-25 · El documento que se lee ANTES de tocar auth decía lo contrario de lo que hay.
 *
 * `work-agent/05-DECISIONES.md §7` declara, como decisión LOCKED, que «el PIN de seguridad se
 * ELIMINÓ de toda la plataforma» y cierra con **«NO re-agregar prompts de PIN»**. Eso sigue
 * siendo verdad para las ACCIONES —`verificarPinUsuario()` devuelve `{ ok: true }` siempre— pero
 * dejó de serlo para una cosa: desde T-25 existe el **conmutador de usuarios del mostrador**, que
 * pide su propio PIN, con su propio lockout, para cambiar de persona en la máquina compartida.
 * Está construido, testeado y con migración aplicada.
 *
 * POR QUÉ ESTO ES UN TEST Y NO SÓLO UNA CORRECCIÓN AL DOCUMENTO. El daño de esa contradicción no
 * es que alguien se confunda leyendo: es que un agente **disciplinado**, que respeta la decisión
 * escrita, desarme el conmutador entero creyendo que está limpiando legado — y se lleve puesta
 * una migración aplicada. Cuanto más en serio se toma el documento, peor sale. La propia ficha de
 * T-25 lo había anotado como su paso 1, y nadie lo hizo en meses.
 *
 * Un documento no tiene quién lo ponga en rojo. Éste sí.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const CONMUTADOR = join(REPO, 'apps', 'api', 'src', 'auth', 'pin-conmutador.ts');
const DECISIONES = join(REPO, 'work-agent', '05-DECISIONES.md');
const SPEC = join(REPO, 'work-agent', '10-SPEC-T25-CONMUTADOR.md');

const leer = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

describe('la decisión escrita del PIN no contradice al código', () => {
  it('CONTROL DEL CONTROL — los tres archivos existen; si no, esto no mide nada', () => {
    // Si el conmutador se elimina algún día POR DECISIÓN, este caso se pone rojo y obliga a
    // borrar el test a mano. Es lo que se quiere: que sacarlo sea un acto, no un descuido.
    expect(existsSync(CONMUTADOR), 'apps/api/src/auth/pin-conmutador.ts').toBe(true);
    expect(leer(DECISIONES), 'work-agent/05-DECISIONES.md').toBeTruthy();
    expect(leer(SPEC), 'work-agent/10-SPEC-T25-CONMUTADOR.md').toBeTruthy();
  });

  it('🔴 §7 de 05-DECISIONES nombra la excepción del conmutador', () => {
    const doc = leer(DECISIONES)!;
    const desde = doc.indexOf('### 7. El PIN de seguridad se ELIMINÓ');
    expect(desde, 'no se encontró §7 — ¿se renumeró el documento?').toBeGreaterThan(-1);
    const hasta = doc.indexOf('\n### 8.', desde);
    expect(hasta, 'no se encontró el final de §7').toBeGreaterThan(desde);
    const seccion = doc.slice(desde, hasta);

    // Sin esto, §7 se lee como «ningún PIN, en ningún lado», y lo único que hay en pantalla para
    // contradecirlo es código que el lector todavía no abrió.
    expect(seccion, '§7 dice «NO re-agregar prompts de PIN» sin nombrar el conmutador que SÍ lo usa').toMatch(
      /conmutador/i,
    );
    expect(seccion).toMatch(/pin-conmutador/);
  });

  it('🔴 la línea de Estado de la spec de T-25 dice que está construido', () => {
    // Decía «Estado: spec cerrada, implementación NO iniciada» con todo construido y desplegado.
    // Es el otro documento que alguien lee antes de decidir qué hacer con esto.
    //
    // Se afirma en POSITIVO y sólo sobre la línea de Estado, no «que no aparezca la frase vieja»
    // en todo el archivo. La primera versión hacía eso y se puso roja con el texto que explica
    // qué decía antes — el mismo error que ya me comí dos veces hoy en otros dos controles. Una
    // afirmación negativa sobre un documento castiga contar la historia; una positiva no.
    const estado = leer(SPEC)!
      .split(/\r?\n/)
      .find((l) => l.startsWith('**Estado:'));
    expect(estado, 'la spec no tiene una línea **Estado:** al principio').toBeTruthy();
    expect(estado!).toMatch(/IMPLEMENTACIÓN HECHA|implementación (hecha|desplegada)/i);
  });

  it('CONTROL POSITIVO — el kill-switch de las ACCIONES sigue apagado, que es lo que §7 protege', () => {
    // La enmienda NO revive el PIN de las acciones. Si alguien hace que `verificarPinUsuario`
    // vuelva a verificar de verdad, los seis endpoints de plata que la llaman empiezan a exigir
    // un PIN que casi nadie tiene cargado. Ese es el riesgo que §7 vino a evitar y sigue en pie.
    const pin = readFileSync(join(REPO, 'apps', 'api', 'src', 'auth', 'pin.ts'), 'utf8');
    expect(pin).toMatch(/return\s*\{\s*ok:\s*true\s*\}/);
  });
});
