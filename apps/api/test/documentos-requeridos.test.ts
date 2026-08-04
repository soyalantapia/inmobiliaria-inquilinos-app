import { describe, it, expect } from 'vitest';
import {
  DOCS_REQUERIDOS_TITULAR,
  DOCS_REQUERIDOS_POR_GARANTE,
  MAX_GARANTES,
  claveDocumento,
  documentosRequeridos,
  enumerarFaltantes,
  faltantesDeExpediente,
  type DocPresente,
} from '../../inmobiliaria/src/lib/documentos-requeridos';

/**
 * Unit de la fórmula del expediente, que vive en el front
 * (`apps/inmobiliaria/src/lib/documentos-requeridos.ts`).
 *
 * POR QUÉ ESTÁ EN apps/api Y NO AL LADO DEL MÓDULO: `apps/inmobiliaria` no tiene
 * runner de tests — el único `vitest.config.ts` del monorepo es el de esta app.
 * Montar vitest en el panel es infra nueva, así que el test se pone donde SÍ
 * corre. El módulo es TypeScript puro (sin React, sin DOM: todo el acceso a
 * `window` de `contrato-documentos-storage` está adentro de funciones que este
 * archivo no llama), por eso importa limpio en Node.
 *
 * Lo que justifica el test: esta función es ahora la ÚNICA fuente de "cuánto
 * falta" para tres pantallas —el paso del alta, el checklist del detalle y el
 * badge del tab—. Si se desincroniza no rompe nada visiblemente: solo empieza a
 * mostrar un número equivocado, que es exactamente el bug que la función vino a
 * eliminar.
 */

const doc = (tipo: string, garanteIndex?: number): DocPresente =>
  ({ tipo, garanteIndex } as DocPresente);

/** Los 4 del titular, cargados. */
const TITULAR_COMPLETO: DocPresente[] = DOCS_REQUERIDOS_TITULAR.map((t) => doc(t));

describe('documentosRequeridos — cuántos papeles pide un expediente', () => {
  it('sin garantes son los 4 del titular (0 es válido: existe el seguro de caución)', () => {
    const r = documentosRequeridos(0);
    expect(r.map((d) => d.tipo)).toEqual([...DOCS_REQUERIDOS_TITULAR]);
    expect(r.every((d) => d.garanteIndex === undefined)).toBe(true);
  });

  it('con 2 garantes son 4 + 2×2 = 8, con índices 1-based', () => {
    const r = documentosRequeridos(2);
    expect(r).toHaveLength(4 + 2 * DOCS_REQUERIDOS_POR_GARANTE.length);
    const deGarante = r.filter((d) => d.garanteIndex != null);
    expect(deGarante.map((d) => d.garanteIndex)).toEqual([1, 1, 2, 2]);
    // El primero es el garante 1, no el 0: el back rechaza garanteIndex 0.
    expect(Math.min(...deGarante.map((d) => d.garanteIndex!))).toBe(1);
  });

  it('clampea a 0..MAX_GARANTES y aguanta basura (un <Select> puede mandar cualquier cosa)', () => {
    expect(documentosRequeridos(99)).toHaveLength(4 + MAX_GARANTES * 2);
    expect(documentosRequeridos(-3)).toHaveLength(4);
    expect(documentosRequeridos(1.7), 'trunca, no redondea para arriba').toHaveLength(6);
    expect(documentosRequeridos(Number.NaN)).toHaveLength(4);
  });

  it('la clave separa el mismo tipo entre garantes distintos', () => {
    const claves = documentosRequeridos(3).map((d) => d.clave);
    expect(new Set(claves).size, 'ninguna clave repetida').toBe(claves.length);
    expect(claves).toContain('DNI_GARANTE_FRENTE::g2');
    expect(claveDocumento('RECIBO_SUELDO')).toBe('RECIBO_SUELDO');
    expect(claveDocumento('RECIBO_SUELDO', 2)).toBe('RECIBO_SUELDO::g2');
  });
});

describe('faltantesDeExpediente — qué falta', () => {
  it('expediente VACÍO sin garantes: faltan los 4, presentes 0', () => {
    const r = faltantesDeExpediente([], 0);
    expect(r.total).toBe(4);
    expect(r.presentes).toBe(0);
    expect(r.faltantes).toHaveLength(4);
    expect(r.faltantes.map((f) => f.tipo)).toEqual([...DOCS_REQUERIDOS_TITULAR]);
  });

  it('expediente VACÍO con 2 garantes: faltan los 8 (no 4)', () => {
    const r = faltantesDeExpediente([], 2);
    expect(r.total).toBe(8);
    expect(r.faltantes).toHaveLength(8);
  });

  it('expediente COMPLETO: faltantes vacío y presentes = total', () => {
    const presentes: DocPresente[] = [
      ...TITULAR_COMPLETO,
      ...DOCS_REQUERIDOS_POR_GARANTE.map((t) => doc(t, 1)),
      ...DOCS_REQUERIDOS_POR_GARANTE.map((t) => doc(t, 2)),
    ];
    const r = faltantesDeExpediente(presentes, 2);
    expect(r.faltantes).toEqual([]);
    expect(r.presentes).toBe(r.total);
    expect(r.total).toBe(8);
  });

  it('el DNI del garante 1 NO tapa el del garante 2 (era el bug de la clave sin índice)', () => {
    const presentes = [...TITULAR_COMPLETO, ...DOCS_REQUERIDOS_POR_GARANTE.map((t) => doc(t, 1))];
    const r = faltantesDeExpediente(presentes, 2);
    expect(r.presentes).toBe(6);
    expect(r.faltantes.map((f) => f.garanteIndex)).toEqual([2, 2]);
  });

  it('un papel del garante NO tapa el requerido del titular del mismo tipo', () => {
    // Recibo de sueldo del garante 2 cargado, el del titular no.
    const r = faltantesDeExpediente([doc('RECIBO_SUELDO', 2)], 0);
    expect(r.faltantes.map((f) => f.tipo)).toContain('RECIBO_SUELDO');
    expect(r.presentes).toBe(0);
  });

  it('lo que sobra no suma: papeles fuera de la lista de requeridos no mueven el número', () => {
    const r = faltantesDeExpediente([...TITULAR_COMPLETO, doc('PAGARE'), doc('SEGURO_CAUCION')], 0);
    expect(r.total).toBe(4);
    expect(r.presentes, 'presentes cuenta REQUERIDOS cubiertos, no documentos cargados').toBe(4);
  });

  it('un duplicado del mismo papel tampoco infla el conteo', () => {
    const r = faltantesDeExpediente([doc('CONTRATO_FIRMADO'), doc('CONTRATO_FIRMADO')], 0);
    expect(r.presentes).toBe(1);
    expect(r.faltantes).toHaveLength(3);
  });

  it('acepta garanteIndex null (así viene de la API) igual que undefined', () => {
    const desdeApi = [{ tipo: 'CONTRATO_FIRMADO' as const, garanteIndex: null }];
    const r = faltantesDeExpediente(desdeApi, 0);
    expect(r.presentes, 'null y undefined tienen que dar la MISMA clave').toBe(1);
  });
});

describe('enumerarFaltantes — el separador canónico', () => {
  it('vacío, uno, dos y tres', () => {
    const [a, b, c] = documentosRequeridos(0);
    expect(enumerarFaltantes([])).toBe('');
    expect(enumerarFaltantes([a!])).toBe(a!.etiqueta);
    expect(enumerarFaltantes([a!, b!])).toBe(`${a!.etiqueta} y ${b!.etiqueta}`);
    expect(enumerarFaltantes([a!, b!, c!])).toBe(`${a!.etiqueta}, ${b!.etiqueta} y ${c!.etiqueta}`);
  });

  it('nombra el garante, que es lo único que distingue dos papeles iguales', () => {
    const { faltantes } = faltantesDeExpediente(TITULAR_COMPLETO, 2);
    const texto = enumerarFaltantes(faltantes);
    expect(texto).toContain('Garante 1');
    expect(texto).toContain('Garante 2');
  });
});
