import { PrismaClient } from '@prisma/client';
import { seedBase } from './seed.js';
import { generarLiquidacionesContrato } from '../src/lib/liquidaciones.js';

/**
 * Escenario de verificación del multi-alquiler: el MISMO email con dos
 * contratos en DOS inmobiliarias distintas. El 2º contrato usa un monto
 * absurdo (999999) para que, si la app muestra la plata de la propiedad
 * equivocada, se vea de una. Idempotente: se puede correr varias veces.
 *
 * Uso (contra una DB local efímera, NUNCA la remota):
 *   DATABASE_URL=... JWT_SECRET=... npx tsx prisma/escenario-multi-alquiler.ts
 */
const EMAIL = 'mariela.sosa@gmail.com';
const MONTO_2 = 999_999;

// Este script hace muchos writes de prueba. NUNCA debe poder correr contra
// una DB remota (Railway u otra). A diferencia de seed.ts, acá importamos
// seedBase() como función en vez de invocar el runner CLI, así que el guard
// de seed.ts (gateado por process.argv[1]?.endsWith('seed.ts')) NO aplica.
// Por eso este script necesita su propio guard, con el mismo espíritu que
// seed.ts:339-346.
function abortarSiNoEsLocal() {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '✗ escenario-multi-alquiler bloqueado: NODE_ENV=production. Este script es un harness de prueba y jamás debe correr contra producción.',
    );
    process.exit(1);
  }

  const raw = process.env.DATABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(raw).hostname;
  } catch {
    console.error(
      '✗ escenario-multi-alquiler bloqueado: DATABASE_URL ausente o inválida. Corré: DATABASE_URL=postgresql://usuario@localhost:5432/tu_db_local JWT_SECRET=... npx tsx prisma/escenario-multi-alquiler.ts',
    );
    process.exit(1);
  }

  const esLocal = host === 'localhost' || host === '127.0.0.1';
  if (!esLocal) {
    console.error(
      `✗ escenario-multi-alquiler bloqueado: DATABASE_URL apunta a un host remoto ("${host}"). Este script hace muchos writes de prueba y SOLO puede correr contra una DB local (localhost / 127.0.0.1). Corré: DATABASE_URL=postgresql://usuario@localhost:5432/tu_db_local JWT_SECRET=... npx tsx prisma/escenario-multi-alquiler.ts`,
    );
    process.exit(1);
  }
}

async function main() {
  abortarSiNoEsLocal();

  const prisma = new PrismaClient();
  try {
    await seedBase(prisma);

    const yaExiste = await prisma.inmobiliaria.findFirst({ where: { nombre: 'Alquileres del Norte' } });
    const inmo =
      yaExiste ??
      (await prisma.inmobiliaria.create({
        data: {
          nombre: 'Alquileres del Norte',
          cuit: '30-70000000-9',
          email: 'hola@delnorte.com.ar',
          telefono: '+54 11 4000 0000',
          matricula: 'CUCICBA 9999',
          direccionCalle: 'Av. Cabildo',
          direccionAltura: '1200',
          direccionCiudad: 'CABA',
          direccionProvincia: 'Buenos Aires',
          direccionCp: '1426',
          codigoReferido: 'DELNORTE-2026',
        },
      }));

    const propietario =
      (await prisma.propietario.findFirst({ where: { inmobiliariaId: inmo.id } })) ??
      (await prisma.propietario.create({
        data: {
          inmobiliariaId: inmo.id,
          nombre: 'Marta',
          apellido: 'Duarte',
          cuit: '27-99999999-9',
          email: 'marta.duarte@gmail.com',
          telefono: '+54 11 4111 2222',
          comisionPct: 8,
        },
      }));

    const propiedad =
      (await prisma.propiedad.findFirst({ where: { inmobiliariaId: inmo.id } })) ??
      (await prisma.propiedad.create({
        data: {
          inmobiliariaId: inmo.id,
          direccion: 'Mendoza 3344, 2°A',
          ciudad: 'Belgrano, CABA',
          provincia: 'Buenos Aires',
          tipo: 'DEPARTAMENTO',
          estado: 'ALQUILADA',
        },
      }));

    await prisma.participacionPropietario.createMany({
      data: [{ inmobiliariaId: inmo.id, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 }],
      skipDuplicates: true,
    });

    const inqExistente = await prisma.inquilino.findFirst({
      where: { inmobiliariaId: inmo.id, email: EMAIL },
    });
    if (inqExistente) {
      console.log('El escenario ya estaba armado. Nada que hacer.');
      return;
    }

    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, 1));
    const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 2, hoy.getUTCMonth(), 1));

    // Contrato + update de propiedad + inquilino + liquidaciones van atómicos:
    // si el proceso muere a mitad de camino, una 2ª corrida no debe encontrar
    // basura (contrato huérfano, inquilino sin liquidaciones, etc).
    await prisma.$transaction(async (tx) => {
      const contrato = await tx.contrato.create({
        data: {
          inmobiliariaId: inmo.id,
          propiedadId: propiedad.id,
          estado: 'ACTIVO',
          monto: MONTO_2,
          moneda: 'ARS',
          fechaInicio: inicio,
          fechaFin: fin,
          diaPago: 10,
          indiceAjuste: 'ICL',
          frecuenciaAjusteMeses: 12,
          tipoContrato: 'ALQUILER',
          modoCobranza: 'INMOBILIARIA',
        },
      });
      await tx.propiedad.update({
        where: { id: propiedad.id },
        data: { contratoActualId: contrato.id },
      });
      await tx.inquilino.create({
        data: {
          inmobiliariaId: inmo.id,
          nombre: 'Mariela',
          apellido: 'Sosa',
          email: EMAIL,
          contratoId: contrato.id,
          esInvitado: false,
        },
      });
      await generarLiquidacionesContrato(tx, contrato);
    });

    const total = await prisma.inquilino.count({ where: { email: EMAIL } });
    console.log(`OK — ${EMAIL} tiene ahora ${total} alquileres. El 2º es "${propiedad.direccion}" por $${MONTO_2}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
