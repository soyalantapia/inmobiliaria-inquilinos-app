/**
 * Ningún contacto ficticio del seed vive en un dominio que pueda existir.
 *
 * EL DEFECTO. Las bases sembradas —la de test, la local, la demo— traían gente inventada con
 * casillas **reales**: `carlos.mendez@gmail.com`, `roberto.mendez@yahoo.com.ar`,
 * `mariana.mendez@hotmail.com`, `marta.duarte@gmail.com` (una propietaria: el portal le manda el
 * OTP), dos profesionales en `.com.ar` que podrían estar registrados, y `rrhh@globant.com`, que
 * es el dominio de una empresa que existe de verdad.
 *
 * Nada de esto está publicado en internet: `exigirDbDeTest` hace fallar cerrado contra cualquier
 * host que no sea de prueba. El daño es el otro: alcanza con que alguien pruebe a mano un aviso
 * de reclamo, una invitación al portal o un anuncio de consorcio sobre una base sembrada para
 * que un mail nuestro le llegue a una persona ajena que no pidió nada.
 *
 * POR QUÉ UN TEST Y NO SÓLO EL ARREGLO. Porque el arreglo es un puñado de literales y el próximo
 * seed los vuelve a escribir sin darse cuenta —así entraron éstos—. Este archivo no mira
 * comportamiento: mira que los datos de contacto del seed vivan en dominios que la RFC 2606
 * reserva justamente para esto y que nadie puede registrar.
 *
 * NO NECESITA BASE: sólo lee archivos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PRISMA = join(import.meta.dirname, '..', 'prisma');

/** Los archivos que siembran datos. Si mañana hay otro `seeds/*.ts`, entra solo. */
function archivosDeSeed(): string[] {
  const sueltos = readdirSync(PRISMA)
    .filter((f) => f === 'seed.ts' || (f.startsWith('escenario-') && f.endsWith('.ts')))
    .map((f) => join(PRISMA, f));
  const dir = join(PRISMA, 'seeds');
  const enCarpeta = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(dir, f));
  return [...sueltos, ...enCarpeta];
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Los nombres que la RFC 2606 y la RFC 6761 reservan para documentación y pruebas: nadie los
 * puede registrar, así que un mail dirigido ahí no sale a ninguna parte.
 */
const RESERVADO = /(^|\.)(example\.(com|org|net)|invalid|test|localhost|example)$/;

/**
 * Direcciones en dominios NO reservados que se quedan, con su motivo. Agregar una es una
 * decisión: si aparece acá algo que puede recibir un mail de verdad, se está eligiendo el riesgo.
 */
const DECLARADAS: Record<string, string> = {
  'roberto@delsol.com':
    'credencial del seed (ADMIN). `@delsol.com` aparece 148 veces en 89 archivos entre tests, ' +
    'documentación y guías de arranque: renombrarla es una tarea aparte, y es una casilla de ' +
    'login que nadie usa como destino de un aviso al público',
  'luciana@delsol.com': 'ídem, credencial del seed (OPERADOR)',
  'camila@delsol.com': 'ídem, credencial del seed (CARGA)',
};

const encontradas = archivosDeSeed().flatMap((ruta) => {
  const rel = ruta.slice(PRISMA.length + 1).replace(/\\/g, '/');
  return [...new Set(readFileSync(ruta, 'utf8').match(EMAIL) ?? [])].map((mail) => ({ mail, rel }));
});

describe('el seed no le escribe a nadie de verdad', () => {
  it('el barrido encuentra direcciones: si no, el test no está midiendo nada', () => {
    // Sin esto, mover los seeds de carpeta dejaría la lista vacía y el archivo pasaría en verde
    // sin mirar un solo dato — que es la forma en que un guard deja de avisar.
    expect(encontradas.length).toBeGreaterThanOrEqual(15);
  });

  it('🔴 todas viven en un dominio reservado, o están declaradas con su motivo', () => {
    const peligrosas = encontradas
      .filter(({ mail }) => !RESERVADO.test((mail.split('@')[1] ?? '').toLowerCase()))
      .filter(({ mail }) => !(mail.toLowerCase() in DECLARADAS))
      .map(({ mail, rel }) => `${mail} (prisma/${rel})`);

    expect(
      peligrosas,
      'Estos contactos del seed viven en dominios que pueden existir. Alcanza con probar a mano ' +
        'un aviso sobre una base sembrada para que le llegue a una persona ajena. Usá ' +
        '`@example.com` (o un subdominio suyo), que la RFC 2606 reserva y nadie puede registrar.',
    ).toEqual([]);
  });

  it('las excepciones declaradas siguen existiendo: una lista con direcciones muertas miente', () => {
    const presentes = new Set(encontradas.map(({ mail }) => mail.toLowerCase()));
    const fantasmas = Object.keys(DECLARADAS).filter((m) => !presentes.has(m));
    expect(fantasmas, 'estas excepciones ya no corresponden a ninguna dirección del seed').toEqual([]);
  });
});
