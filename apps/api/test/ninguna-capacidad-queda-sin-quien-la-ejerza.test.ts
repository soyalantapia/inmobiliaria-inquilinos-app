/**
 * Endpoints que MUTAN y que ninguna pantalla llama.
 *
 * EL PATRÓN, QUE YA COSTÓ TRES VECES. Se construye un endpoint —autenticado, con sus guardas,
 * con su 409— y no se cablea a ninguna pantalla. Queda una capacidad que el equipo da por
 * entregada y que nadie puede ejercer, y como nadie la ejerce, tampoco se rompe con ruido:
 * envejece en silencio hasta que alguien la necesita y descubre que nunca estuvo disponible.
 *
 *   · `PATCH /propietarios/:id/activo` — la baja de un propietario. Construida hacía semanas.
 *     Mientras tanto, la única forma de sacar del portal a un dueño que vendió era borrarle el
 *     email a mano desde la ficha: un efecto lateral de otra cosa, sin documentar.
 *   · `POST /reportes` y `GET /reportes` — el canal del cliente piloto y su bandeja. Los dos
 *     construidos, autenticados, con tracking server-side, y **inalcanzables**: la única UI que
 *     los usaría es el FAB del piloto, y `piloto-fab.tsx` corta con `if (apiEnabled) return
 *     null`, o sea que no se monta en producción. Está declarado abajo con el detalle.
 *   · Y antes, la misma forma en T-46.
 *
 * CÓMO FUNCIONA. Junta los `app.post|put|patch|delete` de `src/routes/` y busca cada ruta en los
 * TRES fronts, como patrón de path (los `:param` matchean cualquier segmento). Lo que no aparece
 * en ninguno, o está declarado abajo con su motivo, o es un hallazgo.
 *
 * LO QUE ESTE TEST NO VE, dicho para que nadie lo lea como una garantía: las rutas armadas con
 * plantilla (`app.post(\`/x/:id/${accion}\`)`) se saltean —no se puede resolver el literal sin
 * ejecutar el módulo— y una llamada del front construida por concatenación tampoco se encuentra.
 * O sea que puede haber huérfanos que no salen acá. Los que salen, salen.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const RUTAS = join(REPO, 'apps', 'api', 'src', 'routes');
const FRONTS = ['inmobiliaria', 'inquilino', 'propietario'].map((a) => join(REPO, 'apps', a, 'src'));

const RE_HANDLER = /app\.(post|put|patch|delete)\(\s*['`]([^'`]+)['`]/g;

/**
 * Endpoints que legítimamente no llama ningún front, cada uno con su motivo. Agregar uno acá es
 * una decisión: si mañana aparece un tercero sin razón, es que alguien lo puso para callar el
 * test en vez de cablear la pantalla.
 */
const DECLARADOS: Record<string, string> = {
  'POST /internal/cron/devengar':
    'lo dispara un cron, no una pantalla. El prefijo `/internal/` lo dice y es el único que lo usa',
  'POST /reportes':
    '⚠️ DECLARADO PERO NO SANO. La única UI que lo llamaría es el FAB del piloto, y ' +
    '`piloto-fab.tsx:82` corta con `if (apiEnabled) return null`: no se monta en producción, así ' +
    'que el endpoint es hoy inalcanzable — igual que `GET /reportes`, su bandeja. Los dos están ' +
    'construidos con tracking server-side (IP, userAgent, rol y tenant vigentes, sesión, build). ' +
    'No se cablea desde acá porque prender el reporter del piloto en producción es una decisión ' +
    'de producto, no de un agente. Anotado en PARA-ALAN.md.',
  'POST /auth/login':
    'backstop de emergencia, y es una DECISIÓN escrita en `auth.ts:277`: el panel entra por OTP ' +
    '(`/auth/usuario/otp/request` + `/verify`), sin contraseña. Se declara acá porque no llamarlo ' +
    'no es un olvido. Pero conviene leerlo también al revés: es una puerta por contraseña que ' +
    'ninguna pantalla usa, o sea que nadie la mira — y es justo por donde corre el riesgo de ' +
    'T-35 (cuentas viejas que heredaron la contraseña del admin; la migración de PINes no tocó ' +
    '`passwordHash`). Lo único que la ejercita hoy son los tests.',
};

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) {
      if (e === 'node_modules' || e === '.next') continue;
      archivos(full, acc);
    } else if (e.endsWith('.ts') || e.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

/**
 * El codigo sin sus comentarios.
 *
 * NO ES COSMETICA, y lo descubri con el control negativo de este mismo archivo. La primera
 * version leia el fuente crudo, asi que el docblock que explica el hook —el que escribe
 * «(`POST /reportes`)» para decir que endpoint usa— contaba como llamador. Desenchufe el hook
 * ENTERO y el test siguio en verde: la prosa que documenta la conexion la sostenia sola.
 *
 * Es la cuarta vez en el dia que un control de este repo se rompe leyendo su propia explicacion.
 * Aca los comentarios nombran rutas todo el tiempo, asi que un detector que busque paths tiene
 * que mirar codigo.
 *
 * NO se corta `//` a fin de linea, por la misma razon que en `pantallas-gateadas.ts` del front:
 * `apiFetch('/x') // ver nota` perderia la llamada real, y ese error va para el lado peligroso
 * —un endpoint cableado que el detector no ve, y un falso hallazgo que hace agregar una
 * declaracion de mas—.
 */
function soloCodigo(src: string): string {
  let bloque = false;
  return src
    .split(/\r?\n/)
    .filter((l) => {
      const s = l.trim();
      if (bloque) {
        if (s.includes('*/')) bloque = false;
        return false;
      }
      if ((s.startsWith('{/*') || s.startsWith('/*')) && !s.includes('*/')) {
        bloque = true;
        return false;
      }
      return !(s.startsWith('//') || s.startsWith('*') || s.startsWith('/*') || s.startsWith('{/*'));
    })
    .join('\n');
}

const codigoDeLosFronts = FRONTS.map((d) =>
  archivos(d)
    .map((f) => soloCodigo(readFileSync(f, 'utf8')))
    .join('\n'),
).join('\n');

/** `/contratos/:id/renovar` → un regex que matchea esa ruta con cualquier id adentro. */
function comoPath(ruta: string): RegExp {
  const partes = ruta
    .split('/')
    .filter(Boolean)
    .map((s) => (s.startsWith(':') ? String.raw`[^/'"\`\s]+` : s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)));
  return new RegExp('/' + partes.join('/') + String.raw`(?![\w-])`);
}

interface Endpoint {
  clave: string;
  archivo: string;
}

function endpointsQueMutan(): { encontrados: Endpoint[]; salteados: number } {
  const encontrados: Endpoint[] = [];
  let salteados = 0;
  for (const f of readdirSync(RUTAS).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(join(RUTAS, f), 'utf8');
    for (const m of src.matchAll(RE_HANDLER)) {
      const ruta = m[2]!;
      if (ruta.includes('${')) {
        salteados++;
        continue;
      }
      encontrados.push({ clave: `${m[1]!.toUpperCase()} ${ruta}`, archivo: f });
    }
  }
  return { encontrados, salteados };
}

describe('ninguna capacidad queda construida sin quien la ejerza', () => {
  const { encontrados, salteados } = endpointsQueMutan();

  it('el barrido encuentra endpoints y fronts: si no, esto no mide nada', () => {
    // Un `readdirSync` sobre una ruta equivocada devuelve vacío y deja pasar todo. Que se ponga
    // rojo acá es la señal de que el test se desconectó, no de que el repo esté sano.
    expect(encontrados.length, 'no se encontró ni un endpoint que mute').toBeGreaterThan(50);
    expect(codigoDeLosFronts.length, 'no se leyó el código de los fronts').toBeGreaterThan(100_000);
    expect(salteados, 'demasiadas rutas con plantilla: el barrido está ciego').toBeLessThan(10);
  });

  it('🔴 todo endpoint que muta tiene quien lo llame, o está declarado con su motivo', () => {
    const huerfanos = encontrados
      .filter((e) => !(e.clave in DECLARADOS))
      .filter((e) => !comoPath(e.clave.split(' ')[1]!).test(codigoDeLosFronts))
      .map((e) => `${e.clave}  (${e.archivo})`);

    // Con el bug: ['POST /reportes  (inquilino-mundo.ts)'] y, antes,
    // 'PATCH /propietarios/:id/activo  (core.ts)'.
    expect(
      huerfanos,
      'Estos endpoints existen y ninguna pantalla los llama. O se cablean, o se declaran arriba ' +
        'con el motivo — pero no se dejan como capacidad que el equipo cree tener.',
    ).toEqual([]);
  });

  it('las declaraciones siguen apuntando a un endpoint que existe', () => {
    // Una excepción que sobrevive al endpoint que la justificaba es ruido que tapa al siguiente.
    const claves = new Set(encontrados.map((e) => e.clave));
    const muertas = Object.keys(DECLARADOS).filter((k) => !claves.has(k));
    expect(muertas, 'declarado pero ya no existe: ¿se renombró?').toEqual([]);
  });
});
