/**
 * T-37-N2 · La matriz de permisos no puede prometer circuitos que no existen.
 *
 * QUÉ PASÓ. Esta matriz es la pantalla donde la administradora reparte roles
 * (`components/matriz-permisos-card.tsx`, Configuración → Equipo). Dos veces prometió
 * comportamiento que el sistema no tenía:
 *
 *  1. `pago.manual.cargar` figuraba con `rolesAprobacion: ['OPERADOR']`, o sea que la fila le
 *     mostraba a la administradora un badge "pendiente" en la columna OPERADOR. Ese circuito
 *     NUNCA se construyó: `POST /pagos/manual` exigía `pago.conciliar`, así que el operador se
 *     comía un 403. Ella asignaba ese rol al que cobra en el mostrador creyendo que había una
 *     red atrás. Lo sacó T-37.
 *  2. El rótulo del grupo decía "Carga · qué puede cargar (queda pendiente si no es Admin)"
 *     encima de CINCO filas, y era cierto en UNA. Lo saca esta tarea.
 *
 * QUÉ FIJA ESTE TEST. Que `rolesAprobacion` —lo único que pinta el badge "pendiente"— sólo esté
 * puesto donde hay un circuito de verdad. Hoy hay uno solo, el de contratos
 * (`contratoQuedaPendiente`, que llama el alta en `core.ts`). Si mañana alguien se lo agrega a
 * otra capacidad sin construir el circuito, la matriz vuelve a mentir en la misma pantalla y por
 * la misma razón — y esto se pone rojo.
 *
 * Si el circuito SÍ se construye (es T-37-N1, que necesita una decisión de producto), lo que hay
 * que hacer es agregar la capacidad a `CON_CIRCUITO` en el mismo commit que lo construye.
 */
import { describe, it, expect } from 'vitest';
import { CAPACIDADES, GRUPO_LABEL, ROL_DESCRIPCION, type Capacidad } from './permisos';

/** Las capacidades cuyo "queda pendiente" existe de verdad en el backend. */
const CON_CIRCUITO: Capacidad[] = ['contratos.crear'];

describe('T-37-N2 · la matriz no promete lo que no hay', () => {
  it('sólo las capacidades con circuito real declaran rolesAprobacion', () => {
    const conBadge = CAPACIDADES.filter((c) => (c.rolesAprobacion?.length ?? 0) > 0).map((c) => c.key);
    expect(conBadge.sort()).toEqual([...CON_CIRCUITO].sort());
  });

  it('el rótulo del grupo "carga" no generaliza el pendiente a todas sus filas', () => {
    // El dato correcto ya lo da cada fila con su badge; el encabezado no tiene que repetirlo
    // —y menos para las cuatro donde no aplica—.
    expect(GRUPO_LABEL.carga).not.toMatch(/pendiente/i);
  });

  it('ningún rótulo de grupo promete PIN, que no existe desde el 05/07', () => {
    // Mismo defecto, ya corregido antes en el grupo "sensible": el PIN se eliminó de toda la
    // plataforma y `verificarPinUsuario` aprueba siempre. Lo que protege esas acciones es el rol.
    for (const [grupo, label] of Object.entries(GRUPO_LABEL)) {
      expect(label, `el grupo "${grupo}" promete un PIN que no se pide`).not.toMatch(/\bPIN\b/i);
    }
  });

  it('la descripción de CARGA dice QUÉ queda pendiente, no "lo que carga"', () => {
    // Se lee en `equipo-card.tsx`, en el momento de elegirle el rol a una persona. Decía "Lo
    // que carga queda pendiente de aprobación" y de las tres cosas que carga vale para una:
    // propiedades y propietarios se guardan directo. Generalizarlo infla la red de seguridad
    // que la administradora cree tener cuando reparte el rol.
    expect(ROL_DESCRIPCION.CARGA).toMatch(/contratos que carga quedan pendientes/i);
    expect(ROL_DESCRIPCION.CARGA).not.toMatch(/lo que carga queda pendiente/i);
  });

  it('toda capacidad con rolesAprobacion los declara entre los roles que la tienen', () => {
    // Un rol que "queda pendiente" pero no figura en `roles` no vería la fila habilitada: el
    // badge quedaría en una columna que ni siquiera puede hacer la acción.
    for (const c of CAPACIDADES) {
      for (const rol of c.rolesAprobacion ?? []) {
        expect(c.roles, `${c.key}: ${rol} aprueba pero no tiene la capacidad`).toContain(rol);
      }
    }
  });
});
