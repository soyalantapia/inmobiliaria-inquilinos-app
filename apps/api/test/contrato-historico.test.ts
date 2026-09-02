/**
 * `crearContratoHistorico` — cargar la deuda de un inquilino QUE YA SE FUE.
 *
 * POR QUÉ IMPORTA. Es plata que aparece de la nada en la cartera, y es el pedido textual de la
 * clienta cero: cargar los morosos viejos sin inventarles un alquiler vigente. Tiene **dos
 * callers que no pueden divergir** —la carga de a uno desde la ficha de la propiedad, y la
 * importación masiva desde Excel—; si crearan cuotas distintas, son plata que alguien va a
 * reclamar.
 *
 * NO TIENE ARITMÉTICA QUE EXTRAER: es todo escritura. Pero sus invariantes son de **forma de
 * las filas que escribe**, y eso se puede verificar con un cliente de transacción falso, sin
 * base. Es el mismo instrumento que usa `devengo-aislamiento-fallos.test.ts`.
 *
 * Las tres que más duelen si se caen, y ninguna es teórica:
 *
 *  1. **El contrato nace FINALIZADO.** El devengo barre `estado: 'ACTIVO'`, así que las cuotas
 *     que se crean acá son las únicas que va a tener. Si naciera ACTIVO, a un moroso de hace
 *     tres años **le seguiría creciendo la deuda sola**, todos los meses, para siempre.
 *  2. **`Inquilino.email` queda en `null`, aunque venga uno.** Ese campo es la llave de login de
 *     la PWA y no filtra por estado del contrato: un email mal tipeado —lo carga un operador de
 *     memoria, o viene de una celda de Excel— **le abriría a un tercero la deuda de otra
 *     persona**. El email sí va a la `Persona`, que sirve para dedup y no habilita login.
 *  3. **No reclama la propiedad.** El moroso de hace tres años vivió donde hoy vive otro: tocar
 *     `contratoActualId` le rompería el contrato vigente al inquilino actual.
 */
import { describe, it, expect } from 'vitest';
import { crearContratoHistorico } from '../src/lib/contrato-historico.js';

const AUTOR = { userId: 'usr_1', rol: 'ADMIN' as const };

const BASE = {
  inmobiliariaId: 'inmo_1',
  propiedadId: 'prp_1',
  inquilino: { nombre: 'Juan', apellido: 'Pérez', dni: '30.111.222', email: 'juan@example.com' },
  monto: 400000,
  moneda: 'ARS' as const,
  fechaInicio: new Date('2023-01-01T00:00:00.000Z'),
  fechaFin: new Date('2023-06-30T00:00:00.000Z'),
  diaPago: 10,
  // Lo declara el fixture aunque el caso normal sea null: `correr()` tipa su override como
  // `Partial<typeof BASE>`, así que una clave que BASE no declara no se puede pasar. El test
  // de expensas la pasaba igual y funcionaba por el spread; sólo el tipo no lo sabía.
  montoExpensas: null as number | null,
};

/**
 * Cliente de transacción falso: registra lo que se le escribe para poder afirmar sobre ello.
 *
 * `escrito` guarda, por modelo, los `data` de cada create/update. Lo que NO aparezca ahí es
 * justamente lo que se quiere probar en el caso de la propiedad: que no se la toca.
 */
function txFalso() {
  const escrito: Record<string, unknown[]> = {};
  const anotar = (modelo: string, data: unknown) => {
    (escrito[modelo] ??= []).push(data);
    return { id: `${modelo}_id`, ...(data as object) };
  };

  const tx = {
    inquilino: {
      create: async ({ data }: { data: unknown }) => anotar('inquilino.create', data),
      update: async ({ data }: { data: unknown }) => anotar('inquilino.update', data),
    },
    contrato: {
      create: async ({ data }: { data: unknown }) => anotar('contrato.create', data),
      update: async ({ data }: { data: unknown }) => anotar('contrato.update', data),
    },
    propiedad: {
      update: async ({ data }: { data: unknown }) => anotar('propiedad.update', data),
    },
    persona: {
      findUnique: async () => null,
      findFirst: async () => null,
      findFirstOrThrow: async () => ({ id: 'per_reusada' }),
      create: async ({ data }: { data: unknown }) => anotar('persona.create', data),
      update: async ({ data }: { data: unknown }) => anotar('persona.update', data),
      upsert: async ({ create }: { create: unknown }) => anotar('persona.create', create),
    },
    eventoContrato: {
      create: async ({ data }: { data: unknown }) => anotar('eventoContrato.create', data),
    },
    // Lo que necesita generarLiquidacionesContrato.
    ajusteAlquiler: { findMany: async () => [] },
    renovacionContrato: { findMany: async () => [] },
    liquidacion: {
      createMany: async ({ data }: { data: unknown[] }) => {
        anotar('liquidacion.createMany', data);
        return { count: data.length };
      },
    },
  };

  return { tx, escrito };
}

const correr = (over: Partial<typeof BASE> = {}) => {
  const { tx, escrito } = txFalso();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any-justified: el tx falso implementa sólo los modelos que este camino toca.
  return crearContratoHistorico(tx as any, { ...BASE, ...over }, AUTOR, 'Rivadavia 100').then((r) => ({
    r,
    escrito,
    contrato: escrito['contrato.create']?.[0] as Record<string, unknown>,
    inquilino: escrito['inquilino.create']?.[0] as Record<string, unknown>,
    persona: escrito['persona.create']?.[0] as Record<string, unknown>,
  }));
};

describe('la deuda histórica no puede crecer sola', () => {
  it('el contrato nace FINALIZADO', async () => {
    // Si naciera ACTIVO, el cron le devengaría cuotas nuevas cada mes a un inquilino que se
    // fue hace tres años. La deuda cargada para registrar el pasado se convertiría en una
    // deuda que crece sola, para siempre.
    const { contrato } = await correr();
    expect(contrato.estado).toBe('FINALIZADO');
  });

  it('no queda pendiente de aprobación ni con ajuste programado', async () => {
    // Un contrato terminado no se ajusta. Un `proximoAjuste` con fecha lo metería en el
    // barrido de aumentos.
    const { contrato } = await correr();
    expect(contrato.pendienteAprobacion).toBe(false);
    expect(contrato.proximoAjuste).toBeNull();
    expect(contrato.indiceAjuste).toBe('FIJO');
  });

  it('deja las cuotas de la ventana de deuda', async () => {
    const { r } = await correr();
    expect(r.cuotas).toBeGreaterThan(0);
  });
});

describe('el email NO puede convertirse en llave de login', () => {
  it('el Inquilino se crea SIN email aunque venga uno', async () => {
    // `Inquilino.email` es la llave de login de la PWA y no filtra por estado del contrato.
    // Acá la fila la tipea un operador de memoria o sale de una celda de Excel: un email mal
    // tipeado le abre a un TERCERO la deuda de otra persona.
    const { inquilino } = await correr();
    expect(inquilino.email).toBeNull();
  });

  it('pero el email SÍ va a la Persona, que es donde sirve', async () => {
    // La Persona agrupa la identidad para dedup y para la ficha, y por sí sola no habilita
    // login. Tirar el email del todo perdería la deduplicación.
    const { persona } = await correr();
    expect(persona.email).toBe('juan@example.com');
  });

  it('el email se normaliza a minúsculas y sin espacios', async () => {
    const { persona } = await correr({
      inquilino: { ...BASE.inquilino, email: '  JUAN@Example.COM  ' },
    });
    expect(persona.email).toBe('juan@example.com');
  });

  it('sin email, la Persona queda con null y no con cadena vacía', async () => {
    const { persona } = await correr({ inquilino: { ...BASE.inquilino, email: '' } });
    expect(persona.email).toBeNull();
  });
});

describe('no le roba la propiedad al inquilino actual', () => {
  it('no toca la propiedad en absoluto', async () => {
    // El moroso de hace tres años vivió donde hoy vive otro. Tocar `contratoActualId` le
    // rompería el contrato vigente al inquilino de hoy — y es el caso NORMAL, no el borde.
    const { escrito } = await correr();
    expect(escrito['propiedad.update']).toBeUndefined();
  });

  it('el contrato creado no trae ningún campo que reclame la propiedad', async () => {
    const { contrato } = await correr();
    expect(contrato).not.toHaveProperty('contratoActualId');
    expect(contrato.propiedadId).toBe('prp_1');
  });
});

describe('el DNI se normaliza en los dos lugares', () => {
  it('guarda sólo dígitos, tanto en el Inquilino como en la Persona', async () => {
    // De `Inquilino.dni` sale la clave de dedup de deuda histórica. Si la carga de a uno
    // guardara "30.111.222" y la masiva "30111222", el aviso de "este DNI ya está en tu
    // cartera" no saltaría y se cargaría la misma deuda dos veces.
    const { inquilino, persona } = await correr();
    expect(inquilino.dni).toBe('30111222');
    expect(persona.dni).toBe('30111222');
  });

  it('un DNI vacío queda en null, no en cadena vacía', async () => {
    // La columna es opcional y su unique trata los NULL como distintos: así conviven muchas
    // personas sin documento. Un `''` sería un valor real y chocaría con el siguiente.
    const { inquilino } = await correr({ inquilino: { ...BASE.inquilino, dni: '' } });
    expect(inquilino.dni).toBeNull();
  });
});

describe('queda rastro de quién cargó la deuda', () => {
  it('escribe un evento en el historial del contrato', async () => {
    // Es plata que aparece de la nada en la cartera: tiene que ser rastreable.
    const { escrito } = await correr();
    const ev = escrito['eventoContrato.create']?.[0] as Record<string, unknown>;
    expect(ev).toBeTruthy();
    expect(ev.autor).toBe('usr_1');
    expect(String(ev.titulo)).toContain('Deuda histórica');
  });

  it('el contrato guarda quién y con qué rol lo cargó', async () => {
    const { contrato } = await correr();
    expect(contrato.cargadoPor).toBe('usr_1');
    expect(contrato.cargadoRol).toBe('ADMIN');
  });
});

describe('expensas', () => {
  it('sin expensas el tipo es ALQUILER', async () => {
    const { contrato } = await correr();
    expect(contrato.tipoContrato).toBe('ALQUILER');
    expect(contrato.montoExpensas).toBeNull();
  });

  it('con expensas el tipo es ALQUILER_Y_EXPENSAS', async () => {
    // El tipo se deriva del monto, no lo elige el caller: si divergieran, un contrato con
    // expensas cargadas no las devengaría.
    const { contrato } = await correr({ montoExpensas: 50000 });
    expect(contrato.tipoContrato).toBe('ALQUILER_Y_EXPENSAS');
    expect(contrato.montoExpensas).toBe(50000);
  });
});
