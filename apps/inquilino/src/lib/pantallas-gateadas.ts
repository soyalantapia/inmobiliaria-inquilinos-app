/**
 * Qué pantallas de la PWA son, en producción, un cartel de «Disponible pronto».
 *
 * ⚠️ SÓLO PARA TESTS: lee el disco con `node:fs`. No lo importe una pantalla.
 *
 * POR QUÉ VIVE ACÁ Y NO ADENTRO DE UN TEST. Porque ya hay DOS controles que lo necesitan —el del
 * tour (#154) y el de Mi Cuenta— y una segunda copia de esta regla se desincroniza de la primera.
 * Eso no es una hipótesis en este repo: es el defecto que ya se pagó en `uploads.ts`, donde una
 * copia de la vigencia del link mágico se quedó con dos de las tres reglas.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const APP = fileURLToPath(new URL('../app', import.meta.url));

function paginas(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '.next') continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) paginas(ruta, acc);
    else if (entrada === 'page.tsx') acc.push(ruta);
  }
  return acc;
}

/** `app/(app)/contrato/renovacion/page.tsx` → `/contrato/renovacion`. Los grupos no son ruta. */
export function rutaDe(archivo: string): string {
  const rel = archivo.slice(APP.length).replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
  const segmentos = rel.split('/').filter((s) => s && !s.startsWith('('));
  return `/${segmentos.join('/')}`;
}

/**
 * El código sin sus comentarios.
 *
 * NO ES COSMÉTICA. Sin esto, el detector cuenta como «pantalla gateada» a cualquier archivo cuyo
 * COMENTARIO nombre las dos marcas — y pasó apenas se arregló el mismo defecto una pantalla más
 * allá: `cuenta/page.tsx` explica en un comentario que /calendario y /profesionales «se gatean
 * con `if (apiEnabled) return <Proximamente …>`», y con eso `/cuenta` entraba a la lista y el CTA
 * legítimo del último slide del tour se ponía rojo.
 *
 * La salida barata habría sido borrar esa explicación. Un control que castiga escribir POR QUÉ se
 * hizo algo empuja justo en la dirección contraria a la que estos controles defienden.
 */
export const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/**
 * Las rutas que producción tapa con un «Próximamente». Se piden las DOS marcas juntas —el gate
 * por `apiEnabled` y el componente— para no contar una pantalla que sólo lo importe de paso.
 */
export const GATEADAS: string[] = paginas(APP)
  .map((archivo) => ({ archivo, src: sinComentarios(readFileSync(archivo, 'utf8')) }))
  .filter(({ src }) => src.includes('<Proximamente') && src.includes('if (apiEnabled)'))
  .map(({ archivo }) => rutaDe(archivo));
