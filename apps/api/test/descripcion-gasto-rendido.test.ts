import { describe, it, expect } from 'vitest';
import { descripcionDeReparacion } from '../src/lib/descripcion-gasto-rendido.js';

// El rótulo del arreglo en la rendición viaja al propietario por dos superficies: el portal
// (`portal-propietario.ts`, select de `gastos`) y el PDF imprimible. Antes se armaba metiendo
// el texto libre del INQUILINO cuando el operador no había cargado notas, que es el caso por
// defecto porque el campo es opcional.
describe('descripcionDeReparacion — qué ve el dueño del arreglo que le cobran', () => {
  it('con notas del operador, gana la nota: es el campo escrito para mostrarse', () => {
    expect(descripcionDeReparacion('Cambio de flexible de cocina', 'PLOMERIA')).toBe(
      'Cambio de flexible de cocina',
    );
  });

  it('sin notas, sale la categoría — el dueño igual sabe qué se arregló', () => {
    expect(descripcionDeReparacion(null, 'PLOMERIA')).toBe('Reparación (plomeria)');
    expect(descripcionDeReparacion(undefined, 'ELECTRICIDAD')).toBe('Reparación (electricidad)');
  });

  it('EL PUNTO DE TODO ESTO: nunca sale el texto que escribió el inquilino', () => {
    // Lo que un inquilino escribe de verdad en un reclamo: su casa, su vida, su plata.
    const loQueEscribioElInquilino =
      'Hace 3 semanas que el baño pierde y el piso del vecino de abajo está manchado, ya avisé dos veces y nadie vino';

    // La firma no lo recibe: el texto del inquilino no llega a esta función. Ese es el fix.
    const rotulo = descripcionDeReparacion(null, 'PLOMERIA');

    expect(rotulo).toBe('Reparación (plomeria)');
    expect(rotulo).not.toContain('vecino');
    expect(rotulo).not.toContain('avisé');
    expect(loQueEscribioElInquilino).not.toContain(rotulo);
  });

  it('unas notas en blanco NO son notas: no dejan al dueño sin rótulo', () => {
    // El operador que abre el campo, no escribe nada y guarda. Antes ese '' caía al `||` y
    // se llevaba puesto el texto del inquilino; ahora cae a la categoría.
    expect(descripcionDeReparacion('', 'CERRADURA')).toBe('Reparación (cerradura)');
    expect(descripcionDeReparacion('   ', 'CERRADURA')).toBe('Reparación (cerradura)');
  });

  it('la categoría sale en minúscula, como venía saliendo', () => {
    // Tal cual está el enum: sin acento, porque así se llama el valor en la DB.
    expect(descripcionDeReparacion(null, 'CALEFACCION')).toBe('Reparación (calefaccion)');
    expect(descripcionDeReparacion(null, 'OTRO')).toBe('Reparación (otro)');
  });
});
