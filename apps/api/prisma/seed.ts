/**
 * Seeds idempotentes (upsert): portan los mocks del front para que la demo se
 * vea idéntica con datos reales. Corre con `pnpm --filter api seed` y también
 * desde los tests (seedBase).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const PASSWORD_DEV = 'delsol123';
const PIN_DEV = '1234';

export async function seedBase(prisma: PrismaClient) {
  const inmobiliaria = await prisma.inmobiliaria.upsert({
    where: { slug: 'del-sol' },
    update: {},
    create: { nombre: 'Inmobiliaria del Sol', slug: 'del-sol' },
  });

  const passwordHash = bcrypt.hashSync(PASSWORD_DEV, 10);
  const pinHash = bcrypt.hashSync(PIN_DEV, 10);

  const usuarios = [
    { email: 'roberto@delsol.com', nombre: 'Roberto Tapia', rol: 'ADMIN' as const },
    { email: 'luciana@delsol.com', nombre: 'Luciana Vidal', rol: 'OPERADOR' as const },
    { email: 'camila@delsol.com', nombre: 'Camila Acosta', rol: 'CARGA' as const },
  ];
  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, rol: u.rol },
      create: { ...u, inmobiliariaId: inmobiliaria.id, passwordHash, pinHash },
    });
  }

  // Inquilinos de los contratos mock (cnt_001..)
  const inquilinos = [
    { email: 'mariela.sosa@gmail.com', nombre: 'Mariela Sosa', telefono: '+5491145678900', dni: '32456789' },
    { email: 'juan.perez@inquilino.demo', nombre: 'Juan Pérez', telefono: null, dni: null },
    { email: 'laura.gimenez@inquilino.demo', nombre: 'Laura Giménez', telefono: null, dni: null },
    { email: 'carlos.romero@inquilino.demo', nombre: 'Carlos Romero', telefono: null, dni: null },
    { email: 'ana.pereyra@inquilino.demo', nombre: 'Ana Pereyra', telefono: null, dni: null },
    { email: 'tomas.bravo@inquilino.demo', nombre: 'Tomás Bravo', telefono: null, dni: null },
  ];
  for (const i of inquilinos) {
    await prisma.inquilino.upsert({
      where: { email: i.email },
      update: { nombre: i.nombre },
      create: { ...i, inmobiliariaId: inmobiliaria.id },
    });
  }

  return { inmobiliariaId: inmobiliaria.id };
}

// Runner CLI
const esRunner = process.argv[1]?.endsWith('seed.ts');
if (esRunner) {
  const prisma = new PrismaClient();
  seedBase(prisma)
    .then(({ inmobiliariaId }) => {
      console.log(`✓ seeds aplicados (tenant ${inmobiliariaId})`);
      return prisma.$disconnect();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
