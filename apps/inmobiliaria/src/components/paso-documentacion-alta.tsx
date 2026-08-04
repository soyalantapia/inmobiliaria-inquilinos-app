'use client';

/**
 * Paso "Documentación" del alta de contrato.
 *
 * Vive fuera de `contratos/nuevo/page.tsx` porque ese archivo ya pasa las 3.000
 * líneas: sumarle el JSX de tres bloques de archivos lo volvía inmanejable. El
 * estado sigue siendo del wizard (el borrador y la subida post-alta lo
 * necesitan); acá solo se dibuja.
 *
 * Lo que NO hace, a propósito: no bloquea. Un expediente incompleto es el caso
 * NORMAL de la cartera vieja que este cliente está migrando — los papeles están
 * en una carpeta de cartón, no escaneados. Si el paso frenara el alta, el
 * operador cargaría contratos falsos para poder seguir. Por eso el aviso de
 * faltantes es informativo y en `muted`, nunca `destructive`.
 *
 * Tampoco sube nada: no existe `contratoId` hasta que responde POST /contratos.
 * Los archivos viajan al expediente DESPUÉS del alta (ver `dar_de_alta`).
 */

import { useState } from 'react';
import { ArrowLeft, ArrowRight, FileUp, X } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import {
  TAMANIO_MAX,
  TIPO_DOC_LABEL,
  formatTamanio,
  type TipoDocContrato,
} from '@/lib/contrato-documentos-storage';
import {
  DOCS_REQUERIDOS_POR_GARANTE,
  DOCS_REQUERIDOS_TITULAR,
  MAX_GARANTES,
  claveDocumento,
  enumerarFaltantes,
  faltantesDeExpediente,
} from '@/lib/documentos-requeridos';

/** Un papel elegido en el wizard, listo para subirse cuando exista el contrato. */
export interface DocElegido {
  file: File;
  tipo: TipoDocContrato;
  /** 1-based. Solo en papeles de garante. */
  garanteIndex?: number;
  /** Lo que va al campo `etiqueta` del DocumentoContrato. */
  etiqueta: string;
}

/**
 * Los papeles del alta, indexados por `claveDocumento` (tipo + garante).
 *
 * Un objeto y no 20 `useState` sueltos: son 4 del titular + hasta 3×3 de
 * garantes + 11 tipos sueltos, y el wizard ya arrastra 42 estados planos.
 */
export type DocsElegidos = Record<string, DocElegido>;

/** El recibo del garante se ofrece pero NO es requerido — ver `documentos-requeridos.ts`. */
const OPCIONALES_POR_GARANTE: readonly TipoDocContrato[] = ['RECIBO_GARANTE'];

const TIPOS_CON_BLOQUE_PROPIO: readonly TipoDocContrato[] = [
  ...DOCS_REQUERIDOS_TITULAR,
  ...DOCS_REQUERIDOS_POR_GARANTE,
  ...OPCIONALES_POR_GARANTE,
];

/**
 * Los tipos que quedan para "Otros papeles". Se DERIVAN del catálogo en vez de
 * escribirse a mano: si mañana se suma un tipo al enum, aparece solo acá y no
 * hay una segunda lista para actualizar.
 */
const TIPOS_OTROS = (Object.keys(TIPO_DOC_LABEL) as TipoDocContrato[]).filter(
  (t) => !TIPOS_CON_BLOQUE_PROPIO.includes(t),
);

/** Un file input compacto para un papel del expediente (foto o PDF) del wizard. */
export function DniFileInput({
  id,
  label,
  file,
  onPick,
}: {
  id: string;
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  // El tamaño se valida acá y no al confirmar: la subida ocurre DESPUÉS del alta,
  // así que un archivo pasado de tope no fallaba al elegirlo sino en un 413 al
  // final, con el contrato ya creado y un toast genérico que no decía cuál de
  // los archivos era el problema.
  const elegir = (f: File) => {
    if (f.size > TAMANIO_MAX) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: `"${f.name}" pesa ${formatTamanio(f.size)}. El máximo es ${formatTamanio(
          TAMANIO_MAX,
        )} por archivo — probá con una foto de menor calidad o un PDF más liviano.`,
      });
      return;
    }
    onPick(f);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {file ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Quitar ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/60"
        >
          <FileUp className="h-3.5 w-3.5" /> Elegir foto o PDF
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) elegir(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

interface Props {
  docs: DocsElegidos;
  /** `file === null` quita el papel. */
  onCambiarDoc: (tipo: TipoDocContrato, garanteIndex: number | undefined, file: File | null) => void;
  garantesCount: number;
  onGarantesCount: (n: number) => void;
  onVolver: () => void;
  onContinuar: () => void;
}

export function PasoDocumentacionAlta({
  docs,
  onCambiarDoc,
  garantesCount,
  onGarantesCount,
  onVolver,
  onContinuar,
}: Props) {
  // Qué tipo suelto está por adjuntarse. Es estado de la pantalla, no del
  // contrato: no entra al borrador ni viaja al alta.
  const [tipoOtro, setTipoOtro] = useState<TipoDocContrato | ''>('');

  const archivoDe = (tipo: TipoDocContrato, garanteIndex?: number): File | null =>
    docs[claveDocumento(tipo, garanteIndex)]?.file ?? null;

  // Sobre los File en memoria, NO sobre la API: todavía no hay contratoId que
  // consultar. Es la misma fórmula que usa el checklist del detalle.
  const expediente = faltantesDeExpediente(
    Object.values(docs).map((d) => ({ tipo: d.tipo, garanteIndex: d.garanteIndex })),
    garantesCount,
  );

  const otrosCargados = Object.values(docs).filter((d) => TIPOS_OTROS.includes(d.tipo));

  const inputDe = (tipo: TipoDocContrato, garanteIndex?: number) => (
    <DniFileInput
      key={claveDocumento(tipo, garanteIndex)}
      id={`doc-${claveDocumento(tipo, garanteIndex).toLowerCase().replace('::', '-')}`}
      label={TIPO_DOC_LABEL[tipo]}
      file={archivoDe(tipo, garanteIndex)}
      onPick={(f) => onCambiarDoc(tipo, garanteIndex, f)}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentación del contrato</CardTitle>
        <CardDescription>
          Todo lo que cargues acá queda en el expediente del contrato. Es opcional: podés dar
          de alta sin nada y sumarlo después desde el detalle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Titular */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm font-medium">Inquilino titular</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DOCS_REQUERIDOS_TITULAR.map((t) => inputDe(t))}
          </div>
        </div>

        {/* Garantes */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Garantes</p>
              {/* Decirlo evita el malentendido caro: acá no se está dando de alta
                  a ninguna persona garante, solo se guardan sus papeles. */}
              <p className="text-xs text-muted-foreground">
                Elegí cuántos son para cargarles el DNI. Los datos del garante se cargan
                después, desde el detalle del contrato.
              </p>
            </div>
            <Select
              value={String(garantesCount)}
              onValueChange={(v) => onGarantesCount(parseInt(v, 10))}
            >
              <SelectTrigger id="alta-garantes-count" className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_GARANTES + 1 }, (_, n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? 'Sin garantes' : `${n} ${n === 1 ? 'garante' : 'garantes'}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {garantesCount === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin garantes: no pedimos ningún papel de garante en el checklist.
            </p>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: garantesCount }, (_, i) => i + 1).map((g) => (
                <div key={g} className="space-y-2 rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-medium">Garante {g}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {DOCS_REQUERIDOS_POR_GARANTE.map((t) => inputDe(t, g))}
                    {OPCIONALES_POR_GARANTE.map((t) => inputDe(t, g))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Otros papeles */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm font-medium">
            Otros papeles <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          {otrosCargados.length > 0 && (
            <ul className="space-y-1">
              {otrosCargados.map((d) => (
                <li
                  key={claveDocumento(d.tipo, d.garanteIndex)}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs"
                >
                  <span className="truncate">
                    <span className="font-medium">{d.etiqueta}</span>{' '}
                    <span className="text-muted-foreground">· {d.file.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onCambiarDoc(d.tipo, d.garanteIndex, null)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Quitar ${d.etiqueta}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="doc-otro-tipo" className="text-xs text-muted-foreground">
                Tipo de documento
              </Label>
              <Select value={tipoOtro} onValueChange={(v) => setTipoOtro(v as TipoDocContrato)}>
                <SelectTrigger id="doc-otro-tipo">
                  <SelectValue placeholder="Elegí el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_OTROS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_DOC_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipoOtro && (
              <DniFileInput
                id="doc-otro-archivo"
                label={TIPO_DOC_LABEL[tipoOtro]}
                file={archivoDe(tipoOtro)}
                onPick={(f) => {
                  onCambiarDoc(tipoOtro, undefined, f);
                  // El tipo vuelve a cero para que el siguiente papel arranque
                  // limpio; el que se acaba de elegir ya está en la lista de arriba.
                  if (f) setTipoOtro('');
                }}
              />
            )}
          </div>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Fotos o PDF de hasta {formatTamanio(TAMANIO_MAX)} cada uno. Un Word escaneado no
            entra: sacale una foto o exportalo a PDF.
          </p>
          {/* Sin esta línea el operador cree que los archivos quedaron guardados.
              Un File no se puede serializar a localStorage: al restaurar se vería
              el nombre de un archivo que ya no existe y el alta subiría nada. */}
          <p>
            Los archivos no se guardan en el borrador. Si cerrás la página los vas a tener que
            volver a elegir.
          </p>
        </div>

        {/* Informativo, nunca destructive: que falten papeles no es un error, es
            el estado normal de un contrato de cartera vieja. */}
        <p className="text-xs text-muted-foreground">
          {expediente.faltantes.length === 0
            ? `Están los ${expediente.total} papeles del expediente.`
            : `${expediente.faltantes.length === 1 ? 'Te falta' : 'Te faltan'} ${
                expediente.faltantes.length
              } de ${expediente.total} papeles: ${enumerarFaltantes(
                expediente.faltantes,
              )}. Podés dar de alta igual y cargarlos después desde el detalle del contrato.`}
        </p>

        <div className="flex justify-between border-t pt-4">
          <Button variant="ghost" onClick={onVolver}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          {/* Pelado: sin disabled y sin gate. La documentación NUNCA frena el alta. */}
          <Button onClick={onContinuar}>
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
