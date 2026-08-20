import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HIJOS_EN_ORDEN, NIETOS_POR_HIJO } from '../prisma/borrar-contratos-de-test.js';

/**
 * CAZABUG — el teardown se rompe solo cuando el alta escribe un hijo nuevo.
 *
 * Ningún FK a `Contrato` cascadea, así que borrar un contrato de prueba exige borrar antes cada
 * hijo a mano. Cuando T-29 hizo que el alta escribiera `EventoContrato`, `multi-alquiler.test.ts`
 * se cayó entero por su `afterAll` — un archivo que nadie había tocado, con un error que no
 * hablaba de la feature que lo causó.
 *
 * `borrarContratosDeTest` centraliza la lista, pero centralizar no alcanza: una lista a mano se
 * desactualiza igual, sólo que en un lugar en vez de cincuenta. Esto es lo que la mantiene
 * honesta — lee el schema y exige que la lista lo cubra.
 *
 * Corre en el job que BLOQUEA, así que un modelo hijo nuevo frena el merge hasta que alguien
 * decida si va al teardown. Que es exactamente la conversación que hoy no se tiene.
 */
const schema = readFileSync(
  join(import.meta.dirname, '..', 'prisma', 'schema.prisma'),
  'utf8',
);

const modelos = Object.fromEntries(
  [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map((m) => [m[1]!, m[2]!]),
);

/**
 * Modelos con un FK a `modeloPadre`, y con QUÉ COLUMNA apuntan.
 *
 * El `("nombre", )?` no es paranoia: Prisma admite relaciones con nombre —
 * `@relation("inquilino", fields: [...])`— y sin eso un hijo declarado así sería invisible
 * para este test, que es exactamente el agujero que se supone que tapa.
 */
function hijosDe(modeloPadre: string): { modelo: string; fk: string }[] {
  const encontrados: { modelo: string; fk: string }[] = [];
  for (const [nombre, cuerpo] of Object.entries(modelos)) {
    for (const linea of cuerpo.split('\n')) {
      const m = linea.match(
        new RegExp(`\\s${modeloPadre}\\??\\s+@relation\\((?:"[^"]*",\\s*)?fields:\\s*\\[(\\w+)\\]`),
      );
      if (m) encontrados.push({ modelo: nombre, fk: m[1]! });
    }
  }
  return encontrados;
}

/** Sólo los nombres, para las comparaciones de cobertura. */
const nombresDe = (padre: string) => [...new Set(hijosDe(padre).map((h) => h.modelo))];

/** `EventoContrato` → `eventoContrato`, que es como se llama en el cliente de Prisma. */
const aCliente = (m: string) => m.charAt(0).toLowerCase() + m.slice(1);

describe('borrarContratosDeTest cubre todo lo que cuelga de Contrato', () => {
  it('el parser encuentra el árbol (si devolviera vacío, todo lo de abajo pasaría solo)', () => {
    expect(Object.keys(modelos).length).toBeGreaterThan(50);
    expect(nombresDe('Contrato').length).toBeGreaterThan(15);
  });

  it('ningún hijo de Contrato queda afuera de la lista', () => {
    // `Propiedad` es la excepción declarada: no se borra, se le corta el lazo
    // `contratoActualId` (lo hace el helper). Borrarla sería sacar una propiedad del seed.
    const enElSchema = nombresDe('Contrato')
      .filter((m) => m !== 'Propiedad')
      .map(aCliente);
    const enLaLista = [...HIJOS_EN_ORDEN];

    expect([...enElSchema].sort()).toEqual([...enLaLista].sort());
  });

  it('ningún nieto queda afuera: los que cuelgan de un hijo bloquean igual', () => {
    // El olvido típico: no aparecen mirando `Contrato`, sólo mirando cada hijo.
    //
    // "Nieto" es el que cuelga de un hijo y NO es hijo él mismo. `Pago` y `Comprobante` cuelgan
    // de `Liquidacion`, pero también cuelgan directo de `Contrato`: ya están en la lista y se
    // borran antes que ella, así que no necesitan tratamiento aparte.
    const esHijoDirecto = new Set<string>(HIJOS_EN_ORDEN);
    for (const hijo of HIJOS_EN_ORDEN) {
      const modelo = hijo.charAt(0).toUpperCase() + hijo.slice(1);
      const nietosEnSchema = nombresDe(modelo).map(aCliente).filter((n) => !esHijoDirecto.has(n));
      const nietosDeclarados = NIETOS_POR_HIJO[modelo]?.nietos ?? [];
      expect(
        [...nietosEnSchema].sort(),
        `${modelo} tiene hijos en el schema que el teardown no borra`,
      ).toEqual([...nietosDeclarados].sort());
    }
  });

  it('el orden respeta las FK ENTRE hijos: el que apunta va antes que el apuntado', () => {
    // Son cinco y son las que rompen el borrado si el orden está mal. Se derivan del schema,
    // no se escriben a mano, así que una nueva relación entre hijos también queda cubierta.
    const posicion = new Map(HIJOS_EN_ORDEN.map((h, i) => [h, i]));
    for (const hijo of HIJOS_EN_ORDEN) {
      const modelo = hijo.charAt(0).toUpperCase() + hijo.slice(1);
      const cuerpo = modelos[modelo] ?? '';
      for (const linea of cuerpo.split('\n')) {
        const m = linea.match(/\s(\w+)\??\s+@relation\((?:"[^"]*",\s*)?fields:\s*\[/);
        const apuntado = m?.[1] ? aCliente(m[1]) : null;
        if (!apuntado || apuntado === hijo || !posicion.has(apuntado)) continue;
        expect(
          posicion.get(hijo)!,
          `${hijo} apunta a ${apuntado}, así que tiene que borrarse ANTES`,
        ).toBeLessThan(posicion.get(apuntado)!);
      }
    }
  });

  it('la columna FK de cada nieto es la que dice el schema, no la que parece', () => {
    // ESTE es el test que faltaba. La primera versión del helper derivaba la columna del
    // nombre del modelo (`InquilinoInvitado` + 'Id') y para tres de los cuatro grupos daba
    // bien de casualidad; para el cuarto daba `inquilinoInvitadoId` cuando la columna real se
    // llama `invitadoId`. El borrado de esos nietos no hacía nada y nadie se enteraba.
    for (const [modelo, { fk, nietos }] of Object.entries(NIETOS_POR_HIJO)) {
      for (const nieto of nietos) {
        const modeloNieto = nieto.charAt(0).toUpperCase() + nieto.slice(1);
        const fksReales = hijosDe(modelo)
          .filter((h) => h.modelo === modeloNieto)
          .map((h) => h.fk);
        expect(fksReales, `${modeloNieto} no declara ningún FK a ${modelo}`).not.toHaveLength(0);
        expect(
          fksReales,
          `${modeloNieto} apunta a ${modelo} por ${fksReales.join('/')}, no por "${fk}"`,
        ).toContain(fk);
      }
    }
  });
});
