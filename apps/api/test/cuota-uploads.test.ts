/**
 * T-23-N4-N1-N1 · La cuota de disco por inmobiliaria.
 *
 * QUÉ PROTEGE. `POST /uploads` acepta cualquier token autenticado y escribe en el Volume de
 * Railway, que es **uno solo y compartido entre todos los tenants**. Había tope por archivo
 * (10 MB) y tipos restringidos, pero nada que limitara la acumulación. El token de un
 * inquilino dura 15 días —sigue sirviendo con el contrato terminado—, así que alguien podía
 * llenar el disco y dejar sin subir a TODAS las inmobiliarias. El handler ya tenía escrito el
 * final: un 507 "el servidor se quedó sin espacio".
 *
 * Test puro: sólo toca un directorio temporal, no hay base de por medio.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  bytesDeDirectorio,
  cuotaBytes,
  registrarSubida,
  usoDelTenant,
  _limpiarCacheCuota,
} from '../src/lib/cuota-uploads.js';

const MB = 1024 * 1024;
let base: string;

beforeEach(async () => {
  _limpiarCacheCuota();
  base = await mkdtemp(path.join(os.tmpdir(), 'cuota-test-'));
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

async function archivo(tenant: string, nombre: string, bytes: number): Promise<void> {
  const dir = path.join(base, tenant);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, nombre), Buffer.alloc(bytes));
}

describe('cuotaBytes', () => {
  it('sin configurar, 2 GB', () => {
    expect(cuotaBytes({})).toBe(2048 * MB);
  });

  it('se puede subir o bajar por env', () => {
    expect(cuotaBytes({ UPLOADS_CUOTA_MB: '100' })).toBe(100 * MB);
  });

  it('un valor inválido NO apaga la cuota: cae al default', () => {
    // Es el punto entero de la función. Si un typo en una env var desactivara el límite, el
    // agujero volvería sin que nadie se entere — que es el modo de falla que esto viene a
    // cerrar, no uno nuevo que valga la pena introducir.
    expect(cuotaBytes({ UPLOADS_CUOTA_MB: 'dos gigas' })).toBe(2048 * MB);
    expect(cuotaBytes({ UPLOADS_CUOTA_MB: '' })).toBe(2048 * MB);
    expect(cuotaBytes({ UPLOADS_CUOTA_MB: '-5' })).toBe(2048 * MB);
  });

  it('pero con 0 explícito se apaga, que es distinto de un typo', () => {
    expect(cuotaBytes({ UPLOADS_CUOTA_MB: '0' })).toBe(0);
  });
});

describe('bytesDeDirectorio', () => {
  it('un directorio que no existe es 0, no un error', async () => {
    // El directorio del tenant se crea recién en su primer upload.
    expect(await bytesDeDirectorio(path.join(base, 'inm_nueva'))).toBe(0);
  });

  it('suma lo que hay adentro', async () => {
    await archivo('inm_1', 'a.jpg', 1000);
    await archivo('inm_1', 'b.pdf', 2500);
    expect(await bytesDeDirectorio(path.join(base, 'inm_1'))).toBe(3500);
  });

  it('no cuenta subdirectorios como si fueran archivos', async () => {
    await archivo('inm_1', 'a.jpg', 1000);
    await mkdir(path.join(base, 'inm_1', 'raro'), { recursive: true });
    expect(await bytesDeDirectorio(path.join(base, 'inm_1'))).toBe(1000);
  });
});

describe('usoDelTenant · el cache', () => {
  it('cada inmobiliaria cuenta la suya, no la del vecino', async () => {
    // Lo importante del scoping: el Volume es compartido, pero el tope no puede serlo — si
    // no, una cartera grande y legítima dejaría sin subir a todas las demás.
    await archivo('inm_1', 'a.jpg', 5000);
    await archivo('inm_2', 'b.jpg', 100);
    expect(await usoDelTenant(base, 'inm_1')).toBe(5000);
    expect(await usoDelTenant(base, 'inm_2')).toBe(100);
  });

  it('dentro del TTL no vuelve a recorrer el disco', async () => {
    await archivo('inm_1', 'a.jpg', 1000);
    expect(await usoDelTenant(base, 'inm_1')).toBe(1000);
    // Se agrega un archivo POR FUERA: el cache no tiene por qué verlo todavía.
    await archivo('inm_1', 'b.jpg', 9999);
    expect(await usoDelTenant(base, 'inm_1')).toBe(1000);
  });

  it('pasado el TTL sí recalcula', async () => {
    await archivo('inm_1', 'a.jpg', 1000);
    const t0 = 1_000_000;
    expect(await usoDelTenant(base, 'inm_1', t0)).toBe(1000);
    await archivo('inm_1', 'b.jpg', 500);
    expect(await usoDelTenant(base, 'inm_1', t0 + 6 * 60 * 1000)).toBe(1500);
  });

  it('registrarSubida suma sin recorrer el directorio', async () => {
    await archivo('inm_1', 'a.jpg', 1000);
    expect(await usoDelTenant(base, 'inm_1')).toBe(1000);
    registrarSubida('inm_1', 400);
    expect(await usoDelTenant(base, 'inm_1')).toBe(1400);
  });

  it('registrarSubida sobre un tenant no medido todavía no inventa un total', async () => {
    // Sin haber medido, sumar a ciegas daría un número que no representa nada. La próxima
    // medición real es la que manda.
    registrarSubida('inm_sin_medir', 999);
    await archivo('inm_sin_medir', 'a.jpg', 20);
    expect(await usoDelTenant(base, 'inm_sin_medir')).toBe(20);
  });
});

describe('la decisión de bloquear', () => {
  it('bloquea recién cuando lo usado llega a la cuota', async () => {
    const cuota = cuotaBytes({ UPLOADS_CUOTA_MB: '1' });
    await archivo('inm_1', 'grande.pdf', 1 * MB);
    expect(await usoDelTenant(base, 'inm_1')).toBeGreaterThanOrEqual(cuota);
  });

  it('con la cuota apagada (0) el handler ni siquiera pregunta', () => {
    // El `if (cuota > 0)` de uploads.ts: con 0 no se mide nada y no se bloquea nada.
    expect(cuotaBytes({ UPLOADS_CUOTA_MB: '0' })).toBe(0);
  });
});
