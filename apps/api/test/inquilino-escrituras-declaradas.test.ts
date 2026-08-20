/**
 * T-23-N4-N1 · GUARDARRAÍL: ninguna escritura del inquilino nace sin decidir si gatea el
 * contrato.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────────────────
 *
 * El token de un inquilino dura **15 días**. La regla de qué puede hacer con él después de
 * que su contrato termina no vive en un middleware: se aplica **endpoint por endpoint**, con
 * `exigirContratoActivo`. Eso es deliberado —la lectura NO se gatea, un ex-inquilino tiene que
 * poder ver su contrato pasado— pero tiene un costo: **nada impide que un endpoint nuevo nazca
 * sin el gate**, y nadie se entera hasta que alguien lo audita a mano.
 *
 * Y auditar a mano no funciona. Al escribir este test se hicieron TRES barridos independientes
 * de la misma superficie:
 *
 *   - a mano, mirando los 4 archivos "obvios"  → 12 endpoints (se comió 3 archivos enteros)
 *   - con agentes en paralelo, un archivo cada uno → 12 endpoints (se comió 2 archivos)
 *   - parseando de verdad                       → **17 endpoints**
 *
 * Los cinco que se escapaban no eran raros, eran invisibles a un grep:
 *
 *   1. `anuncios.ts` registra sus handlers **en un loop**, con la ruta en template literal:
 *      ``app.post(`/anuncios/:id/${accion}`)``. Un regex de comillas simples no los ve.
 *   2. `uploads.ts` usa un guard **local propio** (`requireAuthOProfesional`), no los estándar.
 *   3. `POST /reportes` usa `requireAuth` pelado — que **acepta tokens de inquilino**.
 *
 * ── QUÉ AFIRMA ─────────────────────────────────────────────────────────────────────────
 *
 * Que toda escritura alcanzable por un inquilino esté declarada en una de las dos tablas de
 * abajo. **Este test no decide la política: obliga a declararla.** Es un registro de
 * decisiones ejecutable.
 *
 * SI TE FALLA porque agregaste un endpoint: no lo saques del parser. Decidí de qué lado está
 * y anotalo, con el motivo. Si muta la relación VIVA (crear una obligación, emitir una
 * credencial, gestionar co-inquilinos) va gateado. Si actúa sobre algo que YA existe, o sobre
 * datos de la persona que sobreviven al contrato, va exento con el motivo escrito.
 *
 * ── LO QUE NO PRUEBA, sin maquillaje ───────────────────────────────────────────────────
 *
 * Lee la FORMA del código, no el comportamiento. Un `exigirContratoActivo(...)` cuyo resultado
 * se ignorara pasaría en verde. No reemplaza un test de integración que verifique el 409 real
 * contra un contrato FINALIZADO: lo complementa, agarrando el caso que aquél no puede agarrar
 * —el endpoint que todavía no tiene ningún test—.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR_RUTAS = join(import.meta.dirname, '..', 'src', 'routes');

/**
 * Escrituras que SÍ exigen contrato ACTIVO. Todas crean una obligación nueva, emiten una
 * credencial o gestionan quién más entra al contrato.
 */
const GATEADOS = new Set([
  'POST /co-inquilinos',
  'POST /co-inquilinos/:id/link',
  'POST /co-inquilinos/:id/aceptar',
  'PATCH /co-inquilinos/:id/permiso',
  'DELETE /co-inquilinos/:id',
  'POST /boletas',
  'POST /pagos/informar',
  'POST /mis-reclamos',
]);

/**
 * Escrituras EXENTAS, con el motivo. El motivo es el punto: sin él, la tabla se convierte en
 * el lugar donde uno tira lo que le molesta que falle.
 */
const EXENTOS = new Map<string, string>([
  [
    'POST /mis-reclamos/:id/mensaje',
    'Acción sobre un reclamo YA EXISTENTE. Cortarla dejaría varado un reclamo en curso cuando ' +
      'el contrato termina en el medio. Política escrita en el comentario de POST /mis-reclamos.',
  ],
  [
    'POST /mis-reclamos/:id/confirmar-resolucion',
    'Ídem: confirma la resolución de un reclamo abierto durante la vigencia. Ya gatea el estado ' +
      'del RECLAMO (409 si no está RESUELTO), que es el control que corresponde acá.',
  ],
  [
    'POST /mis-reclamos/:id/rating',
    'Ídem: califica un trabajo ya hecho. Gatea el estado del RECLAMO (RESUELTO o CERRADO).',
  ],
  [
    'PUT /mis-datos/avatar',
    'Datos de la PERSONA, no de la relación contractual: sobreviven al contrato a propósito. ' +
      'Gatearlo rompería a alguien que renovó o firmó otro alquiler.',
  ],
  [
    'POST /mis-documentos',
    'Carpeta de la PERSONA: `Documento` está scopeado a `inquilinoId`, no a `contratoId` — ni ' +
      'siquiera tiene ese campo.',
  ],
  [
    'DELETE /mis-documentos/:id',
    'Ídem, y son SUS papeles (DNI, recibo de sueldo, garante). Si la inmobiliaria necesita ' +
      'conservarlos para un reclamo posterior, el corte correcto es una política de retención, ' +
      'no el estado del contrato.',
  ],
  [
    'POST /anuncios/:id/${accion}',
    'Acusar recibo (leído / enterado) de un aviso que le mandaron a él. Las audiencias masivas ' +
      'ya exigen contrato ACTIVO en `aplicaAlContrato`; la única que no es CONTRATOS_ESPECIFICOS, ' +
      'que es justamente el aviso dirigido a ese contrato.',
  ],
  [
    'POST /reportes',
    'Canal de feedback (ReportePiloto). No toca la relación contractual.',
  ],
  [
    'POST /uploads',
    'Sumidero genérico de archivos, compartido con el panel y con el profesional por link. ' +
      'Gatearlo por contrato activo rompería subir un documento propio, que POST /mis-documentos ' +
      'permite a propósito. Su problema real es otro y no es éste: NO tiene cuota por usuario ' +
      'sobre un Volume compartido. Anotado aparte.',
  ],
]);

/** El cuerpo del handler, contando llaves. Cortar "hasta el próximo app." da falsos positivos. */
function cuerpoDelHandler(src: string, desdeIdx: number): string {
  const abre = src.indexOf('{', src.indexOf('=>', desdeIdx));
  if (abre < 0) return '';
  let d = 0;
  for (let i = abre; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}' && --d === 0) return src.slice(abre, i + 1);
  }
  return src.slice(abre);
}

/** Acepta la ruta entre comillas simples O backticks (anuncios.ts registra en un loop). */
const RE_HANDLER = /app\.(post|put|patch|delete)\(\s*['`]([^'`]+)['`]/g;
/** Guards que un token de inquilino puede atravesar. `requireAuth` pelado también. */
const ALCANZA_INQUILINO = /require(Inquilino|ContratoAcceso|Auth)\(|requireAuthOProfesional\(/;
/** Guards de otros kinds. Si el handler usa uno de éstos y ninguno de inquilino, no aplica. */
const OTRO_KIND = /requireUsuario\(|requirePropietario\(|requireProfesionalVisita\(|requirePersona\(/;

interface Escritura {
  clave: string;
  archivo: string;
  linea: number;
  gatea: boolean;
}

function escriturasDelInquilino(): Escritura[] {
  const out: Escritura[] = [];
  for (const f of readdirSync(DIR_RUTAS).filter((x) => x.endsWith('.ts')).sort()) {
    const src = readFileSync(join(DIR_RUTAS, f), 'utf8');
    for (const m of src.matchAll(RE_HANDLER)) {
      const cuerpo = cuerpoDelHandler(src, m.index!);
      if (!ALCANZA_INQUILINO.test(cuerpo)) continue;
      if (OTRO_KIND.test(cuerpo) && !/require(Inquilino|ContratoAcceso)\(/.test(cuerpo)) continue;
      out.push({
        clave: `${m[1]!.toUpperCase()} ${m[2]}`,
        archivo: f,
        linea: src.slice(0, m.index!).split('\n').length,
        // El gate puede estar por helper o comparado a mano: las dos formas valen.
        gatea: /exigirContratoActivo\(/.test(cuerpo) || /estado\s*!==\s*'ACTIVO'/.test(cuerpo),
      });
    }
  }
  return out;
}

describe('escrituras del inquilino · registro de decisiones', () => {
  const escrituras = escriturasDelInquilino();

  it('el parser encuentra la superficie completa, no sólo los archivos obvios', () => {
    // Un cambio que haga caer el parser a la mitad dejaría el resto de los tests en verde por
    // vacuidad — que es exactamente el modo de falla que este archivo viene a evitar.
    expect(escrituras.length).toBeGreaterThanOrEqual(17);
    const archivos = new Set(escrituras.map((e) => e.archivo));
    // Los tres que se escaparon de los barridos a mano.
    expect(archivos).toContain('anuncios.ts');
    expect(archivos).toContain('uploads.ts');
    expect(archivos).toContain('mi-perfil.ts');
  });

  it('toda escritura del inquilino está DECLARADA de un lado o del otro', () => {
    const sinDeclarar = escrituras
      .filter((e) => !GATEADOS.has(e.clave) && !EXENTOS.has(e.clave))
      .map((e) => `${e.clave}  (${e.archivo}:${e.linea})`);

    expect(
      sinDeclarar,
      `Estas escrituras del inquilino no están declaradas:\n  ${sinDeclarar.join('\n  ')}\n\n` +
        'Decidí de qué lado está cada una y anotala en GATEADOS o en EXENTOS (con el motivo).\n' +
        'Muta la relación VIVA (crea una obligación, emite una credencial, gestiona co-inquilinos)\n' +
        '  → GATEADOS, y agregá exigirContratoActivo() al handler.\n' +
        'Actúa sobre algo YA existente, o sobre datos de la persona que sobreviven al contrato\n' +
        '  → EXENTOS, con el motivo escrito.',
    ).toEqual([]);
  });

  it('las declaradas GATEADAS realmente controlan el estado del contrato', () => {
    const mienten = escrituras
      .filter((e) => GATEADOS.has(e.clave) && !e.gatea)
      .map((e) => `${e.clave}  (${e.archivo}:${e.linea})`);

    expect(
      mienten,
      `Declaradas como gateadas, pero el handler no controla el estado del contrato:\n  ${mienten.join('\n  ')}`,
    ).toEqual([]);
  });

  it('las declaradas EXENTAS tienen un motivo escrito, no una lista pelada', () => {
    // Sin esto, EXENTOS se convierte en el tacho donde va lo que molesta que falle.
    for (const [ruta, motivo] of EXENTOS) {
      expect(motivo.length, `${ruta} está exenta sin un motivo de verdad`).toBeGreaterThan(60);
    }
  });

  it('las tablas no acumulan rutas muertas', () => {
    // Una entrada que ya no corresponde a ningún endpoint es ruido que hace parecer cubierto
    // lo que no existe, y esconde que alguien renombró una ruta.
    const vivas = new Set(escrituras.map((e) => e.clave));
    const muertas = [...GATEADOS, ...EXENTOS.keys()].filter((r) => !vivas.has(r));
    expect(muertas, `Declaradas pero ya no existen (¿se renombraron?):\n  ${muertas.join('\n  ')}`).toEqual([]);
  });
});
