/**
 * El camino del propietario, por HTTP y de punta a punta.
 *
 * POR QUÉ EXISTE: hasta hoy la suite tenía CERO `app.inject` contra un endpoint del portal.
 * Los tres archivos que lo nombraban son puros o estructurales —`portal-aislamiento` lee el
 * texto del archivo de rutas y verifica que cada query nombre el tenant; `rendicion-pendiente*`
 * y `pendiente-por-duenio` fijan aritmética sin base—. O sea: los 7 endpoints y el login nunca
 * se habían ejecutado en un test. La única vez que corrieron de punta a punta fue a mano, el
 * 20/08, y ahí aparecieron tres bugs de plata.
 *
 * QUÉ CUBRE, Y POR QUÉ ESE RECORTE:
 *  - El login por OTP desde `verify` para abajo. La generación NO se puede ejercitar acá: el
 *    código se guarda con bcrypt y el logger está apagado con NODE_ENV=test, así que no hay
 *    forma de leerlo. El test escribe su propia fila de OTP con un código conocido, que es
 *    exactamente lo que `verify` compara. De `request` se prueba lo que sí es observable: que
 *    responda 200 sin revelar si el email existe.
 *  - Los 7 endpoints con un token real, verificando CONTENIDO y no sólo el status. Un 200 con
 *    el cuerpo vacío pasaría un test de status y sería un portal roto.
 *  - El aislamiento CONTRA OTRO TENANT DE VERDAD: se crea una segunda inmobiliaria con su
 *    propio propietario y se comprueba que no ve nada de la primera. El guard estructural no
 *    puede probar esto: prueba la forma de las queries, no el comportamiento.
 *  - La revocación por baja lógica, que es el ÚNICO punto de revocación que tiene el portal
 *    (el token dura 7 días y no hay denylist).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let tid = ''; // el tenant del seed
let token = ''; // token del propietario del seed
let tokenAjeno = ''; // token del propietario de la OTRA inmobiliaria

const CODIGO = '424242';
const P = 'ZZ-e2e-prop-'; // prefijo de todo lo que crea este archivo
const OTRO_TENANT = `${P}inmo`;
const OTRO_PROP = `${P}duenio`;
const OTRO_EMAIL = 'duenio.de.otra.inmo@example.invalid';

/**
 * T-73 · Un propietario EXCLUSIVO para el caso "el código igual se emite".
 *
 * Ese caso cuenta las filas de OTP que dejó UN request, y contarlas sobre `OTRO_PROP` lo volvía
 * flaky: el test de temporización que corre antes llama a `/auth/propietario/otp/request` muchas
 * veces sobre ese mismo email, y la escritura del código es ASÍNCRONA a propósito —se sacó del
 * camino del request para que el reloj no delate si un email existe—. Esas escrituras en vuelo
 * aterrizaban DESPUÉS del `deleteMany` del caso siguiente, que entonces veía 2 donde esperaba 1.
 *
 * Se vio en el CI del PR #69: el mismo commit, una corrida en rojo y otra en verde. No era un
 * defecto del producto — pero un test que falla de a ratos enseña a ignorar los rojos, que es
 * exactamente lo que este repo ya pagó con nueve días de CI en rojo.
 *
 * Aislarlo por dato —y no esperar más tiempo— es lo único que lo cierra: con un propietario que
 * nadie más toca, no hay escritura ajena posible que contar.
 */
const EMISOR_PROP = `${P}emisor`;
const EMISOR_EMAIL = 'duenio.solo.para.emision@example.invalid';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/** Le arma una fila de OTP válida a un propietario y la canjea por un token. */
async function entrarComo(propietarioId: string, email: string): Promise<string> {
  await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId } });
  await prisma.codigoOtpPropietario.create({
    data: {
      propietarioId,
      codeHash: bcrypt.hashSync(CODIGO, 8),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/auth/propietario/otp/verify',
    payload: { email, code: CODIGO },
  });
  expect(res.statusCode, `verify de ${email} → ${res.body}`).toBe(200);
  return res.json().token as string;
}

async function limpiar() {
  await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId: { startsWith: P } } });
  await prisma.propietario.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.inmobiliaria.deleteMany({ where: { id: { startsWith: P } } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  ({ inmobiliariaId: tid } = await seedBase(prisma));
  await limpiar();

  // Una inmobiliaria de verdad, con su propietario, para poder probar el aislamiento contra
  // algo que existe. Sin esto, "no ve datos de otro tenant" se prueba contra la nada.
  await prisma.inmobiliaria.create({
    data: {
      id: OTRO_TENANT,
      nombre: 'Inmobiliaria Ajena (e2e)',
      cuit: '30-70000000-7',
      email: 'contacto@ajena.invalid',
      telefono: '11 0000-0000',
      matricula: 'XX-0000',
      direccionCalle: 'Falsa',
      direccionAltura: '123',
      direccionCiudad: 'CABA',
      direccionProvincia: 'Buenos Aires',
      direccionCp: '1000',
      codigoReferido: `${P}ref`,
    },
  });
  await prisma.propietario.create({
    data: {
      id: OTRO_PROP,
      inmobiliariaId: OTRO_TENANT,
      nombre: 'Dueño',
      apellido: 'Ajeno',
      cuit: '20-11111111-1',
      email: OTRO_EMAIL,
      telefono: '11 1111-1111',
      activo: true,
    },
  });

  // T-73: el propietario exclusivo del caso de emisión. Mismo tenant, email propio.
  await prisma.propietario.create({
    data: {
      id: EMISOR_PROP,
      inmobiliariaId: OTRO_TENANT,
      nombre: 'Dueño',
      apellido: 'Emisor',
      cuit: '20-22222222-2',
      email: EMISOR_EMAIL,
      telefono: '11 2222-2222',
      activo: true,
    },
  });

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  // own_001 (Eduardo Castro) es el propietario del seed con cartera y rendición.
  token = await entrarComo('own_001', 'eduardo.castro@example.com');
  tokenAjeno = await entrarComo(OTRO_PROP, OTRO_EMAIL);
}, 420_000);

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

const RUTAS = [
  '/portal/mi-cartera',
  '/portal/propiedades',
  '/portal/rendiciones',
  '/portal/reclamos',
  '/portal/pendiente',
  '/portal/anuncios',
] as const;

describe('Portal del propietario — el camino entero, por HTTP', () => {
  describe('la puerta', () => {
    it('sin token, los 6 endpoints dan 401 — ninguno se olvidó del guard', async () => {
      for (const url of RUTAS) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode, `${url} sin token`).toBe(401);
      }
    });

    it('un token de USUARIO del panel no sirve para el portal', async () => {
      // No es lo mismo "no estás autenticado" que "esta sesión no es para acá": el panel y el
      // portal comparten la API, y un admin no tiene por qué entrar por la puerta del dueño.
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'roberto@delsol.com', password: 'delsol123' },
      });
      const res = await app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(login.json().token) });
      expect(res.statusCode).toBe(403);
    });

    it('pedir el código de un email que no existe responde 200 igual', async () => {
      // A propósito: si contestara distinto, cualquiera podría averiguar qué emails son
      // propietarios de una inmobiliaria probando de a uno.
      const res = await app.inject({
        method: 'POST',
        url: '/auth/propietario/otp/request',
        payload: { email: 'no-existe-jamas-9999@example.invalid' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    });

    it('rechazar tarda lo MISMO exista o no el email: el reloj no puede delatarlo', async () => {
      // `request` contesta 200 siempre para no revelar si un email es propietario. `verify`
      // lo delataba por el tiempo: medido el 20/08, 703 ms para un email real con OTP
      // pendiente contra 253 ms para uno inexistente. El ataque es de dos pasos —pedir el
      // código, que no dice nada, y después mandar cualquiera y cronometrar—.
      //
      // La causa NO era bcrypt (19 ms acá): era una query de diferencia, y contra la base
      // remota cada una son ~450 ms. Por eso el arreglo es un PISO fijo y no igualar el
      // trabajo: igualar costos de I/O depende de la red, del pool y del planner.
      //
      // El umbral es generoso a propósito: acá se afirma que la diferencia dejó de ser una
      // señal, no un número exacto. Con el bug daba 450.
      const medir = async (email: string) => {
        const t = process.hrtime.bigint();
        const r = await app.inject({
          method: 'POST',
          url: '/auth/propietario/otp/verify',
          payload: { email, code: '000000' },
        });
        expect(r.statusCode, 'si esto no es 401 la medición no vale (¿rate limit?)').toBe(401);
        return Number(process.hrtime.bigint() - t) / 1e6;
      };
      const existe = await medir(OTRO_EMAIL);
      const noExiste = await medir('no-existe-jamas-9998@example.invalid');
      expect(
        Math.abs(existe - noExiste),
        `existe=${existe.toFixed(0)}ms noExiste=${noExiste.toFixed(0)}ms — la diferencia ` +
          'volvió a ser medible: alguien puede enumerar qué emails son propietarios',
      ).toBeLessThan(200);
    });

    it('PEDIR el código tampoco puede delatarlo por el reloj', async () => {
      // El hermano del test de arriba, sobre el otro endpoint. `request` contesta 200 siempre,
      // pero la rama del email que EXISTE awaiteaba dos escrituras más (invalidar los códigos
      // viejos y crear el nuevo). Contra la base remota cada query son ~450 ms: el email real
      // tardaba cerca de un segundo más, y eso convertía el 200-siempre en decoración.
      //
      // Acá el arreglo NO es un piso fijo como en `verify`: las escrituras se sacaron del
      // camino del request. Se elimina la diferencia en vez de esconderla, y no le agrega
      // espera a nadie.
      const unaVez = async (email: string) => {
        const t = process.hrtime.bigint();
        const r = await app.inject({ method: 'POST', url: '/auth/propietario/otp/request', payload: { email } });
        expect(r.statusCode, 'si esto no es 200 la medición no vale (¿rate limit?)').toBe(200);
        return Number(process.hrtime.bigint() - t) / 1e6;
      };
      // Se mide el MÍNIMO de varias corridas, y descartando la primera.
      //
      // La primera de cada forma paga el arranque en frío del engine de Prisma: medido acá,
      // ~2100 ms contra los ~25 ms de las siguientes, en las DOS ramas por igual. Sin
      // descartarla, este test comparaba ruido de warm-up y fallaba (o pasaba) por azar.
      //
      // Y el mínimo, no el promedio: un oráculo de tiempo se explota con las observaciones más
      // rápidas, así que es la estadística que le importa al atacante. El promedio lo
      // enmascara con el ruido del GC y del scheduler.
      //
      // CUIDADO CON EL PRESUPUESTO: `request` tiene rate limit 10/15min y su key es la IP, así
      // que TODAS las llamadas del archivo comparten el tope. Con 3 por email son 6, más 2 de
      // los otros tests del bloque: 8 de 10. Agregar llamadas acá empieza a devolver 429 y la
      // medición deja de valer (por eso `unaVez` afirma el 200 antes de contar el tiempo).
      const medir = async (email: string) => {
        await unaVez(email); // calentar, se tira
        return Math.min(await unaVez(email), await unaVez(email));
      };
      const existe = await medir(OTRO_EMAIL);
      const noExiste = await medir('no-existe-jamas-9997@example.invalid');
      expect(
        Math.abs(existe - noExiste),
        `existe=${existe.toFixed(0)}ms noExiste=${noExiste.toFixed(0)}ms — la diferencia ` +
          'volvió a ser medible: alguien puede enumerar qué emails son propietarios',
      ).toBeLessThan(200);
    });

    it('y el código igual se emite, aunque la respuesta no lo espere', async () => {
      // La contracara del test de arriba: sacar las escrituras del camino del request no puede
      // significar que dejen de ocurrir. El orden se conserva —primero se guarda, después sale
      // el mail—, así que nadie puede recibir un código que no existe.
      await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId: EMISOR_PROP } });
      const r = await app.inject({
        method: 'POST', url: '/auth/propietario/otp/request', payload: { email: EMISOR_EMAIL },
      });
      expect(r.statusCode).toBe(200);

      // Se espera a que la escritura aterrice. El polling es corto y explícito: si algún día
      // el código dejara de emitirse, esto falla en dos segundos en vez de pasar por casualidad.
      let filas = 0;
      for (let i = 0; i < 20 && filas === 0; i++) {
        filas = await prisma.codigoOtpPropietario.count({ where: { propietarioId: EMISOR_PROP, usedAt: null } });
        if (filas === 0) await new Promise((r2) => setTimeout(r2, 100));
      }
      // Sigue siendo `toBe(1)` y no `>= 1`: la afirmación fuerte —un request deja UN código, no
      // dos— se conserva. Lo que cambió es de quién se cuenta, no cuánto se exige.
      expect(filas, 'pedir el código tiene que dejarlo guardado').toBe(1);
      await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId: EMISOR_PROP } });
    });

    it('los intentos se cortan POR CUENTA, no por IP', async () => {
      // El código es de 6 dígitos y vive 10 minutos. Los topes que había —300/min global y
      // 20 cada 15' en la ruta— son los dos por IP, así que acotaban al ATACANTE y no a la
      // cuenta: con un proxy rotativo, los intentos contra un propietario no tenían techo.
      //
      // Las DOS mitades importan y por eso van juntas. Sin la segunda, este test pasaría
      // igual con la key vieja (la IP) y no estaríamos probando nada: el `hook: 'preHandler'`
      // es lo que hace que el body esté parseado cuando se calcula la key, y si eso se rompe
      // la key cae a la IP EN SILENCIO.
      const intentar = (email: string) =>
        app.inject({
          method: 'POST',
          url: '/auth/propietario/otp/verify',
          payload: { email, code: '000000' },
        });

      const objetivo = `ZZ-fuerza-bruta-${Date.now()}@example.invalid`;
      const codigos: number[] = [];
      for (let i = 0; i < 12; i++) codigos.push((await intentar(objetivo)).statusCode);
      expect(codigos.at(-1), 'la cuenta atacada tiene que terminar bloqueada').toBe(429);

      const otra = await intentar(`ZZ-otra-persona-${Date.now()}@example.invalid`);
      expect(
        otra.statusCode,
        'otra cuenta desde la MISMA ip quedó bloqueada: la key volvió a ser la IP y el tope ' +
          'por cuenta no existe',
      ).not.toBe(429);
    });

    it('un código equivocado no entra', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/propietario/otp/verify',
        payload: { email: OTRO_EMAIL, code: '000000' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('el código YA USADO no sirve dos veces', async () => {
      // El de tokenAjeno se canjeó en el beforeAll. Reintentarlo con el mismo código tiene
      // que fallar: si no, quien lo vea pasar por el mail lo puede reusar mientras no expire.
      const res = await app.inject({
        method: 'POST',
        url: '/auth/propietario/otp/verify',
        payload: { email: OTRO_EMAIL, code: CODIGO },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('lo que ve adentro', () => {
    it('mi-cartera trae SUS datos y los de su inmobiliaria', async () => {
      const res = await app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(token) });
      expect(res.statusCode).toBe(200);
      const c = res.json();
      expect(c.nombre).toContain('Castro');
      expect(c.email).toBe('eduardo.castro@example.com');
      expect(typeof c.comisionPct).toBe('number');
      // El BOOLEANO del CBU, nunca el número: es lo que le explica al dueño por qué no le
      // depositan. Que el CBU mismo no viaje se afirma abajo.
      expect(typeof c.tieneCbu).toBe('boolean');
      expect(c.inmobiliaria.nombre).toBeTruthy();
    });

    it('mi-cartera dice SI HAY cbu, pero nunca el número', async () => {
      // El dueño ya sabe su CBU: mandarlo sólo agranda lo que se filtra si el token se
      // pierde. Lo que sí necesita es el BOOLEANO, que es lo que le explica por qué no le
      // depositan (POST /rendiciones corta con 409 sin CBU cargado).
      const prismaLocal = new PrismaClient();
      try {
        await prismaLocal.propietario.update({
          where: { id: 'own_001' },
          data: { cbuAlias: 'ZZ.e2e.alias.del.duenio' },
        });
        const res = await app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(token) });
        expect(res.json().tieneCbu).toBe(true);
        // Se afirma sobre el cuerpo CRUDO y contra el valor real: así no se cuela mañana
        // con otro nombre de campo, ni recortado a sus últimos cuatro dígitos.
        expect(res.body).not.toContain('ZZ.e2e.alias.del.duenio');
        expect(res.body).not.toContain('cbuAlias');

        // Y sin CBU cargado el booleano lo dice, que es el caso que destraba la llamada.
        await prismaLocal.propietario.update({ where: { id: 'own_001' }, data: { cbuAlias: null } });
        const sin = await app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(token) });
        expect(sin.json().tieneCbu).toBe(false);
      } finally {
        await prismaLocal.$disconnect();
      }
    });

    it('propiedades: cada unidad con su participación y su historial de períodos', async () => {
      const res = await app.inject({ method: 'GET', url: '/portal/propiedades', headers: auth(token) });
      expect(res.statusCode).toBe(200);
      const lista = res.json() as {
        id: string;
        direccion: string;
        participacionPct: number;
        contrato: { periodos: { periodo: string; estado: string; condonada: boolean }[] } | null;
      }[];
      expect(lista.length).toBeGreaterThan(0);
      for (const u of lista) {
        expect(u.direccion, 'una unidad sin dirección es una fila que no dice nada').toBeTruthy();
        expect(u.participacionPct).toBeGreaterThan(0);
        expect(u.participacionPct).toBeLessThanOrEqual(100);
      }
      // Al menos una tiene contrato con períodos: si no, no hay nada que auditar.
      const conPeriodos = lista.find((u) => (u.contrato?.periodos?.length ?? 0) > 0);
      expect(conPeriodos, 'ninguna unidad trajo períodos').toBeTruthy();
      // `condonada` viaja: es lo que distingue "te lo pagaron" de "se lo perdonaron".
      expect(conPeriodos!.contrato!.periodos[0]).toHaveProperty('condonada');
    });

    it('rendiciones: la lista trae la moneda y las cuentas cierran', async () => {
      const res = await app.inject({ method: 'GET', url: '/portal/rendiciones', headers: auth(token) });
      expect(res.statusCode).toBe(200);
      const rs = res.json() as {
        id: string; cobrado: number; comision: number; gastos: number;
        otrosIngresos: number; teDepositamos: number; moneda: string;
      }[];
      expect(rs.length).toBeGreaterThan(0);
      for (const r of rs) {
        expect(['ARS', 'USD']).toContain(r.moneda);
        // La cuenta que el dueño hace de memoria: cobrado − comisión − gastos + otros.
        const esperado = Math.round((r.cobrado - r.comision - r.gastos + r.otrosIngresos) * 100) / 100;
        expect(r.teDepositamos, `la rendición ${r.id} no cierra`).toBeCloseTo(esperado, 2);
      }
    });

    it('el detalle de una rendición explica de dónde salió cada peso', async () => {
      const lista = (await app.inject({ method: 'GET', url: '/portal/rendiciones', headers: auth(token) })).json();
      const res = await app.inject({ method: 'GET', url: `/portal/rendiciones/${lista[0].id}`, headers: auth(token) });
      expect(res.statusCode).toBe(200);
      const d = res.json();
      expect(d.id).toBe(lista[0].id);
      expect(Array.isArray(d.detalleAlquileres)).toBe(true);
      expect(Array.isArray(d.detalleGastos)).toBe(true);
      expect(Array.isArray(d.detalleIngresos)).toBe(true);
      // El bruto tiene que ser lo que suman los alquileres imputados, no un número suelto.
      //
      // ⚠️ SÓLO SE EXIGE CUANDO HAY LÍNEAS, y el motivo es un hueco real, no una comodidad
      // del test. `alquileres_rendidos` nació el 01/07/2026 (migración
      // 20260701130000_rendicion_incremental) y se creó VACÍA, sin backfill: toda rendición
      // anterior existe con su `montoBruto` y cero líneas. Este mismo assert lo detectó en su
      // primera corrida contra la del seed —cobrado 288.000, detalle vacío—.
      //
      // La consecuencia no es cosmética: `/portal/pendiente` resta lo rendido leyendo SOLO esa
      // tabla, así que para esas rendiciones no resta NADA y el dueño ve como "cobrado y
      // todavía sin rendirte" plata que ya cobró. Cerrar el hueco es una decisión de producto
      // —backfill o piso de fecha— y está anotada aparte. Mientras tanto el test fija las dos
      // mitades: que cuando hay ledger cuadre al peso, y que el caso sin ledger EXISTE.
      const suma = d.detalleAlquileres.reduce((a: number, x: { monto: number }) => a + x.monto, 0);
      if (d.detalleAlquileres.length > 0) {
        expect(d.cobrado).toBeCloseTo(Math.round(suma * 100) / 100, 2);
      } else {
        expect(
          d.cobrado,
          'una rendición sin líneas de alquiler pero con bruto es una PRE-ledger: no se puede ' +
            'reconstruir de dónde salió, y /portal/pendiente no la descuenta',
        ).toBeGreaterThan(0);
      }
    });

    it('reclamos, pendiente y anuncios responden con listas', async () => {
      for (const url of ['/portal/reclamos', '/portal/pendiente', '/portal/anuncios']) {
        const res = await app.inject({ method: 'GET', url, headers: auth(token) });
        expect(res.statusCode, url).toBe(200);
        expect(Array.isArray(res.json()), `${url} tiene que devolver una lista`).toBe(true);
      }
    });
  });

  describe('el aislamiento, contra un tenant que existe de verdad', () => {
    it('el dueño de la otra inmobiliaria no ve NADA de esta', async () => {
      for (const url of ['/portal/propiedades', '/portal/rendiciones', '/portal/reclamos', '/portal/pendiente', '/portal/anuncios']) {
        const res = await app.inject({ method: 'GET', url, headers: auth(tokenAjeno) });
        expect(res.statusCode, url).toBe(200);
        expect(res.json(), `${url} le filtró datos del otro tenant`).toEqual([]);
      }
      const cartera = await app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(tokenAjeno) });
      expect(cartera.json().inmobiliaria.nombre).toBe('Inmobiliaria Ajena (e2e)');
    });

    it('pedir por id la rendición de otro da 404, no el detalle', async () => {
      // Es el endpoint más sensible: devuelve el desglose de la plata de una persona.
      const mias = (await app.inject({ method: 'GET', url: '/portal/rendiciones', headers: auth(token) })).json();
      const res = await app.inject({
        method: 'GET',
        url: `/portal/rendiciones/${mias[0].id}`,
        headers: auth(tokenAjeno),
      });
      expect(res.statusCode).toBe(404);
    });

    it('no se puede saltar a la cartera de otro con /auth/propietario/elegir', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/propietario/elegir',
        headers: auth(tokenAjeno),
        payload: { propietarioId: 'own_001' },
      });
      expect([403, 404]).toContain(res.statusCode);
    });
  });

  /**
   * La plata que la rendición NO puede pagar tampoco se reclama.
   *
   * El alta de un contrato EN CURSO registra hasta 120 períodos pasados como pagados, con un
   * `Pago` sintético CONCILIADO, para que el saldo del inquilino arranque en el número
   * correcto. Esa plata la cobró la inmobiliaria antes de usar el sistema y ya se la liquidó
   * al dueño por fuera: no es un cobro rendible.
   *
   * Sin el filtro pasaban las dos cosas: el portal se la reclamaba al dueño como "cobrado y
   * todavía sin rendirte" —un número que no baja por ningún camino, porque nunca va a existir
   * un `AlquilerRendido` que la salde— y `POST /rendiciones` se la podía transferir de nuevo.
   *
   * Este test toca la QUERY, no la aritmética: los tests puros de `pendiente-por-duenio` ya
   * fijan la cuenta, y con los mapas ya filtrados no podrían ver este filtro.
   */
  describe('la plata migrada de cartera', () => {
    const PROP = `${P}prop`;
    const CNT = `${P}cnt`;
    const LIQ_MIG = `${P}liq-migrada`;
    const LIQ_REAL = `${P}liq-real`;

    beforeAll(async () => {
      await prisma.propiedad.create({
        data: {
          id: PROP, inmobiliariaId: tid, direccion: 'Migrada 100', ciudad: 'CABA',
          provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO',
        },
      });
      await prisma.participacionPropietario.create({
        data: { propiedadId: PROP, propietarioId: 'own_001', porcentaje: 100, inmobiliariaId: tid },
      });
      await prisma.contrato.create({
        data: {
          id: CNT, inmobiliariaId: tid, propiedadId: PROP, monto: 100000,
          fechaInicio: new Date('2024-01-01'), fechaFin: new Date('2030-01-01'), diaPago: 10,
          indiceAjuste: 'ICL', frecuenciaAjusteMeses: 12, estado: 'ACTIVO',
          modoCobranza: 'INMOBILIARIA',
        },
      });
      for (const [id, periodo] of [[LIQ_MIG, '2024-02'], [LIQ_REAL, '2024-03']] as const) {
        await prisma.liquidacion.create({
          data: {
            id, inmobiliariaId: tid, contratoId: CNT, periodo,
            montoAlquiler: 100000, montoTotal: 100000,
            fechaVencimiento: new Date(`${periodo}-10`), estado: 'PAGADO', moneda: 'ARS',
          },
        });
      }
      const base = {
        inmobiliariaId: tid, contratoId: CNT, monto: 100000, tipo: 'TOTAL' as const,
        metodo: 'EFECTIVO' as const, estado: 'CONCILIADO' as const,
        fechaTransferencia: new Date('2024-02-10'),
      };
      await prisma.pago.create({
        data: { ...base, liquidacionId: LIQ_MIG, periodo: '2024-02', migradoDeCartera: true },
      });
      await prisma.pago.create({
        data: { ...base, liquidacionId: LIQ_REAL, periodo: '2024-03', migradoDeCartera: false },
      });
    }, 120_000);

    afterAll(async () => {
      await prisma.pago.deleteMany({ where: { contratoId: CNT } });
      await prisma.liquidacion.deleteMany({ where: { contratoId: CNT } });
      await prisma.eventoContrato.deleteMany({ where: { contratoId: CNT } });
      await prisma.propiedad.updateMany({ where: { id: PROP }, data: { contratoActualId: null } });
      await prisma.contrato.deleteMany({ where: { id: CNT } });
      await prisma.participacionPropietario.deleteMany({ where: { propiedadId: PROP } });
      await prisma.propiedad.deleteMany({ where: { id: PROP } });
    });

    it('el período migrado NO figura como pendiente, y el cobrado de verdad SÍ', async () => {
      const res = await app.inject({ method: 'GET', url: '/portal/pendiente', headers: auth(token) });
      expect(res.statusCode).toBe(200);
      const unidad = (res.json() as { propiedadId: string; periodos: { periodo: string }[] }[])
        .find((u) => u.propiedadId === PROP);
      expect(unidad, 'la unidad tiene un cobro real sin rendir: tiene que aparecer').toBeTruthy();
      const periodos = unidad!.periodos.map((x) => x.periodo);
      expect(periodos).toContain('2024-03');
      expect(
        periodos,
        'el período migrado se le está reclamando al dueño como plata retenida, y la ' +
          'inmobiliaria nunca la tuvo',
      ).not.toContain('2024-02');
    });
  });
  describe('la revocación', () => {
    it('dar de baja al propietario corta la sesión que ya tenía abierta', async () => {
      // Es el ÚNICO punto de revocación del portal: el token dura 7 días y no hay denylist.
      // Si esto no cortara, el dado de baja seguiría viendo la morosidad del inquilino y el
      // desglose de las rendiciones durante una semana.
      const antes = await app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(tokenAjeno) });
      expect(antes.statusCode).toBe(200);

      await prisma.propietario.update({ where: { id: OTRO_PROP }, data: { activo: false } });
      const despues = await app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(tokenAjeno) });
      expect(despues.statusCode).toBe(401);

      await prisma.propietario.update({ where: { id: OTRO_PROP }, data: { activo: true } });
    });

    it('un token firmado para otro tenant no entra, aunque el propietarioId exista', async () => {
      // El par (id, inmobiliariaId) se verifica JUNTO. Con el id real y el tenant equivocado
      // la fila no matchea y se cae en el guard.
      const falso = app.jwt.sign({
        kind: 'propietario',
        propietarioId: 'own_001',
        inmobiliariaId: OTRO_TENANT,
        email: 'eduardo.castro@example.com',
      });
      const res = await app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(falso) });
      expect(res.statusCode).toBe(401);
    });
  });
});

/**
 * El rastro de que el dueño entró.
 *
 * Hasta acá no había forma de contestar "¿algún propietario usó el portal alguna vez?". El
 * único dato era `CodigoOtpPropietario.usedAt`, y es ambiguo: se escribe tanto al consumir un
 * código como al invalidar los anteriores. Sin esto, la inmobiliaria tampoco puede saber a
 * quién hay que reenviarle el acceso, ni nadie puede contestar quién entró y cuándo.
 */
describe('Portal — queda registrado que el dueño entró', () => {
  it('el OTP verify sella ultimoAccesoAt, y sólo el de la cartera con la que entró', async () => {
    const prismaLocal = new PrismaClient();
    try {
      await prismaLocal.propietario.update({
        where: { id: OTRO_PROP },
        data: { ultimoAccesoAt: null },
      });
      const antesOtro = await prismaLocal.propietario.findUniqueOrThrow({
        where: { id: 'own_001' },
        select: { ultimoAccesoAt: true },
      });

      await entrarComo(OTRO_PROP, OTRO_EMAIL);

      const despues = await prismaLocal.propietario.findUniqueOrThrow({
        where: { id: OTRO_PROP },
        select: { ultimoAccesoAt: true },
      });
      expect(despues.ultimoAccesoAt, 'entrar tiene que dejar rastro').not.toBeNull();

      // Y NO tocó al otro. Un dueño con dos carteras que abre una sola no accedió a las dos:
      // decir que sí sería inventar un dato que después alguien usa para decidir.
      const otroDespues = await prismaLocal.propietario.findUniqueOrThrow({
        where: { id: 'own_001' },
        select: { ultimoAccesoAt: true },
      });
      expect(otroDespues.ultimoAccesoAt).toEqual(antesOtro.ultimoAccesoAt);
    } finally {
      await prismaLocal.$disconnect();
    }
  });
});

/**
 * Anular una rendición NO puede hacer desaparecer la plata.
 *
 * Es la interacción más peligrosa de la baja lógica y no es evidente. Al anular se borran las
 * líneas del ledger y se conserva la cabecera — así ninguno de los 20 lectores de
 * `alquileres_rendidos` tiene que cambiar. Pero eso deja una rendición anulada con la MISMA
 * forma que una PRE-LEDGER: cabecera con monto y cero filas.
 *
 * Y la regla de las pre-ledger dice: "si hay una rendición de ese período sin líneas, el
 * período ya se rindió". Sin excluir las anuladas, anular haría que su período se diera por
 * saldado PARA SIEMPRE y la plata desapareciera del "cobrado y todavía sin rendirte" — lo
 * contrario exacto de lo que anular tiene que hacer.
 */
describe('Portal — anular devuelve la plata a "sin rendirte"', () => {
  const PROP2 = `${P}prop-anular`;
  const CNT2 = `${P}cnt-anular`;
  const LIQ2 = `${P}liq-anular`;
  const PERIODO = '2024-07';

  it('el período de una rendición anulada vuelve a figurar como pendiente', async () => {
    const db = new PrismaClient();
    try {
      await db.propiedad.create({
        data: {
          id: PROP2, inmobiliariaId: tid, direccion: 'Anulada 1', ciudad: 'CABA',
          provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO',
        },
      });
      await db.participacionPropietario.create({
        data: { propiedadId: PROP2, propietarioId: 'own_001', porcentaje: 100, inmobiliariaId: tid },
      });
      await db.contrato.create({
        data: {
          id: CNT2, inmobiliariaId: tid, propiedadId: PROP2, monto: 200000,
          fechaInicio: new Date('2024-01-01'), fechaFin: new Date('2030-01-01'), diaPago: 10,
          indiceAjuste: 'ICL', frecuenciaAjusteMeses: 12, estado: 'ACTIVO',
          modoCobranza: 'INMOBILIARIA',
        },
      });
      await db.liquidacion.create({
        data: {
          id: LIQ2, inmobiliariaId: tid, contratoId: CNT2, periodo: PERIODO,
          montoAlquiler: 200000, montoTotal: 200000,
          fechaVencimiento: new Date('2024-07-10'), estado: 'PAGADO', moneda: 'ARS',
        },
      });
      await db.pago.create({
        data: {
          inmobiliariaId: tid, contratoId: CNT2, liquidacionId: LIQ2, periodo: PERIODO,
          monto: 200000, tipo: 'TOTAL', metodo: 'EFECTIVO', estado: 'CONCILIADO',
          fechaTransferencia: new Date('2024-07-10'),
        },
      });

      const pendientes = async () => {
        const res = await app.inject({ method: 'GET', url: '/portal/pendiente', headers: auth(token) });
        const u = (res.json() as { propiedadId: string; total: number }[]).find((x) => x.propiedadId === PROP2);
        return u?.total ?? 0;
      };

      expect(await pendientes(), 'cobrado y sin rendir: tiene que figurar').toBe(200000);

      // Una rendición ANULADA de ese período, con la forma exacta que deja la baja lógica:
      // cabecera con monto y CERO líneas de alquiler.
      await db.rendicion.create({
        data: {
          id: `${P}rend-anulada`, inmobiliariaId: tid, propietarioId: 'own_001', periodo: PERIODO,
          montoBruto: 200000, comisionPct: 8, comisionMonto: 16000, totalGastos: 0,
          totalIngresos: 0, montoNeto: 184000, moneda: 'ARS', metodo: 'TRANSFERENCIA',
          anuladaAt: new Date(), motivoAnulacion: 'se rindió el período equivocado',
        },
      });

      expect(
        await pendientes(),
        'la rendición está ANULADA: su plata tiene que seguir figurando como sin rendir. Si ' +
          'esto da 0, la regla de las pre-ledger se está comiendo las anuladas y anular hace ' +
          'desaparecer plata en silencio',
      ).toBe(200000);
    } finally {
      await db.rendicion.deleteMany({ where: { id: { startsWith: P } } });
      await db.pago.deleteMany({ where: { contratoId: CNT2 } });
      await db.liquidacion.deleteMany({ where: { contratoId: CNT2 } });
      await db.eventoContrato.deleteMany({ where: { contratoId: CNT2 } });
      await db.propiedad.updateMany({ where: { id: PROP2 }, data: { contratoActualId: null } });
      await db.contrato.deleteMany({ where: { id: CNT2 } });
      await db.participacionPropietario.deleteMany({ where: { propiedadId: PROP2 } });
      await db.propiedad.deleteMany({ where: { id: PROP2 } });
      await db.$disconnect();
    }
  }, 180_000);
});
