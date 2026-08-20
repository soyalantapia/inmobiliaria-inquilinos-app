/**
 * El comprobante que el dueño recibe por WhatsApp.
 *
 * Es LO ÚNICO que recibe: los mails a propietarios van sin CTA. Si acá un monto en dólares sale
 * con signo de pesos, el dueño lee mil veces menos plata de la que le van a depositar y llama —o
 * peor, no llama y da por hecho que le pagaron mal.
 *
 * `mensajeRendicion` ya toma la moneda de la rendición, con un fallback a la del mes en curso
 * para las filas del modo demo. El agujero estaba UN NIVEL MÁS ARRIBA: los dos armadores de esa
 * `Rendicion` —el mapper del listado y el efímero de después de rendir— tiraban el campo
 * `moneda`, así que en producción el fallback se usaba SIEMPRE. Estos tests fijan la función
 * para que el arreglo de los dos armadores no se pueda deshacer sin ponerse rojo.
 */
import { describe, it, expect } from 'vitest';
import { mensajeRendicion } from './rendir-propietario-dialog';
import type { Propietario, Rendicion } from '@/lib/types';

const duenio = (extra: Partial<Propietario> = {}): Propietario =>
  ({
    id: 'own_x',
    nombre: 'Martín Ariel',
    apellido: 'Bravo',
    cuit: '20-56789012-6',
    email: 'martin@ejemplo.com',
    telefono: '1100000000',
    cbuAlias: 'bravo.martin.usd',
    comisionPct: 8,
    notas: null,
    createdAt: '',
    propiedadesIds: [],
    totalCobradoMes: 0,
    totalRecibirMes: 0,
    ...extra,
  }) as Propietario;

const rendicion = (extra: Partial<Rendicion> = {}): Rendicion =>
  ({
    id: 'r1',
    propietarioId: 'own_x',
    periodo: '2026-07',
    montoBruto: 1200,
    comisionPct: 8,
    totalGastos: 0,
    montoNeto: 1104,
    rendidoAt: '2026-08-05T12:00:00.000Z',
    metodo: 'TRANSFERENCIA',
    notas: null,
    ...extra,
  }) as Rendicion;

describe('mensajeRendicion — la moneda', () => {
  it('una rendición en DÓLARES se escribe en dólares, no en pesos', () => {
    // El bug: "US$ 1.104" salía "$ 1.104". En Argentina eso se lee mil ciento cuatro pesos.
    const msg = mensajeRendicion(duenio(), rendicion({ moneda: 'USD' }));
    expect(msg).toContain('US$');
    // Y ni una sola cifra con signo de pesos suelto: si quedara una, el mensaje mezclaría.
    expect(msg).not.toMatch(/(^|[^S])\$\s?1\.?[12]/);
  });

  it('manda la moneda de LA RENDICIÓN, no la del contrato de hoy', () => {
    // Una rendición vieja en dólares de un dueño que ahora factura en pesos. `monedaMensual`
    // es el contrato de HOY y no tiene nada que ver con lo que se le depositó aquel mes.
    const msg = mensajeRendicion(duenio({ monedaMensual: 'ARS' }), rendicion({ moneda: 'USD' }));
    expect(msg).toContain('US$');
  });

  it('sin moneda en la rendición (fila del demo) cae a la del mes en curso', () => {
    // El fallback existe para el modo demo, cuyas filas no tienen `moneda`. En producción los
    // dos armadores de la Rendicion ahora la pasan, así que no tendría que usarse nunca.
    const msg = mensajeRendicion(duenio({ monedaMensual: 'USD' }), rendicion({ moneda: undefined }));
    expect(msg).toContain('US$');
  });

  it('todas las líneas del comprobante van en la MISMA moneda', () => {
    // Bruto, comisión, gastos, ingresos y el "a transferirte". Una sola línea en otra moneda
    // alcanza para que la cuenta no cierre y el dueño desconfíe del total.
    const msg = mensajeRendicion(
      duenio(),
      rendicion({ moneda: 'USD', totalGastos: 100, totalIngresos: 50, montoNeto: 1054 }),
    );
    const montos = msg.match(/(US\$|\$)\s?[\d.,]+/g) ?? [];
    expect(montos.length).toBeGreaterThanOrEqual(5);
    expect(montos.every((m) => m.startsWith('US$'))).toBe(true);
  });

  it('en pesos sigue diciendo pesos', () => {
    // No-regresión del caso normal, que es el 95% de las rendiciones.
    const msg = mensajeRendicion(duenio(), rendicion({ moneda: 'ARS', montoBruto: 600000, montoNeto: 552000 }));
    expect(msg).not.toContain('US$');
    expect(msg).toContain('$');
  });
});
