/**
 * ¿Esta `DATABASE_URL` es la de PRODUCCIÓN?
 *
 * POR QUÉ EXISTE. `seedBase` es destructivo-idempotente (borra pagos, reusa ids fijos) y
 * corre en el `beforeAll` de ~50 suites de integración. Hasta ahora **no tenía ninguna
 * protección**: si alguien exportaba la `DATABASE_URL` de producción y corría
 * `vitest run`, el seed se ejecutaba contra la base del cliente sin una sola pregunta.
 * El único guard del repo vivía en `limpiar-test-db.ts` — o sea, el script que borra
 * a mano estaba protegido y el que corre solo en cada test, no.
 *
 * CÓMO DISTINGUE. Producción corre DENTRO de Railway y se alcanza por el host interno
 * `*.railway.internal`, que no es resoluble desde afuera. La instancia de test/dev se
 * alcanza por el proxy público `*.proxy.rlwy.net`. Eso lo documenta `docs/TESTING.md`.
 * `myalquiler-db` es el nombre del servicio de la base de prod en Railway y se incluye
 * por si alguien arma la URL de otra forma.
 *
 * FALLA CERRADO A PROPÓSITO. Ante la duda dice "sí, es prod": una URL vacía o rara
 * frena el seed. El costo de un falso positivo es un mensaje molesto; el de un falso
 * negativo es borrarle datos a un cliente real.
 */
export function urlEsDeProduccion(url: string | undefined | null): boolean {
  const u = (url ?? '').trim();
  // Sin URL no hay forma de saber contra qué se está por escribir ⇒ se trata como prod.
  if (!u) return true;
  if (/railway\.internal/i.test(u)) return true;
  if (/myalquiler-db/i.test(u)) return true;
  // El proxy público es la instancia de test/dev: es el único host que damos por seguro.
  if (/proxy\.rlwy\.net/i.test(u)) return false;
  // localhost / 127.0.0.1 / docker: base local de desarrollo.
  if (/@(localhost|127\.0\.0\.1|host\.docker\.internal|postgres|db)[:/]/i.test(u)) return false;
  // Cualquier otro host es desconocido ⇒ fail-closed.
  return true;
}

/** Mensaje único, para que el operador entienda qué pasó y cómo salir. */
export function mensajeDbBloqueada(quien: string): string {
  return (
    `${quien} NO puede correr contra esta base: la DATABASE_URL no es una base de test conocida.\n` +
    'Es un seed DESTRUCTIVO y corre en el beforeAll de las suites de integración.\n' +
    'Bases aceptadas: el proxy público de Railway (*.proxy.rlwy.net) o una Postgres local ' +
    '(localhost / 127.0.0.1 / docker).\n' +
    'Producción vive en el host interno *.railway.internal y es inalcanzable desde afuera — ' +
    'si tu URL apunta ahí, estás por escribirle a la base del cliente.\n' +
    'Ver docs/TESTING.md § "Contra qué DB".'
  );
}

/** Corta la ejecución si la URL no es una base de test reconocida. */
export function exigirDbDeTest(quien: string, url: string | undefined | null = process.env.DATABASE_URL): void {
  if (urlEsDeProduccion(url)) throw new Error(mensajeDbBloqueada(quien));
}
