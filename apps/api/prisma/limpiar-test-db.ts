/**
 * Limpieza de la DB de TEST: saca lo que dejaron corridas cortadas a mitad.
 *
 * POR QUÉ EXISTE. La DB de test es COMPARTIDA entre sesiones y `vitest.config.ts` corre
 * con `fileParallelism: false`, así que una suite que muere antes de su `afterAll`
 * —Ctrl-C, un kill, la sesión que se cae— deja sus fixtures adentro. Eso después rompe
 * suites AJENAS, y de la peor forma posible: con fallas que parecen bugs del código.
 * Los síntomas reales que ya costaron tiempo:
 *   · core.test.ts: "GET /contratos devuelve los 8 del seed" → 10. Las aserciones de
 *     conteo del seed son las primeras en caer.
 *   · consorcios.test.ts: "Unique constraint failed on (codigoReferido)" al crear su
 *     tenant B, porque el tenant B de la corrida anterior nunca se borró.
 *   · multi-alquiler.test.ts: 409 "ya está en tu cartera" por un inquilino sobreviviente.
 * Ninguno de esos es un bug: son restos. Antes de sospechar del código, corré esto.
 *
 *   pnpm --filter @llave/api test:clean
 *
 * QUÉ BORRA. Sólo lo que NO pertenece al seed:
 *   · Los tenants de prueba `ZZ-TEST-*` enteros (ningún test los espera preexistentes).
 *   · Del tenant del seed, las filas cuyo id NO tiene la forma estable `cnt_001`,
 *     `prp_002`, `own_003`… El seed usa ids fijos justamente para poder distinguirlos;
 *     todo lo que tenga un cuid autogenerado lo creó un test.
 * Los inquilinos del seed son la excepción: nacen con cuid, así que se identifican por
 * su contrato (los del seed cuelgan de un `cnt_00N`).
 *
 * NO TOCA producción: usa la DATABASE_URL de `apps/api/.env`, que apunta a la base de
 * test. Igual verifica el host y aborta si huele a prod — este script borra datos y no
 * hay ninguna razón para que corra en otro lado.
 */
import { PrismaClient } from '@prisma/client';
import { exigirDbDeTest } from './guard-db.js';
import { borrarContratosDeTest } from './borrar-contratos-de-test.js';

const ID_SEED = /^[a-z]+_\d+$/; // cnt_001, prp_002, own_003…
const esDelSeed = (id: string) => ID_SEED.test(id);

async function main() {
  // Guard de seguridad: este script BORRA. Si la URL no es una base de test conocida,
  // no corre. Antes el criterio estaba escrito acá adentro con un regex propio y
  // `seedBase` no tenía ninguno: dos scripts destructivos con dos reglas distintas (una
  // de ellas inexistente). Ahora los dos preguntan lo mismo, en `guard-db.ts`, y ese
  // criterio falla cerrado ante una URL desconocida en vez de dejar pasar.
  exigirDbDeTest('limpiar-test-db');
  const prisma = new PrismaClient();
  const borrado: string[] = [];

  // ===== 1. Tenants de prueba enteros =====
  const zz = await prisma.inmobiliaria.findMany({
    where: { nombre: { startsWith: 'ZZ-TEST' } },
    select: { id: true, nombre: true },
  });
  for (const t of zz) {
    const w = { inmobiliariaId: t.id };
    // De hijos a padres: las FK son RESTRICT en casi todo el esquema.
    await prisma.movimientoConsorcio.deleteMany({ where: w }).catch(() => {});
    await prisma.unidadFuncional.deleteMany({ where: { consorcio: w } }).catch(() => {});
    await prisma.consorcio.deleteMany({ where: w }).catch(() => {});
    await prisma.usuario.deleteMany({ where: w });
    await prisma.inmobiliaria.deleteMany({ where: { id: t.id } });
    borrado.push(`tenant ${t.nombre}`);
  }

  // ===== 2. Fixtures dentro del tenant del seed =====
  const seed = await prisma.inmobiliaria.findFirst({
    where: { nombre: 'Inmobiliaria del Sol' },
    select: { id: true },
  });
  if (seed) {
    const w = { inmobiliariaId: seed.id };
    const contratos = await prisma.contrato.findMany({ where: w, select: { id: true } });
    const propiedades = await prisma.propiedad.findMany({ where: w, select: { id: true } });
    const propietarios = await prisma.propietario.findMany({ where: w, select: { id: true } });

    const cIds = contratos.map((c) => c.id).filter((id) => !esDelSeed(id));
    const pIds = propiedades.map((p) => p.id).filter((id) => !esDelSeed(id));
    const oIds = propietarios.map((o) => o.id).filter((id) => !esDelSeed(id));

    // Los inquilinos del seed nacen con cuid → se reconocen por su contrato del seed.
    const inquilinos = await prisma.inquilino.findMany({
      where: w,
      select: { id: true, contratoId: true },
    });
    const iIds = inquilinos
      .filter((i) => !i.contratoId || !esDelSeed(i.contratoId))
      .map((i) => i.id);

    if (cIds.length || pIds.length || oIds.length || iIds.length) {
      // Lo que cuelga de la PROPIEDAD y no del contrato: el helper no lo alcanza ni debe.
      await prisma.gastoRendido.deleteMany({ where: { propiedadId: { in: pIds } } }).catch(() => {});
      await prisma.movimientoCaja.deleteMany({ where: { propiedadId: { in: pIds } } }).catch(() => {});

      // Los contratos con TODO lo que les cuelga (33 modelos, ninguno cascadea), por el helper
      // compartido de T-28-N3. Antes esto borraba a mano cuatro hijos, y cuando el alta empezó
      // a escribir `EventoContrato` (T-29) el `contrato.deleteMany` moría con P2003 y el script
      // no limpiaba NADA — ni propiedades ni propietarios—, porque ese delete es de los pocos
      // sin `.catch`. Justamente acá duele más: este script se corre PARA salir de una corrida
      // cortada a mitad, o sea cuando esos huérfanos existen seguro.
      //
      // T-28-N3 dejó escrito "el helper existe y el que rompa, se migra". Éste rompió.
      await borrarContratosDeTest(prisma, cIds);

      // Los inquilinos que quedan son los que NO colgaban de esos contratos: el filtro de
      // arriba también toma las filas sin `contratoId`.
      await prisma.inquilino.deleteMany({ where: { id: { in: iIds } } }).catch(() => {});
      await prisma.participacionPropietario.deleteMany({
        where: { OR: [{ propiedadId: { in: pIds } }, { propietarioId: { in: oIds } }] },
      });
      await prisma.propiedad.deleteMany({ where: { id: { in: pIds } } });
      await prisma.propietario.deleteMany({ where: { id: { in: oIds } } });
      borrado.push(
        `${cIds.length} contratos, ${pIds.length} propiedades, ${oIds.length} propietarios, ${iIds.length} inquilinos`,
      );
    }

    const [c, p, o, i] = await Promise.all([
      prisma.contrato.count({ where: w }),
      prisma.propiedad.count({ where: w }),
      prisma.propietario.count({ where: w }),
      prisma.inquilino.count({ where: w }),
    ]);
    console.log(`seed → contratos:${c} propiedades:${p} propietarios:${o} inquilinos:${i}`);
    if (c !== 8 || p !== 6 || o !== 5 || i !== 7) {
      console.log('⚠️  No coincide con el seed limpio (8/6/5/7). Revisá a mano antes de correr la suite.');
    }
  }

  console.log(borrado.length ? `Limpiado: ${borrado.join(' · ')}` : 'Nada que limpiar.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
