'use client';

/**
 * Documentos de la propiedad (todos los contratos, actual + históricos) en modo API.
 * Reemplaza el placeholder "Próximamente" del tab Documentos. Lista con descarga vía
 * urlDeArchivo (agrega el token de /uploads).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { FileText, Download } from 'lucide-react';
import { usePropiedadDocumentos } from '@/lib/api/use-propiedad-expediente';
import { urlDeArchivo } from '@/lib/api/client';
import { formatFecha } from '@/lib/format';

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentosPropiedadPanel({ propiedadId }: { propiedadId: string }) {
  const { data } = usePropiedadDocumentos(propiedadId);
  if (!data) return null;

  if (data.documentos.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Sin documentos en los contratos de esta propiedad</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Los documentos se cargan desde el detalle de cada contrato.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Documentos ({data.documentos.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul role="list" className="divide-y">
          {data.documentos.map((d) => {
            const href = urlDeArchivo(d.archivoUrl);
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.etiqueta || d.nombreArchivo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.nombreArchivo} · {tamano(d.tamanioBytes)} · {formatFecha(d.subidoAt.slice(0, 10))}
                      {d.inquilino ? ` · ${d.inquilino}` : ''}
                    </p>
                  </div>
                </div>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-primary hover:underline"
                    title="Descargar"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
