/**
 * Los guards de plata se deciden ADENTRO de la transacción, no con una foto de afuera.
 *
 * EL PATRÓN QUE ESTE ARCHIVO PERSIGUE. Cuatro handlers hacían lo mismo: leían la condición que
 * los habilita con el cliente `prisma` en autocommit, contestaban 409 si no daba, y recién
 * después abrían la transacción para escribir —con un `update`/`delete` por clave primaria
 * pelada, sin volver a preguntar—. Entre la foto y la escritura pasa toda la latencia del
 * handler, y en esa ventana la condición se puede volver falsa:
 *
 *   · `POST /pagos/:id/anular` mira "¿ya se rindió este período?" → la rendición se cuela en el
 *     medio y quedan `AlquilerRendido` sobre un pago que termina RECHAZADO. Al dueño se le
 *     transfirió alquiler de un mes que no se cobró, y no hay vuelta: reintentar anular da 409
 *     porque el pago ya está rechazado.
 *   · `POST /cargos/:id/descobrar` mira "¿este ingreso ya se rindió?" → borra el movimiento de
 *     caja que la rendición acaba de acreditarle al dueño, y deja el `IngresoRendido` huérfano.
 *   · `POST /contratos/:id/deposito/resolver` mira "¿el depósito sigue RETENIDO?" → dos
 *     operadores pasan los dos, y el mismo depósito se imputa DOS VECES contra la misma deuda.
 *   · `PUT /propiedades/:id/participaciones` mira "¿hay alquiler cobrado y sin rendir?" → el
 *     reparto cambia con plata en el aire y se le rinde al dueño equivocado.
 *
 * El repo ya tenía el arreglo escrito y comentado en `PATCH /contratos/:id/modo-cobranza`
 * (core.ts) y en `DELETE /caja/movimientos/:id` (plata.ts). Estos cuatro quedaron afuera.
 *
 * POR QUÉ ESTE TEST ES ESTRUCTURAL Y NO FUNCIONAL. Reproducir la carrera de verdad pide dos
 * requests entrelazados en el punto exacto, y un test así es flaky por construcción: pasa
 * cuando el scheduler lo acomoda. Lo que NO es flaky es la forma del código. Se afirma sobre el
 * texto de cada handler que la condición se pregunta con `tx` y que la escritura va
 * condicionada. Si alguien vuelve a sacar el guard afuera, esto se pone rojo.
 *
 * Es puro: lee los archivos, no abre ninguna base.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const plata = readFileSync(join(__dirname, '../src/routes/plata.ts'), 'utf8');
const core = readFileSync(join(__dirname, '../src/routes/core.ts'), 'utf8');

/**
 * El cuerpo de un handler, desde su `app.<metodo>('<ruta>'` hasta el siguiente `app.` de la
 * misma indentación. Sin esto los asserts miran el archivo entero y pasan por lo que hace el
 * vecino de al lado, que es exactamente el falso verde que estos tests vienen a evitar.
 */
function handler(fuente: string, ruta: string): string {
  const i = fuente.indexOf(`'${ruta}'`);
  expect(i, `no encontré el handler de ${ruta}`).toBeGreaterThan(-1);
  const desde = fuente.lastIndexOf('\n  app.', i);
  const siguiente = fuente.indexOf('\n  app.', i + 1);
  return fuente.slice(desde, siguiente === -1 ? fuente.length : siguiente);
}

/** El código sin comentarios: un comentario que menciona `tx` no protege de nada. */
function soloCodigo(bloque: string): string {
  return bloque
    .split('\n')
    .map((l) => {
      const t = l.trimStart();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
      return l;
    })
    .join('\n');
}

describe('anular un pago decide con el ledger leído adentro de la tx', () => {
  const h = soloCodigo(handler(plata, '/pagos/:id/anular'));

  it('la pregunta "¿ya se rindió?" usa tx, no prisma', () => {
    expect(h).toContain('tx.alquilerRendido.findFirst');
    // El que había: `await prisma.alquilerRendido.findFirst(` fuera de la transacción.
    expect(h).not.toContain('prisma.alquilerRendido.findFirst');
  });

  it('toma el MISMO advisory lock que la rendición, que es lo único que las serializa', () => {
    // No comparten ninguna fila escrita —anular toca pago/liquidacion/credito y la rendición
    // toca rendicion/alquilerRendido/gastoRendido—, así que ningún lock de fila las cruza.
    expect(h).toContain('pg_advisory_xact_lock');
    expect(h).toContain('hashtext');
  });

  it('el 409 de "ya rendido" sigue existiendo y se distingue del de la carrera', () => {
    expect(h).toContain('ya fue rendido al propietario');
    expect(h).toContain('ya no estaba conciliado');
  });
});

describe('descobrar un cargo borra el movimiento con deleteMany condicionado', () => {
  const h = soloCodigo(handler(plata, '/cargos/:id/descobrar'));

  it('cuenta el ledger de ingresos adentro de la tx', () => {
    expect(h).toContain('tx.ingresoRendido.count');
    expect(h).not.toContain('prisma.ingresoRendido.count');
  });

  it('el borrado va condicionado a descontadoEnRendicion: false, no por PK pelada', () => {
    // Es el candado atómico contra una rendición que tome el movimiento entre el chequeo y
    // el borrado. Con `delete({ where: { id } })` no había nada.
    expect(h).toContain('tx.movimientoCaja.deleteMany');
    expect(h).toContain('descontadoEnRendicion: false');
    expect(h).not.toMatch(/tx\.movimientoCaja\.delete\(\{/);
  });

  it('si el borrado no toma nada, se revierte TODO', () => {
    // Sin tirar, el `cargoContrato.update` ya hecho quedaría commiteado: el cargo volvería a
    // estar impago con la plata igual rendida al dueño.
    expect(h).toContain('MovimientoTomadoPorRendicion');
  });
});

describe('resolver el depósito toma el contrato con updateMany condicionado', () => {
  const h = soloCodigo(handler(plata, '/contratos/:id/deposito/resolver'));

  it('el candado es un updateMany sobre estadoDeposito RETENIDO', () => {
    expect(h).toContain('tx.contrato.updateMany');
    expect(h).toContain("estadoDeposito: 'RETENIDO'");
    // El que había: `tx.contrato.update({ where: { id } })`, sin condición.
    expect(h).not.toMatch(/tx\.contrato\.update\(\{/);
  });

  it('el candado va ANTES de imputar contra la deuda', () => {
    // Si imputara primero, el segundo operador aplicaría el depósito y recién después
    // descubriría que perdió — y ya habría saldado cuotas que nadie pagó.
    const iCandado = h.indexOf('tx.contrato.updateMany');
    const iImputa = h.indexOf('aplicarDepositoADeuda');
    expect(iCandado).toBeGreaterThan(-1);
    expect(iImputa).toBeGreaterThan(-1);
    expect(iCandado).toBeLessThan(iImputa);
  });
});

describe('cambiar el reparto revalida adentro y mira la plata en vuelo', () => {
  const h = soloCodigo(handler(core, '/propiedades/:id/participaciones'));

  it('revalida "cobrado y sin rendir" con tx', () => {
    expect(h).toContain('alquilerCobradoSinRendirDePropiedad(id, tx');
  });

  it('bloquea con pagos INFORMADOS, que el guard de cobrado no ve', () => {
    // Acá la ventana no son milisegundos: un comprobante puede esperar días a que alguien lo
    // mire, y validarlo después del cambio le rinde esa plata al dueño nuevo.
    expect(h).toContain("estado: 'INFORMADO'");
    expect(h).toContain('PAGOS_EN_VUELO');
  });

  it('el chequeo de en-vuelo también se repite adentro de la tx', () => {
    expect(h).toContain('tx.pago.count');
  });
});
