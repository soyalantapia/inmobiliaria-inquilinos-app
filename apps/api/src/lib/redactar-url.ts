/**
 * Parámetros de query que NO pueden quedar escritos en el log.
 *
 * Dos clases distintas, por dos motivos distintos:
 *
 *  · **Credenciales.** El JWT de sesión (15 días) viaja por query en
 *    `GET /uploads/:tenant/:name` —un `<img src>` no puede mandar el header
 *    Authorization—, así que cada foto o comprobante que alguien abría escribía
 *    una sesión válida en texto plano.
 *
 *  · **Datos personales de terceros.** `GET /personas?q=20123456` es cómo el
 *    panel busca a una persona para reusarla, y `q` es casi siempre un DNI.
 *    Cargar los ~50 morosos de una migración deja 50+ documentos en el log, más
 *    los reintentos por cada typo.
 *
 * `dni`, `cuit`, `email` y `telefono` hoy **no viajan por query en ningún
 * endpoint**. Están igual, y a propósito: esto es una denylist —sólo redacta lo
 * que alguien se acordó de agregar— y ya falló una vez, porque el DNI estuvo
 * logueándose desde que existe la búsqueda de personas. Que el próximo parámetro
 * de ese tipo nazca redactado en vez de nacer filtrando.
 */
const PARAMS_SENSIBLES = ['token', 'access_token', 'q', 'dni', 'cuit', 'email', 'telefono'] as const;

const RE_SENSIBLES = new RegExp(`([?&](?:${PARAMS_SENSIBLES.join('|')})=)[^&]*`, 'gi');

/**
 * Una URL de request lista para loguear: los valores sensibles reemplazados por
 * `[REDACTED]` y **el resto intacto**, que es lo que permite seguir debuggeando.
 *
 * Se redacta el VALOR y se conserva el nombre del parámetro: saber que hubo una
 * búsqueda sirve; saber qué DNI se buscó, no.
 */
export function urlParaLog(url: unknown): string {
  return String(url ?? '').replace(RE_SENSIBLES, '$1[REDACTED]');
}
