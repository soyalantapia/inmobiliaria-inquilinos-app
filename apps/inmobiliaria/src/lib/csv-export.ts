'use client';

/**
 * Genera y descarga un CSV en el navegador sin tocar backend. Compatible
 * con Excel y Google Sheets: usa coma como separador, comillas dobles
 * para escapar valores con comas/saltos de línea, y el BOM UTF-8 al
 * inicio para que Excel lo abra con acentos correctos.
 */

export interface CsvExportInput {
  /** Nombre del archivo sin extensión. Ej: "facturas-mayo-2026". */
  filename: string;
  /** Headers de la primera fila. */
  headers: string[];
  /** Filas — cada fila es un array de strings/números. */
  rows: (string | number | null | undefined)[][];
}

/** Escapa un valor CSV agregando comillas si tiene caracteres especiales. */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Construye el contenido CSV listo para descargar. */
export function buildCsv(input: CsvExportInput): string {
  const lines = [
    input.headers.map(escapeCell).join(','),
    ...input.rows.map((row) => row.map(escapeCell).join(',')),
  ];
  return lines.join('\n');
}

/** Dispara la descarga en el navegador. */
export function descargarCsv(input: CsvExportInput): void {
  if (typeof window === 'undefined') return;
  const csv = buildCsv(input);
  // BOM UTF-8 para que Excel respete acentos al abrir.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${input.filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberamos el objeto URL tras un tick para que algunos browsers no
  // cancelen la descarga prematuramente.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
