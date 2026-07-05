/**
 * Backfill de la entidad Persona.
 *
 * Agrupa las filas Inquilino existentes (una por contrato) en Personas reutilizables
 * DENTRO de cada tenant y setea `Inquilino.personaId`. Habilita la ficha histórica del
 * inquilino (todos sus contratos/propiedades/reclamos) y el reuso al armar un contrato.
 *
 * Criterio de agrupación (conservador — mejor sub-agrupar que fusionar personas distintas):
 *   1. DNI no vacío → misma persona (el DNI es único por persona; homónimos con mismo DNI
 *      son la misma persona). Clave de idempotencia real (@@unique([inmobiliariaId, dni])).
 *   2. Sin DNI, con email no vacío → misma persona por email (identidad de login OTP).
 *   3. Sin DNI ni email → persona propia (NUNCA se fusiona por nombre/homónimo).
 *
 * IDEMPOTENTE: si alguna fila del grupo ya tiene personaId (corrida previa), se reusa; no
 * duplica. Re-ejecutable sin efectos.
 *
 * SEGURIDAD: DRY-RUN por defecto (solo reporta). Escribe SOLO con `--apply`. Scope por
 * tenant con `--tenant=<id>` (default: TODOS los tenants). NO correr con --apply sobre el
 * tenant real (Tapia Propiedades) sin validar antes en un tenant demo.
 *
 * Uso:
 *   pnpm exec tsx prisma/backfill-personas.ts                 # dry-run, todos los tenants
 *   pnpm exec tsx prisma/backfill-personas.ts --tenant=<id>   # dry-run, un tenant
 *   pnpm exec tsx prisma/backfill-personas.ts --apply --tenant=<id>   # aplica en un tenant
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const tenantArg = process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1];

const norm = (s: string | null | undefined): string => (s ?? '').trim();

type InqRow = {
  id: string;
  personaId: string | null;
  dni: string | null;
  email: string | null;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  cuit: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function backfillTenant(inmobiliariaId: string, nombreTenant: string) {
  const inquilinos: InqRow[] = await prisma.inquilino.findMany({
    where: { inmobiliariaId },
    select: {
      id: true, personaId: true, dni: true, email: true, nombre: true,
      apellido: true, telefono: true, cuit: true, createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Agrupar por la clave de identidad (dni > email > fila).
  const grupos = new Map<string, InqRow[]>();
  for (const inq of inquilinos) {
    const dni = norm(inq.dni);
    const email = norm(inq.email).toLowerCase();
    const clave = dni ? `dni:${dni}` : email ? `email:${email}` : `row:${inq.id}`;
    const arr = grupos.get(clave) ?? [];
    arr.push(inq);
    grupos.set(clave, arr);
  }

  let personasCreadas = 0;
  let linkeados = 0;
  let gruposMulti = 0; // grupos con más de un contrato (una persona con historial)

  for (const [, filas] of grupos) {
    if (filas.length > 1) gruposMulti++;
    // Idempotencia: si alguna fila ya está linkeada, reusamos esa Persona.
    let personaId = filas.find((f) => f.personaId)?.personaId ?? null;
    // Representante: la fila más reciente, con fallback a valores no vacíos del grupo.
    const rep = [...filas].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const dni = norm(rep.dni) || filas.map((f) => norm(f.dni)).find(Boolean) || null;
    const email = norm(rep.email) || filas.map((f) => norm(f.email)).find(Boolean) || null;

    if (!personaId) {
      personasCreadas++;
      if (APPLY) {
        if (dni) {
          // upsert por (tenant, dni): idempotente aunque se re-corra.
          const p = await prisma.persona.upsert({
            where: { inmobiliariaId_dni: { inmobiliariaId, dni } },
            update: {},
            create: {
              inmobiliariaId, dni, email,
              nombre: rep.nombre, apellido: rep.apellido, telefono: rep.telefono, cuit: rep.cuit,
            },
          });
          personaId = p.id;
        } else {
          const p = await prisma.persona.create({
            data: {
              inmobiliariaId, email,
              nombre: rep.nombre, apellido: rep.apellido, telefono: rep.telefono, cuit: rep.cuit,
            },
          });
          personaId = p.id;
        }
      }
    }

    const aLinkear = filas.filter((f) => !f.personaId);
    linkeados += aLinkear.length;
    if (APPLY && personaId && aLinkear.length > 0) {
      await prisma.inquilino.updateMany({
        where: { id: { in: aLinkear.map((f) => f.id) } },
        data: { personaId },
      });
    }
  }

  console.log(
    `  [${nombreTenant}] inquilinos=${inquilinos.length} → personas=${grupos.size} ` +
      `(creadas=${personasCreadas}, con historial=${gruposMulti}), inquilinos a linkear=${linkeados}`,
  );
  return { personasCreadas, linkeados };
}

async function main() {
  const tenants = tenantArg
    ? await prisma.inmobiliaria.findMany({ where: { id: tenantArg }, select: { id: true, nombre: true } })
    : await prisma.inmobiliaria.findMany({ select: { id: true, nombre: true } });

  if (tenants.length === 0) {
    console.log('No se encontraron tenants para el filtro dado.');
    return;
  }

  console.log(`${APPLY ? '🟢 APLICANDO' : '🔵 DRY-RUN (sin escribir)'} · ${tenants.length} tenant(s)\n`);
  let totalPersonas = 0;
  let totalLinks = 0;
  for (const t of tenants) {
    const r = await backfillTenant(t.id, t.nombre);
    totalPersonas += r.personasCreadas;
    totalLinks += r.linkeados;
  }
  console.log(
    `\n${APPLY ? 'APLICADO' : 'DRY-RUN'}: personas ${APPLY ? 'creadas' : 'a crear'}=${totalPersonas}, ` +
      `inquilinos ${APPLY ? 'linkeados' : 'a linkear'}=${totalLinks}`,
  );
  if (!APPLY) console.log('(Nada se escribió. Re-ejecutá con --apply para aplicar.)');
}

main()
  .catch((e) => {
    console.error('Backfill falló:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
