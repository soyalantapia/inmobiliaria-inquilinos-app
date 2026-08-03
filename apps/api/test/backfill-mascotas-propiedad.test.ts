/**
 * Fija el BACKFILL de la migración `20260803120000_mascotas_en_propiedad`:
 * "¿Se permiten mascotas?" pasó de ser un atributo del Contrato a serlo de
 * la Propiedad, y la migración copia lo ya cargado para no perderlo.
 *
 * Correr la suite normal NO prueba el backfill: en una DB fresca la migración
 * se aplica sobre CERO filas, así que los dos UPDATE no tocan nada y el test
 * pasaría igual aunque el SQL estuviera mal. Para probarlo de verdad hay que
 * dejar la DB en el estado PREVIO (el dato cargado del lado del contrato, las
 * propiedades sin él) y recién ahí correr el SQL de la migración.
 *
 * Este test ejecuta el archivo `migration.sql` REAL, verbatim: si alguien
 * edita el SQL, queda cubierto. El `ALTER TABLE ... IF NOT EXISTS` queda como
 * no-op (la columna ya existe por `migrate deploy`) y los dos UPDATE del
 * backfill corren de verdad contra los datos preparados.
 *
 * Usa una DB propia y efímera en el mismo cluster local que el resto de la
 * suite: los UPDATE de la migración son GLOBALES (sin filtro por
 * inmobiliaria) y contra la DB compartida le pisarían las propiedades a las
 * otras suites.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(__dirname, '..');
const SCHEMA = path.join(API_DIR, 'prisma', 'schema.prisma');
const MIGRATION_SQL = path.join(
  API_DIR,
  'prisma',
  'migrations',
  '20260803120000_mascotas_en_propiedad',
  'migration.sql',
);

const PSQL = process.env.PSQL_BIN ?? '/opt/homebrew/opt/postgresql@18/bin/psql';
const PG_HOST = process.env.PGHOST_TEST ?? '127.0.0.1';
const PG_PORT = process.env.PGPORT_TEST ?? '55433';
const PG_USER = process.env.PGUSER_TEST ?? 'alannaimtapia';
const DB_NAME = `myalq_backfill_${Date.now()}`;
const DB_URL = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_NAME}`;

function psql(args: string[], db = 'postgres') {
  execFileSync(
    PSQL,
    ['-h', PG_HOST, '-p', PG_PORT, '-U', PG_USER, '-d', db, '-v', 'ON_ERROR_STOP=1', ...args],
    { stdio: 'pipe' },
  );
}

let creada = false;

afterAll(() => {
  if (!creada) return;
  try {
    psql(['-c', `DROP DATABASE IF EXISTS "${DB_NAME}"`]);
  } catch {
    // best-effort: no bloquear la suite por una DB de test que no se pudo dropear
  }
});

describe('Backfill: Contrato.mascotasPermitidas → Propiedad.mascotasPermitidas', () => {
  it(
    'copia el valor del contrato actual, y si no tiene, el del contrato histórico más reciente',
    async () => {
      psql(['-c', `CREATE DATABASE "${DB_NAME}"`]);
      creada = true;
      execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', SCHEMA], {
        cwd: API_DIR,
        env: { ...process.env, DATABASE_URL: DB_URL },
        stdio: 'pipe',
      });

      const prisma = new PrismaClient({ datasourceUrl: DB_URL });
      try {
        // ===== Estado PREVIO a la migración =====
        // El dato vive sólo del lado del contrato; ninguna propiedad lo tiene
        // (nunca lo seteamos → queda null, igual que antes de la migración).
        const inmo = await prisma.inmobiliaria.create({
          data: {
            nombre: 'ZZ-TEST Backfill',
            cuit: '30-00000000-1',
            email: 'backfill@test.com',
            telefono: '+54 11 0000 0000',
            matricula: 'TEST-0001',
            direccionCalle: 'Calle Test',
            direccionAltura: '100',
            direccionCiudad: 'CABA',
            direccionProvincia: 'Buenos Aires',
            direccionCp: '1000',
            codigoReferido: `BACKFILL-${Date.now()}`,
          },
        });

        const contratoBase = {
          inmobiliariaId: inmo.id,
          diaPago: 10,
          indiceAjuste: 'ICL' as const,
          frecuenciaAjusteMeses: 12,
        };

        // Propiedad A: su contrato ACTUAL tiene el dato en true → tiene que
        // ganarle a un histórico viejo que dice false.
        const propA = await prisma.propiedad.create({
          data: {
            inmobiliariaId: inmo.id,
            direccion: 'Propiedad A',
            ciudad: 'CABA',
            provincia: 'BA',
            tipo: 'DEPARTAMENTO',
          },
        });
        const contratoAActual = await prisma.contrato.create({
          data: {
            ...contratoBase,
            propiedadId: propA.id,
            monto: 100000,
            fechaInicio: new Date('2026-01-01'),
            fechaFin: new Date('2027-01-01'),
            mascotasPermitidas: true,
          },
        });
        await prisma.contrato.create({
          data: {
            ...contratoBase,
            propiedadId: propA.id,
            estado: 'FINALIZADO',
            monto: 90000,
            fechaInicio: new Date('2024-01-01'),
            fechaFin: new Date('2025-01-01'),
            mascotasPermitidas: false,
          },
        });
        await prisma.propiedad.update({
          where: { id: propA.id },
          data: { contratoActualId: contratoAActual.id },
        });

        // Propiedad B: vacante (sin contrato actual) con dos históricos. El más
        // reciente por fechaInicio dice true; el viejo dice false.
        const propB = await prisma.propiedad.create({
          data: {
            inmobiliariaId: inmo.id,
            direccion: 'Propiedad B',
            ciudad: 'CABA',
            provincia: 'BA',
            tipo: 'CASA',
          },
        });
        await prisma.contrato.create({
          data: {
            ...contratoBase,
            propiedadId: propB.id,
            estado: 'FINALIZADO',
            monto: 80000,
            fechaInicio: new Date('2023-01-01'),
            fechaFin: new Date('2024-01-01'),
            mascotasPermitidas: false,
          },
        });
        await prisma.contrato.create({
          data: {
            ...contratoBase,
            propiedadId: propB.id,
            estado: 'FINALIZADO',
            monto: 85000,
            fechaInicio: new Date('2025-06-01'),
            fechaFin: new Date('2026-06-01'),
            mascotasPermitidas: true,
          },
        });

        // Propiedad C: contrato actual SIN el dato y ningún histórico que lo
        // tenga → tiene que quedar en null, sin que la migración explote.
        const propC = await prisma.propiedad.create({
          data: {
            inmobiliariaId: inmo.id,
            direccion: 'Propiedad C',
            ciudad: 'CABA',
            provincia: 'BA',
            tipo: 'GALPON',
          },
        });
        const contratoC = await prisma.contrato.create({
          data: {
            ...contratoBase,
            propiedadId: propC.id,
            monto: 70000,
            fechaInicio: new Date('2026-02-01'),
            fechaFin: new Date('2027-02-01'),
          },
        });
        await prisma.propiedad.update({
          where: { id: propC.id },
          data: { contratoActualId: contratoC.id },
        });

        // Propiedad D: sin ningún contrato → también queda en null.
        const propD = await prisma.propiedad.create({
          data: {
            inmobiliariaId: inmo.id,
            direccion: 'Propiedad D',
            ciudad: 'CABA',
            provincia: 'BA',
            tipo: 'LOCAL',
          },
        });

        // Nadie tiene el dato del lado de la propiedad todavía: ése es el
        // estado real justo antes de que corra la migración.
        const antes = await prisma.propiedad.findMany({ select: { mascotasPermitidas: true } });
        expect(antes.every((p) => p.mascotasPermitidas === null)).toBe(true);

        // ===== Correr el SQL REAL de la migración =====
        psql(['-f', MIGRATION_SQL], DB_NAME);

        // ===== Verificar el backfill =====
        const [a, b, c, d] = await Promise.all([
          prisma.propiedad.findUniqueOrThrow({
            where: { id: propA.id },
            select: { mascotasPermitidas: true },
          }),
          prisma.propiedad.findUniqueOrThrow({
            where: { id: propB.id },
            select: { mascotasPermitidas: true },
          }),
          prisma.propiedad.findUniqueOrThrow({
            where: { id: propC.id },
            select: { mascotasPermitidas: true },
          }),
          prisma.propiedad.findUniqueOrThrow({
            where: { id: propD.id },
            select: { mascotasPermitidas: true },
          }),
        ]);
        expect(a.mascotasPermitidas).toBe(true); // ganó el contrato ACTUAL
        expect(b.mascotasPermitidas).toBe(true); // ganó el histórico más RECIENTE
        expect(c.mascotasPermitidas).toBe(null); // ningún contrato con el dato
        expect(d.mascotasPermitidas).toBe(null); // sin contratos
      } finally {
        await prisma.$disconnect();
      }
    },
    180_000,
  );
});
