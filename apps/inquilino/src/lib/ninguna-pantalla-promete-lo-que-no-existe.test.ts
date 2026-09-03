/**
 * T-18 · Ninguna pantalla de la PWA manda a un cartel de «Disponible pronto» sin decirlo.
 *
 * EL DEFECTO, Y POR QUÉ VUELVE. Hay rutas que existen como archivo pero en producción devuelven
 * un cartel: se gatean con `if (apiEnabled) return <Proximamente …>` porque la pantalla se arma
 * con mocks. Están bien así. Lo que está mal es que otra pantalla las ofrezca **como si
 * anduvieran** — y eso pasó tres veces seguidas, todas en el mismo camino de un inquilino nuevo:
 *
 *  - el onboarding tenía un slide entero «Chateá con el Asistente» con CTA a `/broker`;
 *  - se sacó ése, y quedó el slide «Mi calendario» con CTA a `/calendario`;
 *  - y «Y mucho más» prometía profesionales (`/profesionales`) y «renovación»
 *    (`/contrato/renovacion`), las dos carteles.
 *
 * O sea: el patrón no es «alguien se equivocó», es que **el texto de promoción y la pantalla que
 * promociona viven en archivos distintos** y nadie los vuelve a cruzar. Un inquilino nuevo veía
 * la app por primera vez, tocaba el primer botón y llegaba a «Estamos terminando de conectarlo».
 *
 * CÓMO FUNCIONA. Descubre las rutas-cartel leyendo el código (no una lista escrita a mano: una
 * lista se desactualiza y el test se vuelve un semáforo verde fijo), y después exige que ninguna
 * pantalla las ofrezca sin marcarlas. El onboarding no puede mandar a ninguna; Mi Cuenta sí puede
 * listarlas, pero con el badge `pronto`.
 *
 * El primer caso es un CONTROL DEL CONTROL: si mañana no queda ninguna ruta-cartel, este archivo
 * dejaría de medir nada y se pondría verde para siempre sin que nadie se entere.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const APP = join(RAIZ, 'app', '(app)');

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) archivos(full, acc);
    else if (e.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

/**
 * El código sin sus comentarios.
 *
 * NO ES COSMÉTICA. La primera versión de este archivo miraba el fuente crudo, y marcó `/cuenta`
 * como cartel porque un comentario de esta misma tanda EXPLICA que /calendario y /profesionales
 * se gatean «con `if (apiEnabled) return <Proximamente …>`». O sea que el control se ponía rojo
 * por la prosa que documenta el arreglo — y la salida barata habría sido borrar la explicación.
 * Un control que castiga escribir por qué se hizo algo empuja justo en la dirección contraria.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/**
 * Las rutas que en PRODUCCIÓN son un cartel. Se derivan del código: un `page.tsx` que importa
 * `Proximamente` y lo devuelve detrás de `apiEnabled`. El path del archivo es la ruta.
 */
const RUTAS_CARTEL = archivos(APP)
  .filter((f) => f.endsWith(`page.tsx`))
  .filter((f) => {
    const src = sinComentarios(readFileSync(f, 'utf8'));
    return src.includes('<Proximamente') && src.includes('apiEnabled');
  })
  .map((f) => '/' + relative(APP, f).replaceAll('\\', '/').replace(/\/page\.tsx$/, ''));

const onboarding = readFileSync(join(RAIZ, 'components', 'onboarding.tsx'), 'utf8');

/**
 * El texto que el inquilino LEE: títulos, descripciones, bullets y etiquetas de botón. No el
 * archivo entero — los comentarios que explican qué se sacó nombran, por necesidad, justo lo que
 * está prohibido prometer.
 */
const TEXTO_VISIBLE = [
  ...[...onboarding.matchAll(/(?:titulo|descripcion|label):\s*'([^']+)'/g)].map((m) => m[1]!),
  ...[...onboarding.matchAll(/bullets:\s*\[([^\]]+)\]/g)].flatMap((m) =>
    [...m[1]!.matchAll(/'([^']+)'/g)].map((b) => b[1]!),
  ),
];

describe('ninguna pantalla promete lo que no existe', () => {
  it('CONTROL DEL CONTROL — hay rutas-cartel que descubrir, si no esto no mide nada', () => {
    // Si algún día no queda ninguna, este archivo entero pasa a ser un semáforo verde fijo. Que
    // se ponga rojo acá es la señal de que hay que revisarlo, no de que algo se rompió.
    expect(RUTAS_CARTEL.length).toBeGreaterThan(0);
    // Y las dos que motivaron esta tarea, nombradas: si alguien conecta el calendario de verdad,
    // este caso se pone rojo y obliga a volver a mirar los textos que lo ofrecían.
    expect(RUTAS_CARTEL).toContain('/calendario');
    expect(RUTAS_CARTEL).toContain('/profesionales');
  });

  it('🔴 ningún CTA del onboarding lleva a un cartel', () => {
    const ctas = [...onboarding.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]!);
    expect(ctas.length, 'el onboarding tiene que tener CTAs que revisar').toBeGreaterThan(3);
    const rotos = ctas.filter((h) => RUTAS_CARTEL.includes(h));
    // Con el bug: ['/calendario'] — y antes de eso, ['/broker'].
    expect(rotos, `el onboarding manda a ${rotos.join(', ')}, que son carteles`).toEqual([]);
  });

  it('🔴 el onboarding tampoco nombra en su TEXTO una capacidad que es un cartel', () => {
    // El CTA no es el único lugar donde se promete. «Y mucho más» tenía el bullet «Plomero,
    // electricista y técnicos recomendados» y la palabra «renovación» en la descripción, con el
    // CTA apuntando a `/cuenta`, que sí existe: mirar sólo los href no lo hubiera agarrado.
    //
    // Se mira SÓLO el texto que el inquilino ve. La primera versión escaneaba el archivo entero
    // y se puso roja con los comentarios de este mismo arreglo, que explican qué se sacó y por
    // qué. Un control que no distingue el texto de la explicación obliga a no escribir la
    // explicación, que es justo lo que hace falta para que esto no vuelva.
    const prohibidas = [/[Pp]lomero, electricista/, /renovación/, /[Aa]sistente/, /calendario/i];
    const encontradas = prohibidas.filter((re) => TEXTO_VISIBLE.some((s) => re.test(s)));
    expect(
      encontradas.map(String),
      `el onboarding nombra una capacidad que en producción es un cartel, en: ${TEXTO_VISIBLE.filter(
        (s) => prohibidas.some((re) => re.test(s)),
      ).join(' | ')}`,
    ).toEqual([]);
  });

  it('Mi Cuenta puede listar una ruta-cartel, pero marcada con `pronto`', () => {
    // Acá la decisión es otra: la fila NO se saca —la capacidad está en camino y esconderla no
    // ayuda— pero tiene que decir que todavía no anda. Se mira sólo la rama de producción
    // (`CuentaReal`); en el build demo esas pantallas funcionan de verdad.
    const cuenta = sinComentarios(readFileSync(join(APP, 'cuenta', 'page.tsx'), 'utf8'));
    const real = cuenta.slice(cuenta.indexOf('function CuentaReal'), cuenta.indexOf('function CuentaDemo'));
    expect(real.length, 'no se encontró la rama de producción de /cuenta').toBeGreaterThan(500);
    for (const ruta of RUTAS_CARTEL) {
      const fila = real.indexOf(`href="${ruta}"`);
      if (fila === -1) continue;
      const bloque = real.slice(fila, fila + 120);
      expect(bloque, `Mi Cuenta ofrece ${ruta} sin decir que es un cartel`).toMatch(/\bpronto\b/);
    }
  });
});
