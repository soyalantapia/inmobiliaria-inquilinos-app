/**
 * Qué pantallas de la PWA son, en producción, un cartel de «Disponible pronto».
 *
 * ⚠️ SÓLO PARA TESTS: lee el disco con `node:fs`. No lo importe una pantalla.
 *
 * POR QUÉ ES UN MÓDULO Y NO VIVE ADENTRO DE UN TEST. Porque apareció un SEGUNDO consumidor: al
 * control del tour (#154/#161) se le sumó el de Mi Cuenta, que es la pantalla de al lado y tenía
 * el mismo defecto. Dos copias de esta regla se desincronizan — es lo que este repo ya pagó en
 * `uploads.ts`, donde una copia de la vigencia del link mágico se quedó con dos de las tres
 * reglas y dejó un link sirviendo archivos para siempre.
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
 * Las líneas que son ENTERAMENTE comentario, afuera.
 *
 * Sin esto el detector lee los comentarios como código, y en este repo los comentarios hablan
 * justo de esto: una pantalla que explique en su docblock que «antes acá había un
 * `<Proximamente>` detrás de `if (apiEnabled)`» quedaría contada como gateada, y el tour se
 * comería un rojo por un CTA que funciona.
 *
 * NO se hace strip de `//` a fin de línea, a propósito: una línea como
 * `if (apiEnabled) { // ver nota` perdería el gate real, y ese error va para el lado peligroso
 * —una pantalla gateada que el detector no ve, y el CTA roto pasa—. Los comentarios sueltos que
 * queden son inofensivos.
 *
 * LOS BLOQUES `{/* … *\/}` TAMBIÉN, y ésta es la parte que la primera versión no tenía. Un
 * comentario JSX abre con `{/*`, que no empieza por `//` ni por `*`, y sus líneas del medio
 * empiezan por texto común. Se descubrió con un rojo de verdad: el comentario que explica el
 * arreglo de Mi Cuenta menciona `if (apiEnabled) return <Proximamente …>` en un bloque así, y
 * con eso `/cuenta` entraba a la lista y el CTA legítimo del último slide del tour se ponía rojo.
 * Se sigue el estado de apertura línea por línea en vez de un regex sobre todo el archivo,
 * porque un regex glotón se comería código real entre dos bloques lejanos.
 */
export function soloCodigo(src: string): string {
  let dentroDeBloque = false;
  return src
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      if (dentroDeBloque) {
        if (t.includes('*/')) dentroDeBloque = false;
        return false;
      }
      // Abre un bloque y no lo cierra en la misma línea: lo que sigue es prosa.
      if ((t.startsWith('{/*') || t.startsWith('/*')) && !t.includes('*/')) {
        dentroDeBloque = true;
        return false;
      }
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*'));
    })
    .join('\n');
}

/**
 * Las rutas que producción tapa con un «Próximamente». Se piden las DOS marcas juntas —el gate
 * por `apiEnabled` y el componente— para no contar una pantalla que sólo lo importe de paso.
 */
export const GATEADAS: string[] = paginas(APP)
  .map((archivo) => ({ archivo, src: soloCodigo(readFileSync(archivo, 'utf8')) }))
  .filter(({ src }) => src.includes('<Proximamente') && src.includes('if (apiEnabled)'))
  .map(({ archivo }) => rutaDe(archivo));
