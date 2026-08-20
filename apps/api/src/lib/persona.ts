import type { Prisma, Persona } from '@prisma/client';
import { normalizarDni } from './normalizar-dni.js';

/**
 * Se pidió dar de alta a alguien con un email que ya usa OTRA persona (distinto DNI).
 *
 * `buscarOCrearPersona` devuelve, a propósito, la Persona existente en ese caso: lo necesita la
 * importación de cartera, donde reventar con P2002 a mitad de 2000 filas deja la carga hecha a
 * medias en la cuenta real del cliente, y donde el preview ya marca el caso como advertencia
 * para que el operador lo reconcilie después.
 *
 * En el ALTA MANUAL no aplica ese argumento: hay una persona frente al teclado a la que se le
 * puede preguntar, y `POST /contratos` ya prometía un 409 con ese texto exacto —confiando en
 * que saltara el unique de Persona—. Al compartir este helper, ese 409 quedó inalcanzable y el
 * contrato pasaba a colgar en silencio de la persona equivocada: dos humanos distintos, una
 * sola identidad, sin que nadie se entere. Es la misma línea que `normalizar-dni.ts` cuida
 * cuando dice que no recorta un CUIT a su DNI porque "podría fusionar dos personas distintas".
 */
export class EmailDeOtraPersona extends Error {}

/**
 * ¿La Persona que devolvió `buscarOCrearPersona` es OTRA que la que se está cargando?
 *
 * Sólo se puede afirmar cuando hay DNI de los dos lados y no coinciden. Sin DNI en el alta no
 * se sabe —puede ser el mismo inquilino cargado sin documento— y sin DNI en la Persona tampoco:
 * ahí el helper justamente lo completa. En la duda NO bloquea: rechazar un alta legítima le
 * rompe el día a quien está cargando, y el caso ambiguo ya lo cubre la búsqueda "¿Ya está en tu
 * cartera?".
 */
export function esOtraPersona(dniDelAlta: string | null, dniDeLaPersona: string | null): boolean {
  if (!dniDelAlta || !dniDeLaPersona) return false;
  return dniDelAlta !== dniDeLaPersona;
}

export interface DatosPersonaFila {
  inmobiliariaId: string;
  dni: string | null;
  email: string | null;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
}

/**
 * Find-or-create de Persona: agrupa varios contratos/inquilinos del MISMO inquilino bajo una
 * sola identidad del tenant (multi-alquiler — el mismo inquilino con 3 locales en La Rioja,
 * un propietario con diez departamentos de un consorcio). Prioridad: DNI primero (más
 * estable, ver @@unique([inmobiliariaId, dni]) en el schema), después email (identidad de
 * login, @@unique([inmobiliariaId, email])). Sin ninguno de los dos: Persona nueva, no hay
 * con qué agrupar.
 *
 * COMPARTIDO a propósito entre el alta manual (POST /contratos, core.ts) y la importación de
 * cartera (crearContratoDesdeFila, importaciones-cartera.ts). Con una copia por call site, la
 * importación —que ya no rechaza el email repetido (ver validarFila)— crearía una Persona
 * NUEVA por cada fila del mismo inquilino en vez de reusar la existente, y la 2da fila
 * reventaría con P2002 contra el unique de Persona a mitad de una cartera de 2000 filas,
 * dejándola cargada a medias en la cuenta REAL del cliente.
 */
export async function buscarOCrearPersona(tx: Prisma.TransactionClient, d: DatosPersonaFila): Promise<Persona> {
  // A DÍGITOS, no sólo trim: una ficha importada como '20.123.456' no matcheaba al buscar
  // '20123456' y se creaba una Persona duplicada. El email de abajo ya se normalizaba; el DNI
  // —que es la llave PRINCIPAL de la dedup— se había quedado afuera. Ver lib/normalizar-dni.ts.
  const dni = normalizarDni(d.dni);
  const email = d.email ? d.email.trim().toLowerCase() || null : null;

  if (dni) {
    const porDni = await tx.persona.findUnique({
      where: { inmobiliariaId_dni: { inmobiliariaId: d.inmobiliariaId, dni } },
    });
    if (porDni) return porDni;

    if (email) {
      // El DNI no matcheó ninguna Persona, pero el email SÍ podría estar tomado por otra —
      // p.ej. una fila anterior del MISMO inquilino sin DNI (o un alta manual sin DNI) ya
      // creó Persona{dni:null, email}. Un create() ciego acá reventaría con P2002 contra
      // @@unique([inmobiliariaId, email]) y la fila se perdía como "Email o dato único ya
      // existente" — Y QUEDABA MARCADA COMO PROCESADA (importaciones-cartera.ts), sin forma
      // de reintentarla sin editar antes la planilla.
      //
      // Por eso se chequea ACÁ, antes del create, y no con un try/catch alrededor de un
      // upsert: `buscarOCrearPersona` corre DENTRO de la transacción de Postgres de la fila
      // (crearContratoDesdeFila). Si un statement de esa transacción falla por violación de
      // unique, Postgres deja la transacción en estado "aborted" — cualquier query
      // POSTERIOR en esa misma tx (el fallback de reconciliación) fallaría también con
      // "current transaction is aborted", aunque el error original esté en un catch de JS.
      const porEmail = await tx.persona.findFirst({ where: { inmobiliariaId: d.inmobiliariaId, email } });
      if (porEmail) {
        // Si esa Persona no tenía DNI, es justo el dato que esta fila está aportando:
        // completarlo agrupa la fila bajo la identidad correcta (el caso real: fila 1 sin
        // DNI crea la Persona, fila 2 del mismo inquilino trae el DNI).
        //
        // Si YA tenía uno, tiene que ser DISTINTO al de esta fila (si fuera igual, el
        // findUnique de arriba ya la habría encontrado) — es "mismo email, DNI distinto",
        // que el preview marca como ADVERTENCIA sin bloquear (ver validarFilas en
        // importaciones-cartera.ts). No pisamos un DNI ya confirmado con uno sin confirmar:
        // devolvemos la Persona tal cual y que el operador la reconcilie a mano si resultan
        // ser dos personas distintas.
        if (!porEmail.dni) {
          return tx.persona.update({ where: { id: porEmail.id }, data: { dni } });
        }
        return porEmail;
      }
    }

    return tx.persona.create({
      data: {
        inmobiliariaId: d.inmobiliariaId,
        dni,
        email,
        nombre: d.nombre,
        apellido: d.apellido,
        telefono: d.telefono,
      },
    });
  }

  if (email) {
    // Sin DNI: acá SÍ hay una sola columna unique en juego (inmobiliariaId_email) — el
    // create de este branch nunca setea `dni`, así que no puede chocar con el otro unique
    // como en la rama de arriba. upsert es atómico y correcto.
    return tx.persona.upsert({
      where: { inmobiliariaId_email: { inmobiliariaId: d.inmobiliariaId, email } },
      update: {},
      create: { inmobiliariaId: d.inmobiliariaId, email, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono },
    });
  }

  return tx.persona.create({
    data: { inmobiliariaId: d.inmobiliariaId, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono },
  });
}
