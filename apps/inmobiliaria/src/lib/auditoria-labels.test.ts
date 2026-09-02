/**
 * El rastro de auditoría tiene que leerse en castellano — TODO.
 *
 * POR QUÉ EXISTE. La pantalla rotula con `TIPO_LABEL[e.tipo] ?? e.tipo`, así que al tipo que
 * falta no se le rompe nada: se le imprime `MOVIMIENTO_CONSORCIO_ELIMINADO` al operador. Y como
 * no rompe, nadie se entera. Cuando escribí este test faltaban DOCE de los veinticuatro, entre
 * ellos los cuatro del conmutador de usuarios y la anulación de rendición — o sea, justo los que
 * el ADMIN viene a buscar a esta pantalla cuando algo no cierra.
 *
 * El test lee el enum del `schema.prisma` real, no una copia: el día que alguien agregue un
 * evento nuevo, esto se pone rojo antes de que llegue a producción sin rótulo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { TIPO_LABEL, TIPO_VARIANT } from './auditoria-labels';

/** Los valores del enum, sacados del schema (saltea comentarios y llaves). */
function tiposDelSchema(): string[] {
  const schema = readFileSync(join(__dirname, '../../../api/prisma/schema.prisma'), 'utf8');
  const bloque = /enum TipoEventoAuditoria \{([\s\S]*?)\n\}/.exec(schema);
  if (!bloque) throw new Error('No encontré `enum TipoEventoAuditoria` en schema.prisma');
  return bloque[1]!
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[A-Z][A-Z_]*$/.test(l));
}

describe('rótulos de auditoría', () => {
  it('el enum se lee y tiene los que conocemos', () => {
    // Si esto falla es que cambió la forma del schema y el test de abajo estaría midiendo aire.
    const tipos = tiposDelSchema();
    expect(tipos.length).toBeGreaterThanOrEqual(20);
    expect(tipos).toContain('PROPIETARIO_RENDICION_ANULADA');
    expect(tipos).toContain('PAGO_CONCILIADO');
  });

  it('TODO tipo de evento tiene rótulo en castellano', () => {
    const faltan = tiposDelSchema().filter((t) => !TIPO_LABEL[t]);
    expect(faltan).toEqual([]);
  });

  it('ningún rótulo quedó en SCREAMING_SNAKE', () => {
    // El error típico al agregar uno apurado: copiar la clave como valor. Se ve igual de mal
    // que no tenerlo, pero pasa el test de arriba.
    const crudos = Object.entries(TIPO_LABEL).filter(([, v]) => /^[A-Z][A-Z_]*$/.test(v));
    expect(crudos).toEqual([]);
  });

  it('no hay rótulos de más (tipos que el enum ya no tiene)', () => {
    // Un rótulo huérfano es un evento que se borró del enum y quedó acá: ruido que confunde al
    // que agrega el próximo.
    const tipos = new Set(tiposDelSchema());
    expect(Object.keys(TIPO_LABEL).filter((k) => !tipos.has(k))).toEqual([]);
  });

  it('los colores apuntan a tipos que existen', () => {
    const tipos = new Set(tiposDelSchema());
    expect(Object.keys(TIPO_VARIANT).filter((k) => !tipos.has(k))).toEqual([]);
  });

  it('anular una rendición se ve en rojo', () => {
    // Es el único evento que deshace plata que un tercero —el propietario— ya vio en su
    // portal. En gris, al lado de una rendición normal, se pierde.
    expect(TIPO_VARIANT.PROPIETARIO_RENDICION_ANULADA).toBe('destructive');
  });
});
