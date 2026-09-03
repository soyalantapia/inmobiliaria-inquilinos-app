/**
 * T-01-N1-N7 · Al dueño que hay que sacar del portal, la pantalla no le ofrecía nada.
 *
 * `PATCH /propietarios/:id/activo` estaba construido, autenticado, con su 409 de cobranza directa
 * y con `requirePropietario` revalidando `activo` en cada request. **Ningún archivo del panel lo
 * llamaba.** Y el único botón destructivo de la ficha, «Eliminar», sale sólo cuando el
 * propietario NO tiene propiedades — el backend además exige que no tenga contratos ni
 * rendiciones. O sea que la ficha ofrecía una acción justo para el caso que no importa (limpiar
 * un alta duplicada) y ninguna para el que sí: el dueño que vendió su departamento.
 *
 * Importa desde que el portal del propietario está en producción: la baja lógica es lo que le
 * corta el acceso a un ex-dueño. Hasta ahora la única forma era borrarle el email a mano.
 */
import { describe, it, expect } from 'vitest';
import { accionDePropietario, textoDeBaja } from './acciones-de-propietario';

describe('qué acción ofrece la ficha de un propietario', () => {
  it('🔴 un dueño CON propiedades puede darse de baja', () => {
    // Éste es el caso entero. Antes devolvía nada: no había botón, y el acceso al portal seguía
    // vivo hasta que alguien le borrara el email a mano.
    expect(accionDePropietario({ propiedades: 3, activo: true })).toBe('DAR_DE_BAJA');
  });

  it('uno SIN propiedades se elimina, que es limpiar un alta duplicada', () => {
    expect(accionDePropietario({ propiedades: 0, activo: true })).toBe('ELIMINAR');
  });

  it('🔴 uno ya dado de baja ofrece REACTIVAR, aunque no tenga propiedades', () => {
    // El orden de las guardas importa: si `propiedades === 0` se evaluara primero, a un dado de
    // baja sin propiedades la ficha le ofrecería ELIMINAR — o sea, borrar la fila y el historial
    // de alguien a quien sólo se quiso desactivar. La acción suave y la destructiva se
    // intercambian en silencio.
    expect(accionDePropietario({ propiedades: 0, activo: false })).toBe('REACTIVAR');
    expect(accionDePropietario({ propiedades: 5, activo: false })).toBe('REACTIVAR');
  });

  it('sin el campo `activo` (la demo) se trata como activo', () => {
    expect(accionDePropietario({ propiedades: 2 })).toBe('DAR_DE_BAJA');
    expect(accionDePropietario({ propiedades: 0 })).toBe('ELIMINAR');
  });

  it('CONTROL POSITIVO — nunca devuelve dos acciones: es una sola', () => {
    // No es una perogrullada sobre el tipo: la pantalla anterior tenía la condición suelta en el
    // JSX, y agregar la baja ahí era la forma natural de terminar con «Eliminar» y «Dar de baja»
    // uno al lado del otro. Dos palabras parecidas, consecuencias muy distintas, y la que suena
    // más suave es la que borra la fila.
    const casos = [
      { propiedades: 0, activo: true },
      { propiedades: 4, activo: true },
      { propiedades: 0, activo: false },
    ];
    for (const c of casos) {
      const a = accionDePropietario(c);
      expect(typeof a === 'string' && a.length > 0).toBe(true);
    }
  });
});

describe('el texto del diálogo dice qué pasa y qué NO pasa', () => {
  it('🔴 la baja promete que el historial queda intacto', () => {
    const t = textoDeBaja('Ana Gómez', true);
    expect(t.titulo).toContain('Ana Gómez');
    // Las dos mitades. Sin la primera, quien lo lee no sabe si además le borra las rendiciones;
    // sin la segunda, no sabe si el corte es ahora o cuando venza el token.
    expect(t.descripcion).toMatch(/historial/i);
    expect(t.descripcion).toMatch(/en el momento|inmediat/i);
    expect(t.boton).toBe('Dar de baja');
  });

  it('la reactivación no repite el texto de la baja', () => {
    const t = textoDeBaja('Ana Gómez', false);
    expect(t.boton).toBe('Reactivar');
    expect(t.descripcion).not.toMatch(/pierde/i);
  });
});
