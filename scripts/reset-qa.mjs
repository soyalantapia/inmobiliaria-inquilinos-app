/**
 * RESET TOTAL del loop QA — devuelve la DB de Railway al estado seed exacto.
 *
 * Qué restaura (todo lo que las pasadas A/B/C mutan):
 *  - pag_001 → INFORMADO · liq_005 → PENDIENTE · pagos extra fuera
 *  - rendiciones ≠ ren_001 fuera · mov_002/003 sin descontar · mov_001 intacto (rendido)
 *  - apr_seed_1/3 → PENDIENTE · aprobaciones extra fuera · cnt_006 → BORRADOR
 *  - reclamos/eventos extra fuera · rec_001/003/004 a su estado seed · renovación cnt_001 SIN_RESPUESTA
 *  - anuncios y movimientos con prefijo QA- fuera (con sus acuses)
 *  - TODOS los acuses de Mariela fuera (su loop leído→enterado arranca virgen)
 *  - seedBase() al final (idempotente) repone cualquier faltante
 *
 * Correr: cd apps/api && pnpm exec tsx ../../scripts/reset-qa.mjs
 * (usa el PrismaClient generado del workspace api y su .env)
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { PrismaClient } = requireApi('@prisma/client');

// DATABASE_URL desde apps/api/.env si no vino por entorno
if (!process.env.DATABASE_URL) {
  const env = readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const { seedBase } = await import('../apps/api/prisma/seed.ts');

const SEED_RECLAMOS = ['rec_001', 'rec_002', 'rec_003', 'rec_004', 'rec_005', 'rec_006'];
const SEED_EVENTOS = [
  'ev_001_1',
  'ev_002_1', 'ev_002_2', 'ev_002_3', 'ev_002_4', 'ev_002_5',
  'ev_003_1',
  'ev_004_1', 'ev_004_2',
  'ev_005_1', 'ev_005_2', 'ev_005_3',
  'ev_006_1', 'ev_006_2', 'ev_006_3', 'ev_006_4',
];
const SEED_APROBACIONES = ['apr_seed_1', 'apr_seed_3'];

const prisma = new PrismaClient();

// ===== Anuncios fuera del seed (QA- y residuos de tests) + acuses de Mariela =====
const SEED_ANUNCIOS = ['anu_seed_1', 'anu_seed_2', 'anu_seed_3'];
await prisma.anuncioAcuse.deleteMany({ where: { anuncioId: { notIn: SEED_ANUNCIOS } } });
await prisma.anuncio.deleteMany({ where: { id: { notIn: SEED_ANUNCIOS } } });
await prisma.anuncioAcuse.deleteMany({ where: { inquilino: { email: 'mariela.sosa@gmail.com' } } });

// ===== La plata =====
await prisma.pago.deleteMany({ where: { id: { notIn: ['pag_001', 'pag_002'] } } });
await prisma.pago.updateMany({
  where: { id: 'pag_001' },
  data: { estado: 'INFORMADO', decididoPorId: null, decididoAt: null, observacion: null },
});
await prisma.liquidacion.updateMany({
  where: { id: 'liq_005' },
  data: { estado: 'PENDIENTE', fechaPago: null, metodoPago: null },
});
await prisma.gastoRendido.deleteMany({ where: { rendicionId: { not: 'ren_001' } } });
// liberar movimientos enganchados a rendiciones QA antes de borrarlas (FK)
await prisma.movimientoCaja.updateMany({
  where: { rendicionId: { not: 'ren_001' }, NOT: { rendicionId: null } },
  data: { descontadoEnRendicion: false, rendicionId: null },
});
await prisma.movimientoCaja.updateMany({
  where: { id: { in: ['mov_002', 'mov_003'] } },
  data: { descontadoEnRendicion: false, rendicionId: null },
});
await prisma.rendicion.deleteMany({ where: { id: { not: 'ren_001' } } });
await prisma.movimientoCaja.deleteMany({ where: { id: { notIn: ['mov_001', 'mov_002', 'mov_003'] } } });

// ===== Aprobaciones + contrato de Tomás =====
await prisma.aprobacion.deleteMany({ where: { id: { notIn: SEED_APROBACIONES } } });
await prisma.aprobacion.updateMany({
  where: { id: { in: SEED_APROBACIONES } },
  data: { estado: 'PENDIENTE', aprobadoPorId: null, aprobadoAt: null, comentarioAprobador: null },
});
await prisma.contrato.updateMany({
  where: { id: 'cnt_006' },
  data: { estado: 'BORRADOR', pendienteAprobacion: true, aprobadoAt: null },
});

// ===== Operación =====
await prisma.reclamoEvento.deleteMany({ where: { id: { notIn: SEED_EVENTOS } } });
await prisma.reclamo.deleteMany({ where: { id: { notIn: SEED_RECLAMOS } } });
await prisma.reclamo.updateMany({
  where: { id: { in: ['rec_001', 'rec_003'] } },
  data: { estado: 'ABIERTO', resolucion: null, resueltoAt: null, profesionalId: null },
});
await prisma.reclamo.updateMany({
  where: { id: 'rec_001' },
  data: { asignadoA: null },
});
await prisma.reclamo.updateMany({
  where: { id: 'rec_004' },
  data: { estado: 'EN_CURSO', resolucion: null, resueltoAt: null, profesionalId: null },
});
await prisma.intencionRenovacion.updateMany({
  where: { contratoId: 'cnt_001' },
  data: { decision: 'SIN_RESPUESTA', comentario: null, decididoAt: null },
});

// ===== Seeds (idempotente: repone lo que falte) =====
const { inmobiliariaId } = await seedBase(prisma);

// ===== Asserts de sanidad del estado seed =====
const [anuncios, contratos, acusesMariela, pag, cnt006, apr] = await Promise.all([
  prisma.anuncio.count({ where: { inmobiliariaId } }),
  prisma.contrato.count({ where: { inmobiliariaId } }),
  prisma.anuncioAcuse.count({ where: { inquilino: { email: 'mariela.sosa@gmail.com' } } }),
  prisma.pago.findUnique({ where: { id: 'pag_001' }, select: { estado: true } }),
  prisma.contrato.findUnique({ where: { id: 'cnt_006' }, select: { estado: true } }),
  prisma.aprobacion.findUnique({ where: { id: 'apr_seed_1' }, select: { estado: true } }),
]);
const checks = [
  ['anuncios = 3', anuncios === 3],
  ['contratos = 8', contratos === 8],
  ['acuses Mariela = 0', acusesMariela === 0],
  ['pag_001 INFORMADO', pag?.estado === 'INFORMADO'],
  ['cnt_006 BORRADOR', cnt006?.estado === 'BORRADOR'],
  ['apr_seed_1 PENDIENTE', apr?.estado === 'PENDIENTE'],
];
let ok = true;
for (const [label, pass] of checks) {
  console.log(`${pass ? '✓' : '✗'} ${label}`);
  if (!pass) ok = false;
}
await prisma.$disconnect();
if (!ok) {
  console.error('RESET INCOMPLETO — revisar arriba');
  process.exit(1);
}
console.log(`✓ RESET QA completo (tenant ${inmobiliariaId})`);
