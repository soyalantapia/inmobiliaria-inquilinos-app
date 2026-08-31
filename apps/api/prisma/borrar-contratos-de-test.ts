import type { PrismaClient } from '@prisma/client';
import { exigirDbDeTest } from './guard-db.js';

/**
 * Borra contratos de prueba con todo lo que les cuelga. Para los `afterAll` de la suite.
 *
 * POR QUÉ EXISTE. De las 23 FK que apuntan a `contratos`, **16 son RESTRICT y 7 son SET NULL**
 * (una de las 23 es la inversa, `propiedades.contratoActualId`). Ninguna cascadea. Así que
 * borrar un contrato exige borrar antes, a mano, cada hijo que bloquea — y limpiar los que no
 * bloquean pero quedan huérfanos ensuciando los conteos de otras suites.
 *
 * Hasta ahora cada teardown borraba los pocos que su propio flujo llegaba a crear, y funcionaba
 * **por casualidad**: el día que el alta empezó a escribir `EventoContrato` (T-29),
 * `multi-alquiler.test.ts` se cayó entero por su `afterAll`, no por sus tests. El fallo aparece
 * lejos de su causa: el rojo sale en la limpieza de un archivo que nadie tocó.
 *
 * Y el árbol es más grande de lo que parece: **22 hijos y 10 nietos**. Nadie mantiene eso a mano
 * en cincuenta `afterAll`.
 *
 * POR QUÉ NO SE CASCADEA EN EL SCHEMA, que sería lo obvio. Porque las migraciones se aplican
 * SOLAS en el deploy (el `CMD` del Dockerfile corre `prisma migrate deploy`), así que poner
 * CASCADE no sería un cambio de tests: cambiaría el comportamiento de PRODUCCIÓN. Hoy el
 * RESTRICT es exactamente lo que impide que borrar un contrato se lleve pagos, comprobantes y
 * certificados en silencio. Es una red, no un estorbo — la molestia es de los tests y se paga
 * en los tests.
 *
 * QUE NO SE QUEDE CORTO. `test/hijos-de-contrato-sincronizados.test.ts` lee el schema y se pone
 * rojo si aparece un hijo o un nieto nuevo, si el orden viola una FK entre hijos, o si el nombre
 * de una columna FK no coincide. Sin eso, esto se desactualiza igual que los teardowns que vino
 * a reemplazar — sólo que en un lugar en vez de cincuenta.
 */

/**
 * Nietos: cuelgan de un hijo, no del contrato. Son los que más se olvidan porque no aparecen
 * mirando `Contrato`, sólo mirando cada hijo.
 *
 * La columna FK va **declarada**, no derivada del nombre del modelo. Derivarla parecía gratis y
 * era un bug: `InquilinoInvitado` + 'Id' da `inquilinoInvitadoId`, y la columna real se llama
 * `invitadoId`. Los otros tres grupos coincidían por casualidad. El test de sincronización
 * compara estos nombres contra el schema justamente por eso.
 */
export const NIETOS_POR_HIJO: Record<string, { fk: string; nietos: string[] }> = {
  Inquilino: { fk: 'inquilinoId', nietos: ['codigoOtp', 'anuncioAcuse', 'documento'] },
  Pago: { fk: 'pagoId', nietos: ['creditoDetectado'] },
  Reclamo: {
    fk: 'reclamoId',
    nietos: ['reclamoEvento', 'visitaProfesional', 'confirmacionReclamo', 'ratingReclamo'],
  },
  InquilinoInvitado: {
    fk: 'invitadoId',
    nietos: ['coInquilinoInvitado', 'documentoAdjuntoInvitado'],
  },
};

/**
 * Los 22 hijos directos, EN ORDEN DE BORRADO. El orden respeta las FK que hay ENTRE hijos, que
 * son fáciles de pasar por alto: `Pago`→`Liquidacion` y `CertificadoInquilino`→`Inquilino` son
 * RESTRICT, así que el que apunta va antes que el apuntado.
 *
 * `Propiedad` no está acá aunque tenga un FK a Contrato: no se borra, se le corta el lazo.
 */
export const HIJOS_EN_ORDEN = [
  // Primero los que apuntan a otros hijos.
  'certificadoInquilino',
  'comprobante',
  'pago',
  'cargoPagado',
  // Sube acá con T-28-N1-N1: `MovimientoCaja.cargoId` apunta a `CargoContrato`, así que tiene
  // que irse ANTES que él. La FK es `onDelete: SetNull`, o sea que borrar al revés no reventaría
  // —dejaría el puntero en null—, pero el orden se mantiene estricto a propósito: el día que
  // alguna FK nueva sí sea Restrict, el invariante ya está bien y no hay que descubrirlo con
  // un borrado que falla a mitad de camino.
  'movimientoCaja',
  'cargoContrato',
  // Ahora los apuntados.
  'liquidacion',
  'reclamo',
  'inquilino',
  // El resto, sin dependencias entre sí.
  'contratoDraft',
  'garante',
  'ajusteAlquiler',
  'renovacionContrato',
  'coInquilino',
  'screening',
  'eventoContrato',
  'intencionRenovacion',
  'movimientoFeed',
  'documentoContrato',
  'inquilinoInvitado',
  'boletaServicio',
  'chatMensaje',
] as const;

/**
 * @param contratoIds los contratos a borrar. Vacío no hace nada — así el caller no necesita el
 *   `if`, que es justo el detalle que se olvida.
 */
export async function borrarContratosDeTest(
  prisma: PrismaClient,
  contratoIds: string[],
): Promise<void> {
  // Este helper BORRA. Mismo guard que `seedBase` y `limpiar-test-db`: ante una URL que no sea
  // de test conocida, no corre. Falla cerrado.
  exigirDbDeTest('borrarContratosDeTest');
  if (contratoIds.length === 0) return;

  const donde = { contratoId: { in: contratoIds } };
  // any-justified: recorrer modelos por nombre es el punto de este helper — la alternativa son
  // 32 líneas a mano, que es el bug que vino a matar. El test de sincronización con el schema
  // es lo que garantiza que los nombres existan y sean los correctos.
  const db = prisma as unknown as Record<
    string,
    {
      deleteMany: (a: unknown) => Promise<unknown>;
      findMany: (a: unknown) => Promise<{ id: string }[]>;
    }
  >;

  // 1. Los nietos, por el hijo del que cuelgan.
  for (const [hijo, { fk, nietos }] of Object.entries(NIETOS_POR_HIJO)) {
    const campo = hijo.charAt(0).toLowerCase() + hijo.slice(1);
    const padres = await db[campo]!.findMany({ where: donde, select: { id: true } });
    const ids = padres.map((p) => p.id);
    for (const nieto of nietos) {
      await db[nieto]!.deleteMany({ where: { [fk]: { in: ids } } });
    }
  }

  // 2. Los hijos directos, en orden.
  for (const hijo of HIJOS_EN_ORDEN) {
    if (hijo === 'cargoPagado') {
      // `CargoPagado.contratoId` es NULLABLE: el que bloquea es `reclamoId`, que es NOT NULL y
      // RESTRICT. Filtrando sólo por contrato, una fila con `contratoId = null` sobrevive y
      // después hace fallar el borrado del reclamo — que es el paso siguiente.
      await db[hijo]!.deleteMany({
        where: { OR: [donde, { reclamo: donde }] },
      });
      continue;
    }
    await db[hijo]!.deleteMany({ where: donde });
  }

  // 3. El contrato.
  await prisma.contrato.deleteMany({ where: { id: { in: contratoIds } } });

  // 4. El lazo, DESPUÉS. `propiedades.contratoActualId` es SET NULL, así que nunca bloqueó
  // borrar el contrato — Postgres ya lo dejó en null solo. Este `updateMany` es defensivo y
  // sirve para el caso en que el caller además vaya a borrar la propiedad: la FK que bloquea
  // ahí es `contratos.propiedadId`, en la otra dirección.
  await prisma.propiedad.updateMany({
    where: { contratoActualId: { in: contratoIds } },
    data: { contratoActualId: null },
  });
}
