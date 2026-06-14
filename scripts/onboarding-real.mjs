/**
 * Onboarding REAL desde 0 — da de alta UNA inmobiliaria real con su admin,
 * sociedad principal, propietario(s), una propiedad, su contrato, el inquilino
 * titular y la primera liquidación. Lee los datos de `onboarding-real.input.json`
 * (ver `onboarding-real.input.example.json`).
 *
 * Correr APUNTANDO A LA BASE NUEVA (vacía):
 *   DATABASE_URL="postgresql://...nueva..." cd apps/api && pnpm exec tsx ../../scripts/onboarding-real.mjs
 *
 * Seguridad:
 *  - Se NIEGA a correr si la base ya tiene una inmobiliaria (evita pisar la demo
 *    o duplicar el alta). Pasá --force solo si sabés lo que hacés.
 *  - No inventa datos: si falta algo obligatorio en el input, aborta.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { PrismaClient } = requireApi('@prisma/client');
const bcrypt = requireApi('bcryptjs');

// DATABASE_URL desde el entorno (recomendado: la base nueva) o de apps/api/.env.
if (!process.env.DATABASE_URL) {
  const env = readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const input = JSON.parse(readFileSync(new URL('../onboarding-real.input.json', import.meta.url), 'utf8'));
const force = process.argv.includes('--force');

function req(path, val) {
  if (val === undefined || val === null || val === '') {
    throw new Error(`Falta dato obligatorio: ${path}`);
  }
  return val;
}

const { inmobiliaria: I, admin: A, sociedad: S, propietarios: OWN, propiedad: P, contrato: C, inquilino: Q, liquidacion: L } = input;

// ── Validaciones de forma ───────────────────────────────────────────────────
req('inmobiliaria.nombre', I?.nombre); req('inmobiliaria.cuit', I?.cuit); req('inmobiliaria.email', I?.email);
req('admin.email', A?.email); req('admin.password', A?.password); req('admin.pin', A?.pin);
if (!/^\d{4,6}$/.test(A.pin)) throw new Error('admin.pin debe ser 4-6 dígitos');
if (!Array.isArray(OWN) || OWN.length === 0) throw new Error('propietarios: al menos uno');
OWN.forEach((o, i) => { req(`propietarios[${i}].nombre`, o.nombre); req(`propietarios[${i}].apellido`, o.apellido); });
req('propiedad.direccion', P?.direccion); req('propiedad.ciudad', P?.ciudad); req('propiedad.provincia', P?.provincia); req('propiedad.tipo', P?.tipo);
const sumaPart = OWN.reduce((acc, o) => acc + Number(o.participacionPct ?? 0), 0);
if (Math.round(sumaPart) !== 100) throw new Error(`Las participaciones de los propietarios deben sumar 100 (suman ${sumaPart})`);
req('contrato.monto', C?.monto); req('contrato.moneda', C?.moneda); req('contrato.fechaInicio', C?.fechaInicio); req('contrato.fechaFin', C?.fechaFin);
req('contrato.tipoContrato', C?.tipoContrato);
if ((C.tipoContrato === 'SOLO_EXPENSAS' || C.tipoContrato === 'ALQUILER_Y_EXPENSAS') && !C.montoExpensas) {
  throw new Error('contrato.montoExpensas es obligatorio para SOLO_EXPENSAS / ALQUILER_Y_EXPENSAS');
}
req('inquilino.nombre', Q?.nombre); req('inquilino.apellido', Q?.apellido); req('inquilino.email', Q?.email);
req('liquidacion.periodo', L?.periodo); req('liquidacion.fechaVencimiento', L?.fechaVencimiento);

const prisma = new PrismaClient();

const yaHay = await prisma.inmobiliaria.count();
if (yaHay > 0 && !force) {
  console.error(`✗ La base ya tiene ${yaHay} inmobiliaria(s). Este script es para una base VACÍA (producción nueva).`);
  console.error('  Si de verdad querés correrlo igual, agregá --force. (No lo uses contra la demo.)');
  await prisma.$disconnect();
  process.exit(1);
}

const resumen = await prisma.$transaction(async (tx) => {
  // 1) Inmobiliaria (tenant)
  const inmo = await tx.inmobiliaria.create({
    data: {
      nombre: I.nombre, cuit: I.cuit, email: I.email, telefono: I.telefono ?? null,
      matricula: I.matricula ?? null,
      direccionCalle: I.direccionCalle ?? null, direccionAltura: I.direccionAltura ?? null,
      direccionPiso: I.direccionPiso ?? null, direccionCiudad: I.direccionCiudad ?? null,
      direccionProvincia: I.direccionProvincia ?? null, direccionCp: I.direccionCp ?? null,
      esPiloto: Boolean(I.esPiloto ?? false),
      codigoReferido: I.codigoReferido ?? null,
    },
  });
  const tid = inmo.id;

  // 2) Usuario ADMIN (+ extras opcionales)
  const admin = await tx.usuario.create({
    data: {
      inmobiliariaId: tid, email: A.email.toLowerCase(), nombre: A.nombre ?? 'Admin', apellido: A.apellido ?? '',
      rol: 'ADMIN', activo: true,
      passwordHash: bcrypt.hashSync(A.password, 10), pinHash: bcrypt.hashSync(A.pin, 10),
    },
  });
  for (const u of (input.usuariosExtra ?? [])) {
    await tx.usuario.create({
      data: {
        inmobiliariaId: tid, email: u.email.toLowerCase(), nombre: u.nombre, apellido: u.apellido ?? '',
        rol: u.rol ?? 'CARGA', activo: true,
        passwordHash: bcrypt.hashSync(u.password ?? A.password, 10), pinHash: bcrypt.hashSync(u.pin ?? A.pin, 10),
      },
    });
  }

  // 3) Sociedad principal (cuenta de cobranza de la inmo) — la propiedad la referencia
  const soc = await tx.sociedad.create({
    data: {
      inmobiliariaId: tid,
      razonSocial: S?.razonSocial ?? I.nombre, nombreComercial: S?.nombreComercial ?? I.nombre,
      cuit: S?.cuit ?? I.cuit, condicionFiscal: S?.condicionFiscal ?? 'RESPONSABLE_INSCRIPTO',
      domicilioFiscal: S?.domicilioFiscal ?? [I.direccionCalle, I.direccionAltura, I.direccionCiudad].filter(Boolean).join(' '),
      email: S?.email ?? I.email, telefono: S?.telefono ?? I.telefono ?? null,
      cuentaCobranza: S?.cuentaCobranza ?? undefined,
      afip: S?.afip ?? { conectado: false },
      esPrincipal: true,
    },
  });

  // 4) Propietario(s)
  const ownIds = [];
  for (const o of OWN) {
    const created = await tx.propietario.create({
      data: {
        inmobiliariaId: tid, nombre: o.nombre, apellido: o.apellido,
        cuit: o.cuit ?? null, email: o.email ?? null, telefono: o.telefono ?? null,
        cbuAlias: o.cbuAlias ?? null, comisionPct: o.comisionPct ?? C.comisionInmobiliaria ?? 0, notas: o.notas ?? null,
      },
    });
    ownIds.push({ id: created.id, pct: Number(o.participacionPct), sinCbu: !o.cbuAlias });
  }

  // 5) Propiedad
  const prop = await tx.propiedad.create({
    data: {
      inmobiliariaId: tid, direccion: P.direccion, ciudad: P.ciudad, provincia: P.provincia,
      tipo: P.tipo, ambientes: P.ambientes ?? null, m2: P.m2 ?? null,
      estado: 'ALQUILADA', sociedadId: soc.id,
    },
  });

  // 6) Participaciones (suman 100, validado arriba)
  for (const o of ownIds) {
    await tx.participacionPropietario.create({
      data: { inmobiliariaId: tid, propiedadId: prop.id, propietarioId: o.id, porcentaje: o.pct },
    });
  }

  // 7) Contrato
  const contrato = await tx.contrato.create({
    data: {
      inmobiliariaId: tid, propiedadId: prop.id, estado: 'ACTIVO',
      monto: Number(C.monto), moneda: C.moneda,
      fechaInicio: new Date(C.fechaInicio), fechaFin: new Date(C.fechaFin),
      diaPago: C.diaPago ?? 10,
      indiceAjuste: C.indiceAjuste ?? 'FIJO', frecuenciaAjusteMeses: C.frecuenciaAjusteMeses ?? 12,
      tipoContrato: C.tipoContrato,
      comisionInmobiliaria: C.comisionInmobiliaria ?? null,
      depositoGarantia: C.depositoGarantia ?? null,
      modoCobranza: C.modoCobranza ?? 'INMOBILIARIA',
      ...(C.montoExpensas ? { montoExpensas: Number(C.montoExpensas) } : {}),
    },
  });

  // 8) Inquilino titular (con este email entra por OTP)
  const inq = await tx.inquilino.create({
    data: {
      inmobiliariaId: tid, email: Q.email.toLowerCase(), nombre: Q.nombre, apellido: Q.apellido,
      telefono: Q.telefono ?? null, dni: Q.dni ?? null, contratoId: contrato.id,
    },
  });

  // 9) Puntero de contrato actual en la propiedad
  await tx.propiedad.update({ where: { id: prop.id }, data: { contratoActualId: contrato.id } });

  // 10) Primera liquidación (período actual)
  const alquiler = Number(L.montoAlquiler ?? C.monto);
  const expensas = L.montoExpensas != null ? Number(L.montoExpensas) : (C.montoExpensas ? Number(C.montoExpensas) : null);
  const total = alquiler + (expensas ?? 0);
  await tx.liquidacion.create({
    data: {
      inmobiliariaId: tid, contratoId: contrato.id, periodo: L.periodo,
      montoAlquiler: alquiler, montoExpensas: expensas, montoTotal: total,
      fechaVencimiento: new Date(L.fechaVencimiento), estado: L.estado ?? 'PENDIENTE',
    },
  });

  return { tid, adminEmail: admin.email, propId: prop.id, contratoId: contrato.id, inqEmail: inq.email, ownSinCbu: ownIds.filter((o) => o.sinCbu).length };
});

await prisma.$disconnect();
console.log('✓ Onboarding real completo');
console.log(JSON.stringify(resumen, null, 1));
if (resumen.ownSinCbu > 0) console.log(`⚠ ${resumen.ownSinCbu} propietario(s) sin CBU: no se les va a poder rendir hasta cargarlo.`);
console.log(`\nEntrá al panel con: ${resumen.adminEmail} / (la contraseña que cargaste). El inquilino entra con: ${resumen.inqEmail} (OTP por email).`);
