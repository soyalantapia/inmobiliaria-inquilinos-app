/**
 * Los datos de mentira no pueden apuntar a casillas de verdad.
 *
 * LA REGLA YA ESTABA ESCRITA en el repo, en `apps/inmobiliaria/src/lib/migracion-masiva.ts`:
 *
 * > «`example.com` está reservado por la RFC 2606 justamente para esto. Con `@gmail.com` un
 * > nombre argentino común genera una casilla que EXISTE y es de otra persona — y esta demo
 * > está publicada.»
 *
 * Lo que faltaba era que la cumpliera todo el resto. `referidos-storage.ts`, que se publica en
 * GitHub Pages, mostraba cuatro colegas inventados con dominios de inmobiliaria plausibles, y
 * el legajo de screening del panel le atribuía a una empresa REAL un CUIT, una deuda BCRA de
 * $145.000.000 y un LinkedIn «verificado» de alguien que no existe.
 *
 * POR QUÉ IMPORTA MÁS QUE LA ESTÉTICA. El sistema MANDA MAILS: rendiciones al propietario,
 * códigos de acceso al portal, avisos al inquilino. Un dato de demo que se cuela en un
 * ambiente con SMTP vivo le escribe a un desconocido, y del otro lado eso no se ve como una
 * demo: se ve como una inmobiliaria mandándole la liquidación de un departamento ajeno.
 *
 * POR QUÉ ES UN TEST Y NO UN `sed`. Porque el `sed` lo arregla hoy y el próximo dato de demo
 * lo rompe de nuevo, sin que nadie se entere. Esto falla en el momento en que alguien vuelve
 * a escribir una dirección de una casilla que puede existir.
 *
 * LO QUE ESTE CONTROL NO CUBRE, A PROPÓSITO: el dominio de la inmobiliaria ficticia del seed
 * (`delsol.com`), que es su identidad y aparece en 81 archivos —incluidos los logins de casi
 * todos los tests—. Cambiarlo es otra tarea, y está anotada.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Dominios que no pueden llegarle a nadie: los reservados por la RFC 2606 y 6761, más los
 * ficticios del propio producto (`.demo` no es un TLD delegado; `delsol` es la inmo del seed).
 */
const RESERVADOS =
  /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net)|test|invalid|localhost|demo|delsol\.com(?:\.ar)?|inquilino\.demo|deenex\.tech|sentry\.io|myalquiler\.(?:app|com))$/i;

/** Direcciones que son el SUJETO de un test o de un texto, no un dato de demo. */
const EXCEPCIONES = new Set([
  // `normalizar-email.test.ts` prueba justamente la regla de los puntos de Gmail: cambiarle
  // el dominio le saca el sentido al caso.
  'juan.perez@gmail.com',
  'j.u.a.n@gmail.com',
  'juan+alquileres@gmail.com',
  'Juan.Perez@Gmail.com',
  // Ejemplo dentro de un placeholder de formulario.
  'vos@correo.com',
]);

const RAIZ = join(import.meta.dirname, '..', '..', '..');
/**
 * El SEED lo cubre `el-seed-no-le-escribe-a-nadie-de-verdad.test.ts`, que llegó a main el mismo
 * día por otra mano. No se repite acá: dos barridos sobre los mismos archivos es una copia que
 * se va a desincronizar. Éste mira lo que aquél no ve —los datos de demo de los tres fronts,
 * que son los que se PUBLICAN— y el código de la API.
 *
 * Tampoco mira `apps/api/test`: los fixtures de un test viven en una base efímera que no
 * manda un solo mail, así que pedir que cambien no protege a nadie y sí agrega ruido.
 */
const PAQUETES = [
  'apps/api/src',
  'apps/inmobiliaria/src',
  'apps/inquilino/src',
  'apps/propietario/src',
];

/**
 * Una dirección que es VALOR DE UN DATO: `email: 'x@y.com'`, `{ contacto: "x@y.com" }`.
 *
 * Deliberadamente NO matchea un `placeholder="juan@email.com"` de un formulario: eso es texto
 * de pantalla, no una fila que alguien pueda cargar en una base y a la que el sistema le
 * mande una rendición. Son riesgos distintos y mezclarlos haría que el control pidiera
 * cambios que no protegen a nadie —y un control que pide ruido se termina apagando—.
 */
const EMAIL_DE_DATO = /[A-Za-z_$][\w$]*\s*:\s*['"`]([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})['"`]/g;

function direccionesDelRepo(): { direccion: string; donde: string }[] {
  const encontradas: { direccion: string; donde: string }[] = [];
  const recorrer = (dir: string): void => {
    for (const entrada of readdirSync(dir)) {
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) {
        if (entrada === 'node_modules' || entrada === '.next' || entrada === 'migrations') continue;
        recorrer(ruta);
        continue;
      }
      if (!/\.tsx?$/.test(entrada)) continue;
      readFileSync(ruta, 'utf8')
        .split('\n')
        .forEach((linea, i) => {
          for (const m of linea.matchAll(EMAIL_DE_DATO)) {
            encontradas.push({
              direccion: m[1]!,
              donde: `${ruta.slice(RAIZ.length + 1).split(String.fromCharCode(92)).join('/')}:${i + 1}`,
            });
          }
        });
    }
  };
  for (const p of PAQUETES) recorrer(join(RAIZ, p));
  return encontradas;
}

describe('los datos de demo no le escriben a nadie', () => {
  const todas = direccionesDelRepo();

  it('el barrido encontró algo: si no, el control no está midiendo nada', () => {
    // Un `readdirSync` sobre una ruta equivocada devuelve una lista vacía y el test de abajo
    // pasa sin haber mirado un solo archivo. Es la forma más común de semáforo apagado.
    expect(todas.length).toBeGreaterThan(20);
  });

  it('🔴 ninguna dirección apunta a un dominio que pueda existir', () => {
    const afuera = todas
      .filter((e) => !RESERVADOS.test(e.direccion) && !EXCEPCIONES.has(e.direccion))
      .map((e) => `${e.direccion}  (${e.donde})`);
    // Con el bug: gmail, hotmail, yahoo, globant.com y cinco dominios .com.ar de inmobiliaria
    // y de proveedores, cuatro de ellos publicados en Pages.
    expect(afuera, `direcciones que le pueden llegar a alguien:\n${afuera.join('\n')}`).toEqual([]);
  });
});
