/**
 * TERCERA AUDITORÍA · El inventario de columnas de archivo estaba incompleto, y su docstring
 * decía que no.
 *
 * `archivoSigueEnUso` (`routes/uploads.ts`) promete, con estas palabras: «Chequea TODAS las
 * columnas que guardan una URL de archivo» y «Si mañana se agrega una columna de URL nueva,
 * va acá — es el ÚNICO lugar que hay que tocar». Miraba 16 de 18. Faltaban
 * `VisitaProfesional.fotoAntes` y `fotoDespues`.
 *
 * Y la asimetría la escribe el propio archivo: «un falso "sí está en uso" sólo deja un archivo
 * de más en el Volume (barato y reversible); un falso "no está en uso" DESTRUYE un archivo
 * ajeno. Irreversible». O sea que un hueco en esta lista no es un bug de más o de menos: es
 * borrado de datos.
 *
 * ESTE TEST ES EL ARREGLO DE VERDAD. Agregar los dos `count` cierra el agujero de hoy; lo que
 * impide el de mañana es que la promesa la verifique alguien. El test LEE `schema.prisma`,
 * enumera cada columna que guarda una URL de archivo, y exige que aparezca en la función.
 * Si alguien agrega una columna nueva y se olvida de la lista, este test se lo dice.
 *
 * Es PURO: lee dos archivos de texto, no toca la base ni levanta la app.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando el `count` de
 * `visitaProfesional.fotoDespues` de `archivoSigueEnUso`, el primer caso falla y NOMBRA la
 * columna que falta.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const leer = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const SCHEMA = leer('../prisma/schema.prisma');
const UPLOADS = leer('../src/routes/uploads.ts');

/**
 * Columnas que el barrido encuentra y que NO van en `archivoSigueEnUso`, cada una con su
 * motivo. Es corta a propósito: si mañana crece, es señal de que alguien está silenciando el
 * guard en vez de contestar la pregunta.
 */
const FUERA_DEL_INVENTARIO: Record<string, string> = {
  // Guardan el nombre ORIGINAL que tenía el archivo en la máquina de quien lo subió
  // ("contrato-firmado.pdf"), para mostrarlo. No son URLs y no apuntan a nada del Volume.
  'ImportacionCartera.nombreArchivo': 'es el nombre para mostrar, no una URL',
  'DocumentoContrato.nombreArchivo': 'es el nombre para mostrar, no una URL',
  'BoletaServicio.nombreArchivo': 'es el nombre para mostrar, no una URL',
  // El ledger de subidas: tiene UNA fila por archivo subido, así que contarla haría que la
  // función devolviera `true` SIEMPRE y no se borraría nunca nada. La exclusión es el diseño.
  'ArchivoSubido.url': 'es el registro de la subida: contarlo haría que nada se borre nunca',
};

/** Toda columna String de `schema.prisma` cuyo nombre dice que guarda un archivo. */
function columnasDeArchivo(): { modelo: string; columna: string }[] {
  const out: { modelo: string; columna: string }[] = [];
  let modelo: string | null = null;
  for (const linea of SCHEMA.split('\n')) {
    const abre = /^model (\w+) \{/.exec(linea);
    if (abre) {
      modelo = abre[1] ?? null;
      continue;
    }
    if (linea.startsWith('}')) {
      modelo = null;
      continue;
    }
    if (!modelo) continue;
    const campo = /^\s+(\w+)\s+String\??\s/.exec(`${linea} `);
    if (!campo) continue;
    const columna = campo[1];
    if (!columna) continue;
    if (!/[Uu]rl$|[Ff]oto|[Pp]df|[Aa]rchivo|[Ii]mage/.test(columna)) continue;
    out.push({ modelo, columna });
  }
  return out;
}

/** `Inquilino` → `inquilino`, para comparar con `prisma.inquilino.count(...)`. */
const aCliente = (modelo: string) => modelo.charAt(0).toLowerCase() + modelo.slice(1);

describe('el inventario de archivos está completo', () => {
  const columnas = columnasDeArchivo();

  it('el barrido del schema encuentra algo (si no, el guard no probaría nada)', () => {
    // Si el regex deja de matchear —renombraron los campos, cambió el formato del schema—,
    // el resto de los casos pasarían vacíos y en verde sin haber mirado nada.
    expect(columnas.length).toBeGreaterThanOrEqual(18);
  });

  it('cada columna de archivo del schema está en archivoSigueEnUso, o justificada', () => {
    const faltantes: string[] = [];
    for (const { modelo, columna } of columnas) {
      const clave = `${modelo}.${columna}`;
      if (clave in FUERA_DEL_INVENTARIO) continue;
      // `prisma.visitaProfesional.count({ where: { fotoAntes: url } })` y también la forma
      // `prisma.reportePiloto.count({ where: { url } })`.
      const cliente = aCliente(modelo);
      const cuenta = new RegExp(
        `prisma\\.${cliente}\\.count\\(\\{\\s*where:\\s*\\{[^}]*\\b${columna}\\b`,
      );
      if (!cuenta.test(UPLOADS)) faltantes.push(clave);
    }
    // Con el bug: ['VisitaProfesional.fotoAntes', 'VisitaProfesional.fotoDespues'] — y ese
    // hueco borraba del disco las fotos de la visita del profesional.
    expect(faltantes).toEqual([]);
  });

  it('y la lista de exclusiones no crece sola', () => {
    // Cada entrada de `FUERA_DEL_INVENTARIO` tiene que seguir existiendo en el schema: una
    // exclusión que ya no corresponde a ninguna columna es una excusa vieja tapando otra cosa.
    const existentes = new Set(columnas.map((c) => `${c.modelo}.${c.columna}`));
    for (const clave of Object.keys(FUERA_DEL_INVENTARIO)) {
      expect(existentes.has(clave), `${clave} ya no existe en el schema`).toBe(true);
    }
    expect(Object.keys(FUERA_DEL_INVENTARIO)).toHaveLength(4);
  });
});
