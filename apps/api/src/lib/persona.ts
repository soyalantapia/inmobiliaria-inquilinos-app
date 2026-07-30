import type { Prisma, Persona } from '@prisma/client';

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
  const dni = (d.dni ?? '').trim() || null;
  const email = d.email ? d.email.trim().toLowerCase() || null : null;

  if (dni) {
    return tx.persona.upsert({
      where: { inmobiliariaId_dni: { inmobiliariaId: d.inmobiliariaId, dni } },
      update: {},
      create: {
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
    // Sin DNI: el email es la única pista de identidad. find-or-create explícito (NO un
    // upsert por email) porque acá no hay columna unique de Postgres sobre la que apoyarse
    // de forma atómica sin arriesgar un create() ciego chocando contra el unique de otra
    // Persona con el mismo email.
    const existente = await tx.persona.findFirst({ where: { inmobiliariaId: d.inmobiliariaId, email } });
    if (existente) return existente;
    return tx.persona.create({
      data: { inmobiliariaId: d.inmobiliariaId, email, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono },
    });
  }

  return tx.persona.create({
    data: { inmobiliariaId: d.inmobiliariaId, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono },
  });
}
