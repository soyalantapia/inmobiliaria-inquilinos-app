/**
 * Cómo se rotula, en la rendición del propietario, el arreglo que se le cobra.
 *
 * Existe porque el rótulo se armaba metiéndole el texto libre que escribió el INQUILINO
 * al reportar el problema:
 *
 *     rec.costoTrabajoNotas || `Reparación (plomería): ${rec.descripcion.slice(0, 60)}`
 *
 * Ese string se guarda en `GastoRendido.descripcion` y sale tal cual por el portal del
 * propietario (`portal-propietario.ts`, select de `gastos`) y por el PDF imprimible. O sea:
 * el inquilino describe un problema de su casa creyendo que le habla a la inmobiliaria, y
 * termina leyéndolo el dueño, que ni siquiera es necesariamente el mismo de entonces.
 *
 * El propio código ya había razonado esto para la otra puerta: el bloque que arma
 * `/portal/reclamos` recorta a los contratos vigentes justamente para que "quien compra un
 * departamento en marzo" no lea "los reclamos de 2024 de un inquilino con el que no tuvo
 * ninguna relación, con la descripcion en texto libre que esa persona escribió". Se cerró
 * una de las dos puertas.
 *
 * Al dueño no se le esconde nada que le corresponda: le están cobrando un arreglo y sigue
 * viendo qué se arregló y cuánto. Lo que describe el TRABAJO es `costoTrabajoNotas`, que es
 * el campo que existe para eso y lo escribe el operador sabiendo que se muestra. Lo que se
 * saca es el relato del inquilino sobre su propia casa.
 */
export function descripcionDeReparacion(
  notasDelOperador: string | null | undefined,
  categoria: string,
): string {
  const notas = (notasDelOperador ?? '').trim();
  if (notas) return notas;
  return `Reparación (${categoria.toLowerCase()})`;
}
