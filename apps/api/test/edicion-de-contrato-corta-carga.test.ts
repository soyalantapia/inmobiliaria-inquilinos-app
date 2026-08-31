/**
 * T-11-d · Todo endpoint que EDITA un contrato existente decide explícitamente qué hace con CARGA.
 *
 * POR QUÉ ESTE TEST EXISTE. Los cinco endpoints de edición de contrato pasan por la misma
 * capacidad (`contratos.crear`, que incluye a CARGA) y después, cada uno por su cuenta, repiten
 * a mano un `if (u.rol === 'CARGA') return 403`. No hay ningún middleware que lo garantice: es
 * disciplina copiada cinco veces.
 *
 * Y falló. `PATCH /contratos/:id/inquilino-contacto` nació sin el corte porque en su momento
 * sólo escribía el teléfono — y cuando T-45 le agregó el email (que es el LOGIN del inquilino:
 * el OTP viaja ahí), nadie volvió a mirar el permiso. El docblock siguió diciendo "scope: solo
 * teléfono" durante todo ese tiempo.
 *
 * El sexto endpoint se lo va a olvidar igual. Esto lo convierte en un rojo en vez de en un
 * agujero: si alguien agrega un PATCH/PUT bajo `/contratos/:id`, o tiene el corte, o tiene que
 * venir acá y declarar por escrito por qué CARGA sí puede.
 *
 * NO NECESITA BASE: lee el fuente.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FUENTE = fileURLToPath(new URL('../src/routes/core.ts', import.meta.url));

/**
 * Endpoints de edición donde CARGA SÍ puede, a propósito. Agregar acá es una decisión, no un
 * trámite: cada uno lleva el motivo.
 */
const CARGA_PUEDE: Record<string, string> = {
  // Corregir un teléfono no reapunta nada y es justo para lo que existe el endpoint. El EMAIL
  // del mismo endpoint sí corta a CARGA (guard adentro del handler), y eso lo cubre
  // `carga-no-cambia-la-credencial.test.ts` con el 403 de verdad.
  "'/contratos/:id/inquilino-contacto'": 'sólo el teléfono; el email corta adentro del handler',
  // La garantía es papelerío del alta, que es literalmente el trabajo de CARGA. Y no hay
  // credencial en juego: el garante NO tiene acceso a ninguna app —no existe login de garante—,
  // así que su `contactoEmail` es un dato de contacto y nada más. Cortar el PUT dejando abierto
  // el POST/DELETE (que tampoco cortan) sería además incoherente: podría borrarlo y volver a
  // crearlo con los datos nuevos.
  "'/contratos/:id/garantes/:garanteId'": 'papelerío del alta; el garante no tiene login',
};

/** Handlers `app.patch|put('/contratos/:id/...')` con su cuerpo, por llaves balanceadas. */
function handlersDeEdicion(src: string): { ruta: string; cuerpo: string }[] {
  const salida: { ruta: string; cuerpo: string }[] = [];
  const re = /app\.(?:patch|put)\((\s*'\/contratos\/:id\/[^']+')\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let prof = 0;
    let i = re.lastIndex;
    let inicio = -1;
    for (; i < src.length; i++) {
      if (src[i] === '{') {
        if (prof === 0) inicio = i;
        prof++;
      } else if (src[i] === '}') {
        prof--;
        if (prof === 0) break;
      }
    }
    salida.push({ ruta: m[1].trim(), cuerpo: src.slice(inicio, i) });
  }
  return salida;
}

const src = readFileSync(FUENTE, 'utf8');
const handlers = handlersDeEdicion(src);

describe('T-11-d — la edición de un contrato corta a CARGA (o lo declara)', () => {
  it('el parser encontró los endpoints: si esto baja, el test dejó de medir', () => {
    // Control negativo del propio instrumento. Un test estructural que no encuentra nada pasa
    // en verde y no mide nada — ya pasó una vez en este repo (`metricas-moneda.test.ts`).
    expect(handlers.length).toBeGreaterThanOrEqual(5);
    const rutas = handlers.map((h) => h.ruta);
    expect(rutas).toContain("'/contratos/:id/monto'");
    expect(rutas).toContain("'/contratos/:id/inquilino-contacto'");
  });

  it('cada handler de edición corta a CARGA o está declarado en CARGA_PUEDE', () => {
    const sinCorte = handlers
      .filter((h) => !/u\.rol\s*===\s*'CARGA'/.test(h.cuerpo))
      .map((h) => h.ruta)
      .filter((r) => !(r in CARGA_PUEDE));

    expect(
      sinCorte,
      `Estos endpoints editan un contrato existente y no dicen nada sobre CARGA:\n` +
        sinCorte.map((r) => `  - ${r}`).join('\n') +
        `\n\nCARGA entra por \`contratos.crear\`, y lo que ese rol carga espera aprobación. Un ` +
        `endpoint de edición escribe DIRECTO: no hay aprobación que lo frene. O le ponés el ` +
        `\`if (u.rol === 'CARGA') return 403\`, o lo agregás a CARGA_PUEDE con el motivo.`,
    ).toEqual([]);
  });

  it('lo declarado en CARGA_PUEDE sigue existiendo (no queda una excepción huérfana)', () => {
    // Si el endpoint se borra o se renombra, la excepción se queda tapando a un endpoint que
    // ya no es ese. Que muera con él.
    const rutas = new Set(handlers.map((h) => h.ruta));
    for (const r of Object.keys(CARGA_PUEDE)) expect(rutas.has(r), `excepción huérfana: ${r}`).toBe(true);
  });
});
