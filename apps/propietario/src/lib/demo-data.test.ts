/**
 * T-46 · Los datos de la demo del portal tienen que CERRAR.
 *
 * Por qué esto merece un test y no es paranoia: el portal del propietario es, entero, una
 * pantalla de plata. Si en la demo el total de una rendición no coincide con la suma de su
 * detalle, la persona a la que se le está mostrando el producto lo va a ver —es exactamente
 * lo que un propietario mira— y va a concluir, con razón, que el sistema no sabe sumar. Los
 * números de `demo-data.ts` están escritos a mano; esto los verifica.
 *
 * ⚠️ HOY ESTE ARCHIVO NO CORRE EN CI. No hay runner de tests para las apps de front: no hay
 * `vitest` ni config en `apps/propietario`, ni tarea `test` en `turbo.json`, y el único otro
 * test de front del repo (`apps/inquilino/src/lib/tipo-contrato.test.ts`) está igual de
 * huérfano. Montar ese runner es T-32 (`chore/T-32-runner-tests-fronts`), que está tomada por
 * otro chat; agregarle acá una config propia a esta app sería duplicarla y chocar al mergear.
 * Queda colocado, con la misma convención que el de inquilino, para entrar en verde el día
 * que T-32 aterrice. La aritmética de abajo se verificó a mano al escribirlo (ver el reporte
 * de la tarea), así que la afirmación no depende de que el runner exista.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CARTERA_DEMO,
  PROPIEDADES_DEMO,
  RECLAMOS_DEMO,
  RENDICIONES_DEMO,
  resolverDemo,
  resumenDeRendicion,
} from './demo-data';
import type { RendicionDetalle, RendicionPortal } from './api';

const suma = (ns: number[]): number => ns.reduce((a, b) => a + b, 0);

describe('T-46 · la aritmética de cada rendición cierra', () => {
  it.each(RENDICIONES_DEMO.map((r) => [r.periodo, r] as const))(
    '%s · teDepositamos = cobrado − comisión − gastos + otros ingresos',
    (_periodo, r) => {
      expect(r.teDepositamos).toBe(r.cobrado - r.comision - r.gastos + r.otrosIngresos);
    },
  );

  it.each(RENDICIONES_DEMO.map((r) => [r.periodo, r] as const))(
    '%s · la comisión es exactamente el porcentaje pactado sobre lo cobrado',
    (_periodo, r) => {
      expect(r.comision).toBe((r.cobrado * r.comisionPct) / 100);
    },
  );

  it.each(RENDICIONES_DEMO.map((r) => [r.periodo, r] as const))(
    '%s · el detalle suma los totales de la cabecera',
    (_periodo, r) => {
      expect(suma(r.detalleAlquileres.map((a) => a.monto))).toBe(r.cobrado);
      expect(suma(r.detalleGastos.map((g) => g.monto))).toBe(r.gastos);
      expect(suma(r.detalleIngresos.map((i) => i.monto))).toBe(r.otrosIngresos);
    },
  );

  it('todas usan la comisión que figura en la ficha del propietario', () => {
    for (const r of RENDICIONES_DEMO) expect(r.comisionPct).toBe(CARTERA_DEMO.comisionPct);
  });

  it('cada alquiler rendido sale de una unidad del propietario, con SU participación', () => {
    // Si esto se rompe, la demo le estaría mostrando a Silvana plata de un depto que no es
    // suyo, o el 100% de uno que tiene al 40% — el error más caro de un portal de copropiedad.
    const porDireccion = new Map(PROPIEDADES_DEMO.map((p) => [p.direccion, p]));
    for (const r of RENDICIONES_DEMO) {
      for (const a of r.detalleAlquileres) {
        const prop = porDireccion.get(a.direccion);
        expect(prop, `${a.direccion} no está entre las unidades del propietario`).toBeDefined();
        expect(a.participacionPct).toBe(prop!.participacionPct);
      }
    }
  });

  it('en el último período, lo rendido es el alquiler vigente por la participación', () => {
    // Se acota al período más nuevo a propósito: en mayo el alquiler de Gorriti todavía era
    // otro (ajustó por ICL el 1/6), así que exigir la igualdad en TODOS los períodos sería
    // exigir que la demo no tenga historia. Acá los dos mocks tienen que cerrar entre sí.
    const ultima = RENDICIONES_DEMO[0]!;
    expect(ultima.periodo).toBe('2026-07');
    const porDireccion = new Map(PROPIEDADES_DEMO.map((p) => [p.direccion, p]));
    for (const a of ultima.detalleAlquileres) {
      const contrato = porDireccion.get(a.direccion)!.contrato!;
      expect(a.monto).toBe((contrato.monto * a.participacionPct) / 100);
    }
  });
});

describe('T-46 · el costo de un reclamo no se cuenta dos veces', () => {
  it('el reclamo que paga el propietario aparece UNA sola vez, como gasto de la rendición', () => {
    // Regla de 05-DECISIONES.md: el propietario lo paga vía rendición y NO se le genera un
    // cargo aparte. La demo tiene que ilustrar la regla, no contradecirla.
    const delPropietario = RECLAMOS_DEMO.filter((r) => r.pagador === 'PROPIETARIO' && r.costo !== null);
    expect(delPropietario.length).toBeGreaterThan(0);

    for (const rec of delPropietario) {
      const apariciones = RENDICIONES_DEMO.flatMap((r) => r.detalleGastos).filter((g) => g.monto === rec.costo);
      expect(apariciones).toHaveLength(1);
      expect(apariciones[0]!.tipo).toBe('TRABAJO');
    }
  });
});

describe('T-46 · resolverDemo enruta como el server', () => {
  it('devuelve la cartera, las unidades y los reclamos', () => {
    expect(resolverDemo('/portal/mi-cartera')).toBe(CARTERA_DEMO);
    expect(resolverDemo('/portal/propiedades')).toBe(PROPIEDADES_DEMO);
    expect(resolverDemo('/portal/reclamos')).toBe(RECLAMOS_DEMO);
  });

  it('la lista de rendiciones trae el resumen, sin el detalle', () => {
    const lista = resolverDemo('/portal/rendiciones') as RendicionPortal[];
    expect(lista).toHaveLength(RENDICIONES_DEMO.length);
    // El endpoint real no manda el detalle en la lista: si acá se colara, la demo estaría
    // mostrando una forma de dato que en producción no existe.
    for (const r of lista) expect(r).not.toHaveProperty('detalleAlquileres');
  });

  it('el resumen conserva los mismos totales que el detalle del que sale', () => {
    for (const r of RENDICIONES_DEMO) {
      const resumen = resumenDeRendicion(r);
      expect(resumen.cobrado).toBe(r.cobrado);
      expect(resumen.teDepositamos).toBe(r.teDepositamos);
      expect(resumen.periodo).toBe(r.periodo);
    }
  });

  it('el detalle de una rendición se busca por id', () => {
    const primera = RENDICIONES_DEMO[0]!;
    const detalle = resolverDemo(`/portal/rendiciones/${primera.id}`) as RendicionDetalle;
    expect(detalle.id).toBe(primera.id);
    expect(detalle.detalleAlquileres.length).toBeGreaterThan(0);
  });

  it('una rendición que no existe tira, igual que el 404 del server', () => {
    expect(() => resolverDemo('/portal/rendiciones/ren_no_existe')).toThrow(/No encontramos/);
  });

  it('ignora la querystring al resolver la ruta', () => {
    expect(resolverDemo('/portal/reclamos?x=1')).toBe(RECLAMOS_DEMO);
  });

  it('una ruta que nadie mockeó TIRA en vez de devolver vacío', () => {
    // Devolver `[]` acá sería peor que romper: se leería como "no tenés nada rendido".
    expect(() => resolverDemo('/portal/lo-que-sea')).toThrow(/no tiene datos/);
  });
});

describe('T-46 · la demo NO se prende sola cuando falta el servidor', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it('sin bandera y sin API: sigue el camino honesto, no la demo', async () => {
    // ESTE es el invariante que protege la decisión original de `api.ts`. Una app de
    // producción a la que se le olvidó NEXT_PUBLIC_API_URL tiene que decir "no estoy
    // conectada", no inventarle rendiciones a un propietario de verdad.
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '');
    const { demoEnabled, apiEnabled } = await import('./api');
    expect(apiEnabled).toBe(false);
    expect(demoEnabled).toBe(false);
  });

  it('con bandera y sin API: demo prendida', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
    const { demoEnabled } = await import('./api');
    expect(demoEnabled).toBe(true);
  });

  it('con bandera Y con API: gana el API real', async () => {
    // Buildear el sitio estático apuntando a un servidor vivo no puede terminar en mocks.
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.myalquiler.com');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
    const { demoEnabled, apiEnabled } = await import('./api');
    expect(apiEnabled).toBe(true);
    expect(demoEnabled).toBe(false);
  });
});
