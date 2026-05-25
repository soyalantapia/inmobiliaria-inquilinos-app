'use client';

/**
 * Helper de descarga CSV cliente-side para el inquilino. Espejo del que
 * usamos en inmo. Escapa comillas/comas, agrega BOM UTF-8 para que Excel
 * abra los acentos correctamente.
 */

export interface CsvExportInput {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(input: CsvExportInput): string {
  const lines = [
    input.headers.map(escapeCell).join(','),
    ...input.rows.map((row) => row.map(escapeCell).join(',')),
  ];
  return lines.join('\n');
}

export function descargarCsv(input: CsvExportInput): void {
  if (typeof window === 'undefined') return;
  const csv = buildCsv(input);
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${input.filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
