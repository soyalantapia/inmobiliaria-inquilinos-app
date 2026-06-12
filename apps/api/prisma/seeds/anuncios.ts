/**
 * Seeds Fase 5 — Comunicación: anuncios con acuses reales.
 *
 * Porta los SEEDS del mock del front (apps/inmobiliaria/src/lib/anuncios-storage.ts)
 * con sus IDS EXACTOS (anu_seed_1/2/3). Decisiones:
 *
 * - Canales normalizados a APP+EMAIL en los 3 seeds (decisión de producto:
 *   siempre ambos; el mock tenía variantes con WHATSAPP que quedan afuera).
 * - destinatariosCount conserva los valores del mock (12 / 6 / 6): es el
 *   snapshot de a cuánta gente llegó el envío en su momento, no se recalcula.
 * - Upsertea el consorcio cnsr_001 (Gorriti 4521, datos exactos del mock de
 *   consorcios-storage.ts) porque anu_seed_1 lo necesita como audiencia, y
 *   linkea prp_001.consorcioId = cnsr_001 (la FK que reemplaza el match
 *   heurístico por dirección). Si el dominio consorcios ya lo sembró, el
 *   upsert con update:{} no lo pisa.
 * - Siembra acuses REALES de otros inquilinos (Juan, Laura, Carlos, Ana) sobre
 *   anu_seed_2 y anu_seed_3 para que el panel muestre conteos vivos desde la
 *   tabla (reemplaza la simulación determinística del mock). Mariela queda SIN
 *   acuses a propósito: su flujo leído→enterado es la demo del loop real.
 *   Conteos resultantes: anu_seed_1 → 0/0 de 12 · anu_seed_2 → 4 leídos /
 *   2 confirmados de 6 · anu_seed_3 → 2 leídos / 1 confirmado de 6.
 */
import type { PrismaClient } from '@prisma/client';

export async function seedAnuncios(prisma: PrismaClient, tid: string) {
  // ===== Consorcio Gorriti 4521 (audiencia de anu_seed_1) =====
  await prisma.consorcio.upsert({
    where: { id: 'cnsr_001' },
    update: {},
    create: {
      id: 'cnsr_001',
      inmobiliariaId: tid,
      nombre: 'Consorcio Gorriti 4521',
      direccion: 'Gorriti 4521, Palermo, CABA',
      cantUf: 12,
      sociedadId: 'soc_001',
      encargado: { nombre: 'Carlos Domínguez', sueldo: 480000 },
      periodoActual: '2026-05',
      expensasPeriodoActual: 2840000,
      desde: new Date('2022-03-10'),
    },
  });
  // FK real propiedad→consorcio (Mariela vive en Gorriti 4521, 3°B)
  await prisma.propiedad.updateMany({
    where: { id: 'prp_001', inmobiliariaId: tid },
    data: { consorcioId: 'cnsr_001' },
  });

  // ===== Anuncios (ids exactos del mock) =====
  const anuncios = [
    {
      id: 'anu_seed_1',
      titulo: 'Corte programado de agua · Gorriti 4521',
      cuerpo:
        'AySA confirmó que el viernes 30/05 entre 9 y 13 hs hay corte de agua en toda la cuadra. Llené el bidón el jueves a la noche y ojo con el termo.',
      prioridad: 'IMPORTANTE' as const,
      audiencia: 'INQUILINOS_CONSORCIO' as const,
      audienciaIds: ['cnsr_001'],
      enviadoPor: 'Roberto Tapia',
      enviadoAt: '2026-05-21T10:00:00-03:00',
      destinatariosCount: 12,
    },
    {
      id: 'anu_seed_2',
      titulo: 'Nuevo CBU para cobranzas · vigente desde 01/06',
      cuerpo:
        'Cambiamos a Banco Galicia. CBU 0070100120000018273645 · Alias delsol.cobranzas. Por favor reemplazá el de junio en adelante para que el sistema concilie automático. Cualquier duda, WhatsApp directo a Roberto.',
      prioridad: 'IMPORTANTE' as const,
      audiencia: 'TODOS_INQUILINOS' as const,
      audienciaIds: [] as string[],
      // V2b-02: lo firma Luciana Vidal (el texto habla de Roberto en 3ª persona)
      enviadoPor: 'Luciana Vidal',
      enviadoAt: '2026-05-15T15:30:00-03:00',
      destinatariosCount: 6,
    },
    {
      id: 'anu_seed_3',
      titulo: 'Recordatorio · vencimientos del mes',
      cuerpo:
        'Te paso a recordar que tu alquiler vence el día 5 de cada mes. Si pagás antes del 5 no se aplican punitorios. Cualquier consulta sobre el monto, escribime.',
      prioridad: 'NORMAL' as const,
      audiencia: 'TODOS_INQUILINOS' as const,
      audienciaIds: [] as string[],
      enviadoPor: 'Luciana Vidal',
      enviadoAt: '2026-05-02T09:15:00-03:00',
      destinatariosCount: 6,
    },
  ];
  for (const a of anuncios) {
    const { enviadoAt, ...resto } = a;
    await prisma.anuncio.upsert({
      where: { id: a.id },
      update: {},
      create: {
        ...resto,
        inmobiliariaId: tid,
        canales: ['APP', 'EMAIL'], // decisión de producto: siempre ambos
        enviadoAt: new Date(enviadoAt),
      },
    });
  }

  // ===== Acuses reales de otros inquilinos (Mariela queda libre para la demo) =====
  const emails = [
    'juan.perez@inquilino.demo',
    'laura.gimenez@inquilino.demo',
    'carlos.romero@inquilino.demo',
    'ana.pereyra@inquilino.demo',
  ];
  const inquilinos = await prisma.inquilino.findMany({
    where: { inmobiliariaId: tid, email: { in: emails } },
    select: { id: true, email: true },
  });
  const idDe = (email: string) => inquilinos.find((i) => i.email === email)?.id;

  const acuses = [
    // anu_seed_2 (CBU): 4 leídos, 2 confirmados
    { anuncioId: 'anu_seed_2', email: 'juan.perez@inquilino.demo', leidoAt: '2026-05-15T16:02:00-03:00', confirmadoAt: '2026-05-15T16:03:00-03:00' },
    { anuncioId: 'anu_seed_2', email: 'laura.gimenez@inquilino.demo', leidoAt: '2026-05-15T18:40:00-03:00', confirmadoAt: null },
    { anuncioId: 'anu_seed_2', email: 'carlos.romero@inquilino.demo', leidoAt: '2026-05-16T09:12:00-03:00', confirmadoAt: '2026-05-16T09:12:30-03:00' },
    { anuncioId: 'anu_seed_2', email: 'ana.pereyra@inquilino.demo', leidoAt: '2026-05-17T11:25:00-03:00', confirmadoAt: null },
    // anu_seed_3 (recordatorio): 2 leídos, 1 confirmado
    { anuncioId: 'anu_seed_3', email: 'juan.perez@inquilino.demo', leidoAt: '2026-05-02T10:05:00-03:00', confirmadoAt: null },
    { anuncioId: 'anu_seed_3', email: 'laura.gimenez@inquilino.demo', leidoAt: '2026-05-02T12:30:00-03:00', confirmadoAt: '2026-05-02T12:31:00-03:00' },
  ];
  for (const ac of acuses) {
    const inquilinoId = idDe(ac.email);
    if (!inquilinoId) continue; // seedBase no corrió completo — no inventamos acuses
    await prisma.anuncioAcuse.upsert({
      where: { anuncioId_inquilinoId: { anuncioId: ac.anuncioId, inquilinoId } },
      update: {},
      create: {
        inmobiliariaId: tid,
        anuncioId: ac.anuncioId,
        inquilinoId,
        leidoAt: new Date(ac.leidoAt),
        confirmadoAt: ac.confirmadoAt ? new Date(ac.confirmadoAt) : null,
      },
    });
  }
}
