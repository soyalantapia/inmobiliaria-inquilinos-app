/**
 * CUARTA AUDITORÍA · El aviso de boleta mostraba la más vieja, para siempre.
 *
 * El banner de la pantalla de Servicios elegía con `filter(dias <= 7)` + `sort` ascendente +
 * `[0]`. Ascendente por días quiere decir que el primero es el MÁS NEGATIVO: con una boleta
 * vencida hace 120 días y otra que vence en 3, avisaba la de hace 120. Y sin piso en el filtro,
 * esa boleta se quedaba ahí contando días para arriba — en enero seguía diciendo "vence hace 120
 * días".
 *
 * Es la única alerta de la pantalla, y estaba ocupada por la boleta menos accionable, tapando la
 * que vence esta semana. Encima el inquilino **no puede marcarla como paga en producción** (no
 * hay endpoint), así que no tenía ninguna forma de sacarla.
 */
import { describe, it, expect } from 'vitest';
import { boletaAAvisar, VENTANA_VENCIDA_DIAS } from './aviso-de-boleta';

/** Cada boleta se representa por sus días hasta el vencimiento: es lo único que decide. */
const avisar = (dias: number[]) => boletaAAvisar(dias, (d) => d);

describe('cuál boleta se avisa', () => {
  it('🔴 no tapa la que vence en 3 días con una vencida hace 120', () => {
    // Con el bug: devolvía -120.
    expect(avisar([-120, 3])?.dias).toBe(3);
  });

  it('🔴 una boleta vencida hace mucho deja de avisar', () => {
    expect(avisar([-120])).toBeNull();
    expect(avisar([-(VENTANA_VENCIDA_DIAS + 1)])).toBeNull();
  });

  it('una vencida RECIENTE gana: es la más urgente y todavía se puede hacer algo', () => {
    expect(avisar([-3, 5])?.dias).toBe(-3);
  });

  it('entre varias vencidas recientes, la más cercana a hoy', () => {
    // "Venció hace 2 días" es accionable; "hace 28" ya casi no.
    expect(avisar([-28, -2, -15])?.dias).toBe(-2);
  });

  it('el borde de la ventana entra; un día más, no', () => {
    expect(avisar([-VENTANA_VENCIDA_DIAS])?.dias).toBe(-VENTANA_VENCIDA_DIAS);
    expect(avisar([-VENTANA_VENCIDA_DIAS - 1])).toBeNull();
  });

  it('sin vencidas, la más próxima dentro de los 7 días', () => {
    expect(avisar([6, 2, 4])?.dias).toBe(2);
    expect(avisar([0])?.dias).toBe(0); // vence hoy
  });

  it('lo que vence más allá del anticipo no se avisa todavía', () => {
    expect(avisar([8])).toBeNull();
    expect(avisar([30, 45])).toBeNull();
  });

  it('sin boletas sin pagar no hay aviso', () => {
    expect(avisar([])).toBeNull();
  });

  it('devuelve la boleta, no sólo el número', () => {
    const boletas = [{ id: 'luz', v: -2 }, { id: 'gas', v: 4 }];
    expect(boletaAAvisar(boletas, (b) => b.v)?.b.id).toBe('luz');
  });
});
