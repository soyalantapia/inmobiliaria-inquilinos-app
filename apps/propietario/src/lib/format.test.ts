/**
 * T-46 (hallazgo al verificar) · Las fechas del portal se corrían un día para atrás.
 *
 * Se encontró recorriendo el portal ya buildeado: el dato decía que el alquiler vencía el
 * 2026-08-05 y la pantalla mostraba "vence el 4 de ago"; un pago del 2026-08-11 aparecía como
 * "pagó el 10". No era la demo: `portal-propietario.ts` manda esos campos como date-only
 * (`.toISOString().slice(0, 10)`), así que a un propietario REAL le pasaba lo mismo.
 *
 * La causa es de JS, no del portal: `new Date("2026-08-05")` se parsea como medianoche UTC, y
 * `toLocaleDateString` la muestra en hora local. En Argentina (UTC−3) eso es el día anterior a
 * las 21:00. Todo el país lo veía mal, y en una pantalla de plata la fecha de vencimiento es
 * justamente lo que se mira.
 *
 * ⚠️ Igual que `demo-data.test.ts`: hoy NO corre en CI, porque los fronts no tienen runner
 * (T-32). Los casos se verificaron a mano con node en el huso de esta máquina.
 */
import { describe, it, expect } from 'vitest';
import { cuit, etiqueta, fecha, money } from './format';

describe('T-46 · fecha() no corre los date-only al día anterior', () => {
  it('un vencimiento date-only se muestra en su propio día', () => {
    // El caso exacto que se vio mal en pantalla: vence el 5, decía 4.
    expect(fecha('2026-08-05')).toContain('5');
    expect(fecha('2026-08-05')).not.toContain('4 de');
  });

  it('un pago date-only tampoco se corre', () => {
    expect(fecha('2026-08-11')).toContain('11');
  });

  it('no se lleva puesto el mes en el día 1', () => {
    // El día 1 es el peor caso: corrido un día para atrás cambia de MES, y encima al mes que
    // el propietario no está mirando. Con UTC daba "31 de jul".
    const r = fecha('2026-08-01');
    expect(r).toContain('1');
    expect(r).toContain('ago');
    expect(r).not.toContain('jul');
  });

  it('ni el año en el 1 de enero', () => {
    const r = fecha('2026-01-01');
    expect(r).toContain('2026');
    expect(r).not.toContain('2025');
  });

  it('un timestamp completo se sigue mostrando en hora local, sin tocarlo', () => {
    // Este NO se arma local: tiene hora de verdad, así que el corrimiento al huso es correcto.
    // 13:20 UTC es media mañana en Argentina — mismo día.
    expect(fecha('2026-08-10T13:20:00.000Z')).toContain('10');
  });
});

describe('cuit', () => {
  it('le pone los guiones al CUIT que la API guarda sin separadores', () => {
    // El mismo dato en el panel se ve así. Que el dueño vea otra cosa era la razón del cambio.
    expect(cuit('20351234567')).toBe('20-35123456-7');
  });

  it('acepta uno que YA viene con guiones y no lo duplica', () => {
    expect(cuit('20-35123456-7')).toBe('20-35123456-7');
  });

  it('un valor raro se devuelve intacto: mejor crudo que inventado', () => {
    // Sin 11 dígitos no hay forma canónica. Partirlo igual mostraría un CUIT que no existe.
    expect(cuit('123')).toBe('123');
    expect(cuit('sin datos')).toBe('sin datos');
  });
})

describe('etiqueta', () => {
  it('EN_CURSO no puede salir con guión bajo: es un identificador de base', () => {
    // Es lo que motivó el helper. Se vio en el demo público, pero le pasaba igual a un
    // propietario real: la pantalla imprimía el enum con .toLowerCase() y nada más.
    expect(etiqueta('EN_CURSO')).toBe('en curso');
  });

  it('las categorías llevan tilde', () => {
    expect(etiqueta('PLOMERIA')).toBe('plomería');
    expect(etiqueta('CALEFACCION')).toBe('calefacción');
  });

  it('el depósito de garantía también', () => {
    expect(etiqueta('DEPOSITO')).toBe('depósito');
  });

  it('un valor que la API agregue mañana sale legible, no crudo ni vacío', () => {
    // El fallback importa: el portal no se redeploya cada vez que el back suma un estado.
    expect(etiqueta('ALGO_NUEVO_QUE_NO_EXISTE')).toBe('algo nuevo que no existe');
  });
})

describe('money — centavos', () => {
  it('con centavos van SIEMPRE los dos dígitos', () => {
    // Antes salía "$ 4.500,5", que en una pantalla de plata se lee como cinco centavos.
    expect(money(4500.5).replace(/\u00a0/g, ' ')).toBe('$ 4.500,50');
  });

  it('los enteros siguen sin decimales: es el 99% de los montos', () => {
    expect(money(480000).replace(/\u00a0/g, ' ')).toBe('$ 480.000');
  });

  it('el símbolo distingue pesos de dólares', () => {
    expect(money(900, 'USD')).toMatch(/US\$/);
  });
})
