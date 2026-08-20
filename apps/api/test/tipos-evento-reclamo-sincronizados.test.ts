import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CAZABUG — el enum creció y los dos fronts se cayeron.
 *
 * `TipoEventoReclamo` tiene 13 valores en Prisma. Cada front mantiene su propia copia escrita
 * a mano, y las dos se quedaron cortas, en mitades distintas:
 *
 *   - el panel no conocía los tres VISITA_* (los escribe el profesional desde el link público)
 *   - la PWA no conocía CLASIFICADO ni PROFESIONAL_ASIGNADO (los escribe la inmobiliaria)
 *
 * Los dos rendean con `labelForTipo[ev.tipo](ev)`. Un valor desconocido no es un renglón feo:
 * es `undefined(ev)`, o sea la pantalla entera se cae. Y pasaba justo en los reclamos donde
 * algo estaba pasando — los quietos se veían bien, que es lo que lo hizo durar seis semanas.
 *
 * TypeScript no lo agarró, y no era culpa suya: `Record<TipoEventoReclamo, X>` sí exige
 * exhaustividad y estaba completo. Comparaba contra la lista local, que era la que estaba mal.
 *
 * Este test es lo que ata las tres puntas. Si alguien agrega un valor al enum y no lo agrega a
 * los dos fronts, esto se pone rojo en el push en vez de romperle la pantalla a alguien.
 *
 * Lee el código en vez de ejecutarlo, a propósito: los fronts no tienen runner de tests y el
 * dato que importa es una lista de literales, no un comportamiento.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');

function valoresDelEnumPrisma(nombre: string): string[] {
  const schema = readFileSync(join(raiz, 'apps', 'api', 'prisma', 'schema.prisma'), 'utf8');
  const m = schema.match(new RegExp(`enum ${nombre} \\{([^}]*)\\}`));
  if (!m) throw new Error(`No encontré el enum ${nombre} en schema.prisma`);
  return m[1]!
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => l.length > 0);
}

// Los fronts declaran el tipo como una unión de literales:
//   export type TipoEvento = | 'CREADO' | 'ASIGNADO' | ... ;
function valoresDeLaUnion(archivo: string, nombreDelTipo: string): string[] {
  const src = readFileSync(join(raiz, archivo), 'utf8');
  const m = src.match(new RegExp(`export type ${nombreDelTipo} =([^;]*);`));
  if (!m) throw new Error(`No encontré \`export type ${nombreDelTipo}\` en ${archivo}`);
  return [...m[1]!.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]!);
}

const FRONTS = [
  {
    quien: 'el panel de la inmobiliaria',
    archivo: 'apps/inmobiliaria/src/lib/types.ts',
    tipo: 'TipoEventoReclamo',
  },
  {
    quien: 'la PWA del inquilino',
    archivo: 'apps/inquilino/src/lib/types.ts',
    tipo: 'TipoEvento',
  },
];

describe('los tipos de evento de reclamo están sincronizados con Prisma', () => {
  for (const f of FRONTS) {
    it(`${f.quien} conoce exactamente los 13 del enum`, () => {
      const enPrisma = valoresDelEnumPrisma('TipoEventoReclamo');
      const enElFront = valoresDeLaUnion(f.archivo, f.tipo);

      // El orden no importa (cada front lo ordena como le sirve al timeline); el conjunto sí.
      expect([...enElFront].sort()).toEqual([...enPrisma].sort());
    });
  }

  it('los tres que rompían el panel están en el panel', () => {
    const v = valoresDeLaUnion(FRONTS[0]!.archivo, FRONTS[0]!.tipo);
    expect(v).toContain('VISITA_CONFIRMADA');
    expect(v).toContain('VISITA_EN_CAMINO');
    expect(v).toContain('VISITA_LISTO');
  });

  it('los dos que rompían la PWA están en la PWA', () => {
    const v = valoresDeLaUnion(FRONTS[1]!.archivo, FRONTS[1]!.tipo);
    expect(v).toContain('CLASIFICADO');
    expect(v).toContain('PROFESIONAL_ASIGNADO');
  });

  it('los dos parsers funcionan (si devolvieran vacío, todo lo de arriba pasaría solo)', () => {
    expect(valoresDelEnumPrisma('TipoEventoReclamo')).toHaveLength(13);
    expect(valoresDelEnumPrisma('Moneda')).toEqual(['ARS', 'USD']);
    for (const f of FRONTS) expect(valoresDeLaUnion(f.archivo, f.tipo)).toHaveLength(13);
  });
});
