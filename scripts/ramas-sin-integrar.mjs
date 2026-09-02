#!/usr/bin/env node
/**
 * Avisa qué ramas tienen trabajo que NO llegó a la rama de integración.
 *
 * POR QUÉ EXISTE. Dos veces (T-44 y T-44-N1) hubo que sentarse a consolidar a mano, y las dos
 * veces aparecieron tareas marcadas ✅ en `09-TAREAS-REUNION-CAMILA.md` cuyo código no estaba en
 * la rama que se deployaría. La segunda vez fueron cinco tareas y una feature entera.
 *
 * El CI no lo agarra y no lo va a agarrar: corre typecheck y tests **de la rama que le toca**,
 * así que una rama sana y olvidada da verde para siempre sin que su código llegue a ningún lado.
 * Un ✅ que no está en la rama de deploy es peor que un pendiente, porque nadie lo vuelve a mirar.
 *
 * QUÉ MIRA, Y POR QUÉ LAS DOS COSAS:
 *
 *  1. Ramas con commits fuera de la integración. El goteo que hay que ver temprano.
 *  2. Si la integración misma está en el remoto y cuánto le lleva a `origin/main`. Esto no es un
 *     agregado: cuando se escribió este script, la rama de integración **no existía en origin** y
 *     tenía 262 commits que vivían sólo en un disco. Un script que avisara sólo lo primero habría
 *     dado "todo consolidado" sobre trabajo que un disco roto se llevaba entero.
 *
 * USO:
 *   node scripts/ramas-sin-integrar.mjs                    # ramas locales
 *   node scripts/ramas-sin-integrar.mjs --remotas          # ramas de origin (para CI)
 *   node scripts/ramas-sin-integrar.mjs --base <rama>      # fijar la integración a mano
 *   node scripts/ramas-sin-integrar.mjs --dias 3           # sólo avisar si tienen 3+ días
 *   node scripts/ramas-sin-integrar.mjs --fallar           # exit 1 si hay algo (para gatear)
 *   node scripts/ramas-sin-integrar.mjs --solo-base        # imprime SÓLO la rama de integración
 *
 * Por defecto NO falla: informa. Que rompa el build de alguien que recién empieza una rama sería
 * ruido, y el ruido se apaga.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n, def) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const REMOTAS = flag('--remotas');
const FALLAR = flag('--fallar');
const DIAS_MIN = Number(valor('--dias', '0'));

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

/** En CI la rama `main` local puede no existir (checkout trae una sola): se compara contra la
 *  del remoto. Sin esto, `rev-list main..X` tira y la detección de base caía siempre a `main`. */
const MAIN = REMOTAS ? 'origin/main' : 'main';

/**
 * La rama de integración. Se DEDUCE, no se nombra.
 *
 * La tentación es filtrar por nombre, y es la trampa: el PROMPT de tareas hacía
 * `grep -E '^feat/reunion-'`, la integración pasó a llamarse `feat/propietario-detalle-rendicion`
 * y el patrón empezó a devolver una rama 58 commits atrasada, en silencio. Poner acá otra lista
 * de nombres sería el mismo error con más pasos: caduca el día que alguien renombre.
 *
 * El criterio es estructural y tiene DOS partes, y la segunda no estaba:
 *
 *   1. La rama tiene que CONTENER todo `main`. Una integración es main más el trabajo que
 *      acumuló; si le faltan commits de main, es una rama de tarea que quedó atrás.
 *   2. Entre las que cumplen 1, la que más commits tiene por encima de `main`. Es "más
 *      commits" y no "más reciente": una rama recién creada es más reciente que la
 *      integración y la ganaría siempre.
 *
 * Sin la parte 1 la heurística se degrada sola a medida que el repo deja de usar una rama de
 * integración: ganaba la rama de TAREA más gorda. El 20/08/2026 eso daba
 * `feat/semaforo-dni` —34 commits propios, 16 días sin tocar, PR abierto— y el informe salía
 * medido contra ella, listando a `origin/main` con 448 commits "fuera de la integración".
 *
 * Si NINGUNA rama contiene a main —que es el caso cuando se mergea derecho a `main`, como se
 * trabaja hoy— cae a `main`, que es la respuesta correcta: la integración es main.
 */
function detectarBase() {
  const explicita = valor('--base', null);
  if (explicita) return explicita;

  const ref = REMOTAS ? 'refs/remotes/origin' : 'refs/heads';
  const candidatas = git('for-each-ref', '--format=%(refname:short)', ref)
    .split('\n')
    .filter(Boolean)
    .filter((b) => b !== 'origin/HEAD' && b !== MAIN && b !== 'main')
    .map((b) => ({ b, adelante: contar(MAIN, b), atras: contar(b, MAIN) }))
    // Una integración CONTIENE todo lo que hay en main: es main + el trabajo que acumuló. Si
    // le FALTAN commits de main, no es una integración: es una rama de tarea que quedó vieja.
    // Sin este filtro ganaba la rama de tarea más gorda —`feat/semaforo-dni`, 34 commits
    // propios y 16 días sin tocar— y el informe salía medido contra ella: listaba a
    // `origin/main` con 448 commits "fuera de la integración", que es un absurdo. Un aviso
    // que dice un absurdo en cada corrida enseña a ignorar el aviso.
    .filter((c) => c.atras === 0)
    .sort((a, z) => z.adelante - a.adelante);

  // Cae a MAIN, no al literal `main`: con --remotas (que es como corre en CI) la rama local
  // `main` puede no existir, y `contar()` se traga ese error devolviendo 0 — o sea que una
  // base inexistente haría ver TODO como consolidado. Es el falso "todo bien" que este script
  // existe para no dar.
  return candidatas[0]?.adelante > 0 ? candidatas[0].b : MAIN;
}

/** ¿Existe esa ref? Para no medir el riesgo contra algo que no está. */
function existeRef(ref) {
  try {
    git('rev-parse', '--verify', '--quiet', ref);
    return true;
  } catch {
    return false;
  }
}

function contar(desde, hasta) {
  try {
    return Number(git('rev-list', '--count', `${desde}..${hasta}`));
  } catch {
    return 0;
  }
}

function diasDesde(rama) {
  try {
    const ts = Number(git('log', '-1', '--format=%ct', rama));
    return Math.floor((Date.now() / 1000 - ts) / 86400);
  } catch {
    return 0;
  }
}

const BASE = detectarBase();

// `--solo-base` es para que el PROMPT de tareas no tenga que repetir la heurística: ahí ya
// quedó vieja una vez y mandó a todos a branchear de una rama 58 commits atrasada. Imprime el
// nombre pelado y nada más, para poder hacer BASE=$(...).
if (flag('--solo-base')) {
  console.log(BASE);
  process.exit(0);
}

const ref = REMOTAS ? 'refs/remotes/origin' : 'refs/heads';
const ramas = git('for-each-ref', '--format=%(refname:short)', ref)
  .split('\n')
  .filter(Boolean)
  .filter((b) => b !== BASE && b !== 'origin/HEAD');

const sueltas = ramas
  .map((b) => ({ rama: b, commits: contar(BASE, b), dias: diasDesde(b) }))
  .filter((x) => x.commits > 0 && x.dias >= DIAS_MIN)
  .sort((a, z) => z.commits - a.commits);

console.log(`\nIntegración: ${BASE}${flag('--base') ? '' : '  (detectada)'}`);

// ── 1. La integración, ¿está a salvo? ────────────────────────────────────────────────────
let remotoOk = true;
try {
  const enRemoto = git('ls-remote', '--heads', 'origin', BASE.replace(/^origin\//, ''));
  // Se mide contra lo que HAY EN EL REMOTO, no contra la rama `main` local. En modo local
  // `MAIN` es `main` a secas, que suele estar días atrás de `origin/main`, y entonces este
  // aviso cuenta como "en un solo disco" commits que ya están pusheados y a salvo. Medido el
  // 20/08/2026: decía 29 commits en riesgo cuando los que de verdad no estaban en ningún lado
  // eran 7 — el `main` local estaba 23 commits atrás. Un aviso que exagera se descarta igual
  // que uno que miente, y este script sólo sirve si se le cree.
  const referenciaRemota = existeRef('origin/main') ? 'origin/main' : MAIN;
  const adelanteDeMain = contar(referenciaRemota, BASE);
  if (!enRemoto) {
    remotoOk = false;
    console.log(
      `
  ⚠  La rama de integración NO está en origin, y tiene ${adelanteDeMain} commits que no
` +
        `     están en ${referenciaRemota}. Ese trabajo existe en UN SOLO disco: no hay backup, no
` +
        `     hay CI que lo mire y no hay forma de deployarlo desde otra máquina.`,
    );
  } else {
    const sinPushear = contar(`origin/${BASE.replace(/^origin\//, '')}`, BASE);
    if (sinPushear > 0) {
      remotoOk = false;
      console.log(`\n  ⚠  La integración tiene ${sinPushear} commits sin pushear a origin.`);
    }
  }
} catch {
  console.log('\n  (no se pudo consultar origin — sin red o sin permisos)');
}

// ── 2. Las ramas que se quedaron afuera ──────────────────────────────────────────────────
if (sueltas.length === 0) {
  console.log('\n  ✓ Ninguna rama tiene commits fuera de la integración.\n');
} else {
  const total = sueltas.reduce((a, x) => a + x.commits, 0);
  console.log(`\n  ${sueltas.length} rama(s) con ${total} commit(s) fuera de la integración:\n`);
  const ancho = Math.max(...sueltas.map((x) => x.rama.length));
  for (const x of sueltas) {
    console.log(`    ${x.rama.padEnd(ancho)}  ${String(x.commits).padStart(3)} commit(s)   ${x.dias}d`);
  }
  console.log(
    '\n  Si alguna es trabajo terminado, va a la integración. Si está abandonada, se borra:\n' +
      '  el problema no son las ramas vivas, son las que nadie va a volver a mirar.\n',
  );
}

if (FALLAR && (sueltas.length > 0 || !remotoOk)) process.exit(1);
