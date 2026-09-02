/**
 * GUARDARRAÍL: la matriz de permisos no puede prometer un PIN que el server no pide.
 *
 * QUÉ PASÓ. El PIN se eliminó de la plataforma por decisión de producto: `auth/pin.ts` conserva
 * la firma para no romper a sus callers, pero **siempre aprueba**. Sin embargo siete capacidades
 * de plata siguieron declarando `requierePin: true` —confirmar pago, rechazar pago, revertir
 * conciliación, aprobar contrato, rendir al propietario, devolver depósito, eliminar gasto de
 * caja— y la matriz de permisos del panel le pintaba un candado al admin, con la leyenda
 * *"piden el PIN del usuario"*.
 *
 * Era falso durante meses, y en la peor pantalla para serlo: la matriz de permisos es
 * exactamente donde alguien va a entender qué protege su sistema. Alguien ya lo había notado
 * —el docblock de `bloqueo-inactividad.tsx` dice que ese flag "es decorativo"— pero el icono
 * siguió ahí.
 *
 * QUÉ AFIRMA ESTE TEST, y por qué no es "prohibir el PIN". No prohíbe nada: exige **coherencia
 * entre las dos mitades**. Si mañana el producto decide volver a pedir PIN, este test falla
 * hasta que el server lo verifique de verdad — que es justo el orden correcto, porque una
 * promesa de seguridad sin backend es peor que no tenerla.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAPACIDADES } from '@llave/shared/permisos';
import { verificarPinUsuario } from '../src/auth/pin.js';

/** El server, ¿verifica el PIN de verdad, o es el stub que aprueba todo? */
function elServerVerificaElPin(): boolean {
  const src = readFileSync(join(import.meta.dirname, '..', 'src', 'auth', 'pin.ts'), 'utf8');
  // El stub no compara nada: ni bcrypt, ni la columna del PIN, ni intentos fallidos.
  return /bcrypt|pinHash|compare\(/.test(src);
}

describe('el PIN: lo que promete la matriz y lo que hace el server', () => {
  it('ninguna capacidad promete PIN mientras el server apruebe todo', () => {
    const prometen = CAPACIDADES.filter((c) => c.requierePin).map((c) => c.key);

    if (elServerVerificaElPin()) {
      // El producto lo volvió a habilitar y el server lo verifica: acá no hay nada que objetar.
      return;
    }

    expect(
      prometen,
      `Estas capacidades declaran requierePin: true, pero \`auth/pin.ts\` aprueba SIEMPRE:\n` +
        `  ${prometen.join('\n  ')}\n\n` +
        'La matriz de permisos del panel lo pinta como un candado y le dice al admin que esa\n' +
        'acción pide el PIN del usuario. Si es falso, es una promesa de seguridad sobre plata\n' +
        '(rendir al propietario, revertir una conciliación) que no existe.\n\n' +
        'Si querés volver a pedir PIN: cableá primero `verificarPinUsuario` para que verifique\n' +
        'de verdad, y recién después declarrálo acá. En ese orden.',
    ).toEqual([]);
  });

  it('el stub aprueba incluso sin PIN, que es lo que lo vuelve una promesa vacía', async () => {
    // Se fija el comportamiento REAL de hoy, sin maquillarlo: no sólo aprueba cualquier PIN —
    // aprueba tambien cuando no viene ninguno. Los handlers lo reciben como `pin?: string`.
    if (elServerVerificaElPin()) return;
    expect(await verificarPinUsuario('usr_1', undefined)).toEqual({ ok: true });
    expect(await verificarPinUsuario('usr_1', 'cualquier-cosa')).toEqual({ ok: true });
  });

  it('las capacidades de plata siguen protegidas por ROL, que es el límite real', () => {
    // El PIN se fue, pero la autorización no: cada una de las que tenían candado sigue acotada
    // a ADMIN (o ADMIN+CAJA), y eso el server SÍ lo resuelve contra la base en cada request.
    const sensibles = ['pago.revertir', 'rendicion.confirmar', 'deposito.devolver', 'caja.eliminar'];
    for (const key of sensibles) {
      const cap = CAPACIDADES.find((c) => c.key === key);
      expect(cap, `falta la capacidad ${key}`).toBeTruthy();
      expect(cap!.roles, `${key} dejó de ser exclusiva de ADMIN`).toEqual(['ADMIN']);
    }
  });
});
