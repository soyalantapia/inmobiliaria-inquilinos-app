/**
 * CUARTA AUDITORÍA · Tres puertas de autenticación que decían más de lo que debían.
 *
 * ── 1. `POST /auth/otp/verify` decía en el TEXTO si un email es inquilino ─────────────
 *
 * Email inexistente → `«Código inválido»`. Email de un inquilino con el código equivocado →
 * `«Código inválido o vencido»`. **Dos strings distintos**: el endpoint contestaba si un email
 * pertenece a un inquilino de la plataforma. Y el reloj decía lo mismo, porque el camino del
 * email inexistente vuelve antes: sin la segunda query ni los `bcrypt.compareSync`.
 *
 * Es el MISMO par —mensaje y tiempo— que el portal del propietario ya había cerrado el 20/08,
 * con su piso de rechazo. El login del inquilino se pasó por alto. El piso sale ahora a
 * `lib/piso-de-rechazo.ts` para que lo compartan y no vuelvan a divergir.
 *
 * ── 2. El límite por ruta REEMPLAZA al global, y no se arregla apilando otro ──────────
 *
 * `/auth/propietario/otp/verify` declara `config.rateLimit` con `keyGenerator` por email, y su
 * comentario afirmaba que «el global de 300/min sigue aplicando». **Es falso.** El `onRoute` de
 * `@fastify/rate-limit@10.3.0` es un if/else (`index.js:142-156`): si la ruta trae
 * `config.rateLimit`, se registra SÓLO el limitador de la ruta.
 *
 * 🔴 Lo obvio —agregar un segundo limitador por IP en `onRequest`— **desactiva el de cuenta en
 * silencio**: el plugin marca la request con un flag (`rateLimitRan`, `index.js:281-285`) y
 * corre SÓLO EL PRIMERO. Lo probé y lo agarró el test que ya existía
 * (`portal-propietario-e2e`, "los intentos se cortan POR CUENTA, no por IP"), que pasó de 429
 * a 401 — el techo por IP le había comido el lugar al que protege la cuenta.
 *
 * Por eso acá no hay arreglo de código: hay un caso que **fija la trampa**, para que el próximo
 * que lea el comentario y quiera apilar un limitador se entere antes y no después. El techo por
 * IP que falta queda como decisión en `PARA-ALAN.md`.
 *
 * ── 3. El conmutador devolvía el estado del PIN AJENO ─────────────────────────────────
 *
 * `POST /auth/usuario/conmutar` hacía `send(r)` con el objeto entero, y en el 423 eso incluye
 * `bloqueadoHasta`: la hora exacta en que se desbloquea el PIN de OTRA persona.
 * `GET /auth/usuario/conmutables` esconde ese dato a propósito, con el motivo escrito: «a un
 * tercero le diría cuándo volver a probar, que es justo lo que un atacante quiere saber».
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): volviendo el mensaje del email
 * inexistente a «Código inválido», el primer caso falla. Volviendo `send(r)` sin el filtro, el
 * del PIN también.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let inmobiliariaId = '';
let tOperador = '';
let bloqueadoId = '';

const P = 'auth4_';
const EMAIL_BLOQUEADO = 'zz-pin-bloqueado@example.com';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/** El email del inquilino demo del seed: existe seguro. */
const EMAIL_INQUILINO = 'mariela.sosa@gmail.com';
const EMAIL_INEXISTENTE = 'no-existe-jamas-4444@example.invalid';

const verificar = (email: string) =>
  app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email, code: '123456' } });

beforeAll(async () => {
  prisma = new PrismaClient();
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tOperador = await loginTest(app, 'luciana@delsol.com', 'delsol123');

  // Un usuario con el PIN BLOQUEADO, para el 423 del conmutador.
  await prisma.usuario.deleteMany({ where: { email: EMAIL_BLOQUEADO } });
  const u = await prisma.usuario.create({
    data: {
      inmobiliariaId,
      nombre: 'Con',
      apellido: 'PinBloqueado',
      email: EMAIL_BLOQUEADO,
      rol: 'CARGA',
      activo: true,
      pinHash: bcrypt.hashSync('54321', 8),
      pinIntentosFallidos: 5,
      pinBloqueadoHasta: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  bloqueadoId = u.id;
}, 420_000);

afterAll(async () => {
  // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
  if (bloqueadoId) {
    await prisma.eventoAuditoria.deleteMany({ where: { entidadId: bloqueadoId } });
    await prisma.usuario.deleteMany({ where: { id: bloqueadoId } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('el login del inquilino no dice si un email existe', () => {
  it('🔴 el mensaje es el MISMO para un email de inquilino y para uno que no lo es', async () => {
    const existe = await verificar(EMAIL_INQUILINO);
    const noExiste = await verificar(EMAIL_INEXISTENTE);
    expect(existe.statusCode).toBe(401);
    expect(noExiste.statusCode).toBe(401);
    // Con el bug: 'Código inválido o vencido' contra 'Código inválido'.
    expect(noExiste.json().message).toBe(existe.json().message);
  });

  it('y el reloj tampoco: los dos rechazos pasan por el mismo piso', async () => {
    // El piso es de 900 ms; se mide que los DOS lo respeten, no que sean idénticos al ms
    // (eso dependería de la red y del pool, que es justo lo que un piso fijo evita).
    const medir = async (email: string) => {
      const t = process.hrtime.bigint();
      await verificar(email);
      return Number(process.hrtime.bigint() - t) / 1e6;
    };
    const existe = await medir(EMAIL_INQUILINO);
    const noExiste = await medir(EMAIL_INEXISTENTE);
    expect(existe).toBeGreaterThanOrEqual(850);
    // Con el bug: el inexistente volvía en decenas de ms y el spread era el oráculo.
    expect(noExiste).toBeGreaterThanOrEqual(850);
  });
});

describe('el conmutador no dice cuándo se desbloquea el PIN de otro', () => {
  it('🔴 a un OPERADOR el 423 no le trae la hora', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/auth/usuario/conmutar',
      headers: auth(tOperador),
      payload: { usuarioId: bloqueadoId, pin: '11111' },
    });
    expect(r.statusCode).toBe(423);
    // Con el bug: la hora exacta en que puede volver a probar.
    expect(r.json().bloqueadoHasta).toBeNull();
    // El estado sí se dice: si no, el que intenta no entiende por qué le rebota.
    expect(r.json().message).toMatch(/intentos fallidos/i);
  });

  it('CONTROL POSITIVO — a un ADMIN sí, que es quien administra el equipo', async () => {
    const tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
    const r = await app.inject({
      method: 'POST',
      url: '/auth/usuario/conmutar',
      headers: auth(tAdmin),
      payload: { usuarioId: bloqueadoId, pin: '11111' },
    });
    expect(r.statusCode).toBe(423);
    expect(r.json().bloqueadoHasta).toBeTruthy();
  });
});

describe('apilar un segundo limitador desactivaría el que protege la cuenta', () => {
  it('el plugin corre SÓLO el primero, y está escrito en su fuente', async () => {
    // Esto no aserta sobre nuestro código: aserta sobre la librería, porque es la premisa que
    // hace que el arreglo "obvio" sea una regresión. Si una versión futura saca ese flag, este
    // caso se pone rojo y ahí SÍ se puede apilar el techo por IP.
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const src = readFileSync(req.resolve('@fastify/rate-limit'), 'utf8');
    // El flag por request: el primer limitador lo marca y los siguientes salen sin hacer nada.
    expect(src).toContain('rateLimitRan');
    expect(src).toMatch(/if \(req\[rateLimitRan\]\)\s*\{\s*return/);
    // Y el if/else que hace que `config.rateLimit` REEMPLACE al global en vez de sumarse.
    expect(src).toMatch(/routeOptions\.config\?\.rateLimit != null/);
  });

  it('y la ruta NO tiene un segundo limitador puesto', async () => {
    // El guard contra el arreglo bienintencionado. Si alguien agrega
    // `onRequest: app.rateLimit(...)` acá, el techo por CUENTA deja de contar en silencio.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/portal-propietario.ts', import.meta.url)),
      'utf8',
    );
    // Se miran las líneas de CÓDIGO, no los comentarios: el comentario del handler nombra
    // `app.rateLimit(...)` a propósito, para contar por qué no va.
    const codigo = src
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join(' ');
    expect(codigo).not.toContain('app.rateLimit(');
    // Y la afirmación falsa que había —"el global de 300/min sigue aplicando"— no vuelve.
    expect(src).not.toContain('el global de 300/min sigue aplicando');
  });
});
