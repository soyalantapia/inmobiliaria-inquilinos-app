'use client';

/**
 * El expediente de un contrato visto como una sola cosa: los documentos que ya
 * están cargados, los garantes reales y qué papeles faltan.
 *
 * Existe porque el estado del expediente se muestra en DOS lugares que no se
 * ven entre sí: el badge del tab "Documentos" (que tiene que decir cuántos
 * papeles faltan sin que nadie abra el tab) y el checklist de adentro del
 * panel. Si cada uno compusiera las piezas por su cuenta —los documentos, la
 * cantidad de garantes, la fórmula— alcanzaría con que uno se olvidara de un
 * detalle para que la pantalla mostrara dos números distintos del mismo
 * contrato, y no habría forma de saber cuál es el bueno.
 *
 * El detalle fácil de olvidar es justamente el de los garantes: en demo no
 * existe `GET /contratos/:id/garantes`, así que la cantidad real no se puede
 * saber y se asume 1 (es lo que venía haciendo el panel).
 */

import { useMemo } from 'react';
import { faltantesDeExpediente, MAX_GARANTES, type ResumenExpediente } from '@/lib/documentos-requeridos';
import { useDocsContrato, type NuevoDocInput } from './use-documentos';
import { useGarantes } from './use-garantes';
import type { DocContrato } from '@/lib/contrato-documentos-storage';

export interface ExpedienteContrato {
  docs: DocContrato[];
  /** Qué falta y cuánto hay, ya calculado sobre `garantesCount`. */
  resumen: ResumenExpediente;
  /** Los garantes que el contrato tiene de verdad (1 en demo, ver arriba). */
  garantesReales: number;
  /** Los que se usaron para el cálculo: los reales, salvo override visual. */
  garantesCount: number;
  /** Si se puede saber la cantidad real de garantes (falso en demo). */
  garantesDisponibles: boolean;
  /**
   * Terminaron de resolver las dos consultas. Antes de eso no hay que pintar
   * ningún "X de Y": el número salta de uno provisorio al real y se lee como
   * un bug.
   */
  listo: boolean;
  subir: (input: NuevoDocInput) => Promise<void>;
  eliminar: (doc: DocContrato) => Promise<void>;
}

/**
 * @param garantesOverride cantidad de garantes a suponer, para el selector del
 * panel que deja ver qué pasaría con un garante más antes de darlo de alta.
 * `null` = la cantidad real, que es lo que corresponde en cualquier lectura que
 * no sea ese selector.
 */
export function useExpedienteContrato(
  contratoId: string,
  garantesOverride: number | null = null,
): ExpedienteContrato {
  const { docs, hidratado, subir, eliminar } = useDocsContrato(contratoId);
  const {
    garantes,
    disponible: garantesDisponibles,
    cargando: garantesCargando,
  } = useGarantes(contratoId);

  /**
   * 🔴 Los garantes NO salen solo de la tabla `Garante`: el alta sube los papeles
   * con su `garanteIndex` pero NUNCA crea la fila (el wizard no tiene paso de
   * garantes y `POST /contratos` no los recibe — las filas nacen únicamente desde
   * el tab Garantes, `core.ts:1988`).
   *
   * Mirando solo `garantes.length` un contrato recién dado de alta con 2 garantes
   * declarados daba CERO requeridos de garante: el checklist marcaba 100% y el
   * badge desaparecía con los DNI faltando. Es el mismo falso verde que esta
   * entrega vino a matar, entrando por otra puerta.
   *
   * Por eso se toma el MÁXIMO entre las filas reales y el mayor `garanteIndex`
   * que ya tenga un papel subido: los documentos son evidencia de que ese garante
   * existe, aunque nadie haya cargado su ficha. De paso arregla que el detalle
   * dibujaba un solo grupo y escondía los papeles del garante 2 y 3.
   */
  const garantesPorDocs = docs.reduce(
    (max, d) => (d.garanteIndex != null && d.garanteIndex > max ? d.garanteIndex : max),
    0,
  );
  const garantesReales = Math.min(
    MAX_GARANTES,
    Math.max(garantesDisponibles ? garantes.length : 1, garantesPorDocs),
  );
  const garantesCount = garantesOverride ?? garantesReales;

  const resumen = useMemo(
    () => faltantesDeExpediente(docs, garantesCount),
    [docs, garantesCount],
  );

  return {
    docs,
    resumen,
    garantesReales,
    garantesCount,
    garantesDisponibles,
    listo: hidratado && !(garantesDisponibles && garantesCargando),
    subir,
    eliminar,
  };
}
