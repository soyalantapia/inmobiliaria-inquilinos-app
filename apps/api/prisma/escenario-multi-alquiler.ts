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

(async () => {
  const prisma = new PrismaClient();
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
    await prisma.$disconnect();
    return;
  }

  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, 1));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 2, hoy.getUTCMonth(), 1));
  const contrato = await prisma.contrato.create({
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
  await prisma.propiedad.update({
    where: { id: propiedad.id },
    data: { contratoActualId: contrato.id },
  });
  await prisma.inquilino.create({
    data: {
      inmobiliariaId: inmo.id,
      nombre: 'Mariela',
      apellido: 'Sosa',
      email: EMAIL,
      contratoId: contrato.id,
      esInvitado: false,
    },
  });
  await generarLiquidacionesContrato(prisma, contrato);

  const total = await prisma.inquilino.count({ where: { email: EMAIL } });
  console.log(`OK — ${EMAIL} tiene ahora ${total} alquileres. El 2º es "${propiedad.direccion}" por $${MONTO_2}.`);
  await prisma.$disconnect();
})();
