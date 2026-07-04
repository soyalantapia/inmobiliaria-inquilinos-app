'use client';

import { FileText, IdCard, ImageIcon, ShieldCheck, Wallet } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import {
  useDocumentosInquilino,
  type CategoriaDocumentoInquilino,
} from '@/lib/api/use-documentos-inquilino';
import { formatFechaCorta } from '@/lib/format';

const ICONO: Record<CategoriaDocumentoInquilino, typeof FileText> = {
  IDENTIDAD: IdCard,
  INGRESOS: Wallet,
  GARANTE: ShieldCheck,
  OTRO: FileText,
};

const LABEL: Record<CategoriaDocumentoInquilino, string> = {
  IDENTIDAD: 'Identidad',
  INGRESOS: 'Ingresos',
  GARANTE: 'Garante',
  OTRO: 'Otro',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Documentos que el inquilino subió desde su app (DNI, recibos, garante) —
 * solo lectura. Distinto del expediente que carga la inmobiliaria
 * (ContratoDocumentosPanel, editable).
 */
export function DocumentosInquilinoPanel({ contratoId }: { contratoId: string | undefined }) {
  const { documentos, cargando } = useDocumentosInquilino(contratoId);

  if (cargando) return null;
  if (documentos.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium">Documentos del inquilino</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Todavía no subió DNI, recibos ni documentación de garante desde su app.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Documentos del inquilino</p>
          <Badge variant="outline" className="text-[10px]">
            {documentos.length}
          </Badge>
        </div>
        <div className="divide-y rounded-md border">
          {documentos.map((d) => {
            const Icon = ICONO[d.categoria];
            const esImagen = d.tipoMime.startsWith('image/');
            return (
              <a
                key={d.id}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-3 text-sm hover:bg-muted/40"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  {esImagen ? <ImageIcon className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-medium">{d.slot?.titulo ?? d.nombre}</p>
                    <Badge variant="outline" className="text-[9px]">
                      {LABEL[d.categoria]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(d.tamanioBytes)} · subido el {formatFechaCorta(d.subidoAt)}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
