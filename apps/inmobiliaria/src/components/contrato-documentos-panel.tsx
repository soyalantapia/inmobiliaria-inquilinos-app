'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Download,
  DoorOpen,
  FileSignature,
  FileText,
  IdCard,
  ImageIcon,
  MessageCircle,
  Paperclip,
  Plus,
  ScrollText,
  ShieldCheck,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
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
  type DocContrato,
  type TipoDocContrato,
  TAMANIO_MAX,
  TIPO_DOC_LABEL,
  eliminarDocContrato,
  formatTamanio,
  guardarDocContrato,
  leerArchivoComoDataUrl,
  listarDocsContrato,
} from '@/lib/contrato-documentos-storage';
import {
  descargarContratoWord,
  imprimirContratoPdf,
  type VariablesContrato,
} from '@/lib/contrato-generator';
import { propietariosMock } from '@/lib/mock-data';
import { sociedadPrincipal } from '@/lib/sociedades-storage';
import { formatFecha } from '@/lib/format';
import type { ContratoListado } from '@/lib/types';

interface Props {
  contrato: ContratoListado;
}

const ICONO_TIPO: Record<TipoDocContrato, typeof FileText> = {
  CONTRATO_FIRMADO: FileSignature,
  DNI_TITULAR_FRENTE: IdCard,
  DNI_TITULAR_DORSO: IdCard,
  DNI_GARANTE_FRENTE: ShieldCheck,
  DNI_GARANTE_DORSO: ShieldCheck,
  RECIBO_SUELDO: Wallet,
  CONVENIO_DESOCUPACION: DoorOpen,
  PAGARE: ScrollText,
  FOTO_WHATSAPP: MessageCircle,
  OTRO: Paperclip,
};

type GrupoUI = {
  key: string;
  titulo: string;
  ayuda: string;
  tipos: TipoDocContrato[];
  garanteIndex?: number;
};

function gruposParaContrato(garantesCount: number): GrupoUI[] {
  const garantes: GrupoUI[] = [];
  for (let i = 1; i <= Math.max(1, garantesCount); i++) {
    garantes.push({
      key: `garante-${i}`,
      titulo: `Garante ${i}`,
      ayuda: 'DNI frente y dorso del garante. Sumá recibo de sueldo si lo pide el propietario.',
      tipos: ['DNI_GARANTE_FRENTE', 'DNI_GARANTE_DORSO', 'RECIBO_SUELDO'],
      garanteIndex: i,
    });
  }
  return [
    {
      key: 'contrato',
      titulo: 'Contrato firmado',
      ayuda: 'Subí el contrato escaneado o usá el generador para descargarlo en Word/PDF.',
      tipos: ['CONTRATO_FIRMADO'],
    },
    {
      key: 'titular',
      titulo: 'Inquilino titular',
      ayuda: 'DNI frente y dorso + recibos de sueldo recientes.',
      tipos: ['DNI_TITULAR_FRENTE', 'DNI_TITULAR_DORSO', 'RECIBO_SUELDO'],
    },
    ...garantes,
    {
      key: 'legales',
      titulo: 'Convenio y pagarés',
      ayuda: 'Convenio de desocupación firmado y pagarés en garantía.',
      tipos: ['CONVENIO_DESOCUPACION', 'PAGARE'],
    },
    {
      key: 'fotos',
      titulo: 'Fotos de WhatsApp y otros',
      ayuda: 'Capturas que mandó el inquilino, fotos de comprobantes, adjuntos varios.',
      tipos: ['FOTO_WHATSAPP', 'OTRO'],
    },
  ];
}

export function ContratoDocumentosPanel({ contrato }: Props) {
  const [docs, setDocs] = useState<DocContrato[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [grupoActivo, setGrupoActivo] = useState<GrupoUI | null>(null);
  const [tipoElegido, setTipoElegido] = useState<TipoDocContrato>('DNI_TITULAR_FRENTE');
  const [garantesCount, setGarantesCount] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDocs(listarDocsContrato(contrato.id));
    setHidratado(true);
  }, [contrato.id]);

  const grupos = useMemo(() => gruposParaContrato(garantesCount), [garantesCount]);

  const docsPorTipo = useMemo(() => {
    const map = new Map<string, DocContrato[]>();
    for (const d of docs) {
      const key =
        d.garanteIndex != null && d.tipo.startsWith('DNI_GARANTE')
          ? `${d.tipo}::g${d.garanteIndex}`
          : d.garanteIndex != null && d.tipo === 'RECIBO_SUELDO'
            ? `${d.tipo}::g${d.garanteIndex}`
            : d.tipo;
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return map;
  }, [docs]);

  const totalReq = useMemo(() => {
    // Requeridos: contrato + DNI titular x2 + DNI garante x2 + recibo titular.
    return 4 + garantesCount * 2;
  }, [garantesCount]);

  const completados = useMemo(() => {
    const tienen = (key: string) => (docsPorTipo.get(key)?.length ?? 0) > 0;
    let c = 0;
    if (tienen('CONTRATO_FIRMADO')) c++;
    if (tienen('DNI_TITULAR_FRENTE')) c++;
    if (tienen('DNI_TITULAR_DORSO')) c++;
    if (tienen('RECIBO_SUELDO')) c++;
    for (let i = 1; i <= garantesCount; i++) {
      if (tienen(`DNI_GARANTE_FRENTE::g${i}`)) c++;
      if (tienen(`DNI_GARANTE_DORSO::g${i}`)) c++;
    }
    return c;
  }, [docsPorTipo, garantesCount]);

  const pct = totalReq === 0 ? 0 : Math.round((completados / totalReq) * 100);

  const abrirUpload = (grupo: GrupoUI, tipo: TipoDocContrato) => {
    setGrupoActivo(grupo);
    setTipoElegido(tipo);
    setTimeout(() => fileRef.current?.click(), 0);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !grupoActivo) return;
    if (file.size > TAMANIO_MAX) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: `El archivo pesa ${formatTamanio(file.size)}. Subí algo de hasta ${formatTamanio(
          TAMANIO_MAX,
        )}.`,
      });
      e.target.value = '';
      return;
    }
    try {
      const dataUrl = await leerArchivoComoDataUrl(file);
      const nuevo: DocContrato = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        contratoId: contrato.id,
        tipo: tipoElegido,
        etiqueta: `${TIPO_DOC_LABEL[tipoElegido]}${
          grupoActivo.garanteIndex ? ` · Garante ${grupoActivo.garanteIndex}` : ''
        }`,
        garanteIndex: grupoActivo.garanteIndex,
        nombreArchivo: file.name,
        tipoMime: file.type || 'application/octet-stream',
        tamanioBytes: file.size,
        dataUrl,
        subidoAt: new Date().toISOString(),
        subidoPor: 'admin',
      };
      guardarDocContrato(nuevo);
      setDocs(listarDocsContrato(contrato.id));
      toast({
        variant: 'success',
        title: 'Documento cargado',
        description: nuevo.etiqueta,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: 'Probá con un archivo más chico o liberá espacio.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const eliminar = (doc: DocContrato) => {
    eliminarDocContrato(doc.contratoId, doc.id);
    setDocs(listarDocsContrato(contrato.id));
    toast({ title: 'Documento eliminado', description: doc.etiqueta });
  };

  const variables = useMemo<VariablesContrato>(() => {
    const sociedad = sociedadPrincipal();
    return {
      contrato,
      propietarios: propietariosMock.slice(0, 2),
      diaPago: 5,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 6,
      comisionInmobiliariaPct: 4.17,
      depositoGarantia: contrato.monto,
      ciudadFirma: 'Ciudad Autónoma de Buenos Aires',
      sociedad: {
        razonSocial: sociedad.razonSocial,
        cuit: sociedad.cuit,
        direccion: sociedad.domicilioFiscal,
      },
    };
  }, [contrato]);

  if (!hidratado) return null;

  return (
    <div className="space-y-5">
      {/* Generador de contrato */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <FileSignature className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Generar contrato editable</p>
              <p className="text-xs text-muted-foreground">
                Bajá el contrato pre-armado con todos los datos del expediente. El
                Word es editable; el PDF queda listo para firmar.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => descargarContratoWord(variables)}>
              <Download className="h-4 w-4" />
              Descargar Word (.doc)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => imprimirContratoPdf(variables)}
            >
              <FileText className="h-4 w-4" />
              Imprimir / guardar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen completitud */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Checklist del expediente</p>
              <p className="text-xs text-muted-foreground">
                Documentos cargados: {completados} de {totalReq} requeridos.
              </p>
            </div>
            <Badge variant={pct === 100 ? 'success' : 'outline'} className="text-xs">
              {pct}%
            </Badge>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Label htmlFor="garantes-count" className="text-xs">
              Cantidad de garantes
            </Label>
            <Select
              value={String(garantesCount)}
              onValueChange={(v) => setGarantesCount(parseInt(v, 10))}
            >
              <SelectTrigger id="garantes-count" className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {n === 1 ? 'garante' : 'garantes'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grupos de documentos */}
      <div className="space-y-3">
        {grupos.map((g) => {
          const docsDeGrupo = docs.filter((d) => {
            if (!g.tipos.includes(d.tipo)) return false;
            if (g.garanteIndex != null && d.garanteIndex !== g.garanteIndex) {
              return false;
            }
            if (
              g.garanteIndex == null &&
              (d.tipo === 'DNI_GARANTE_FRENTE' || d.tipo === 'DNI_GARANTE_DORSO')
            ) {
              return false;
            }
            return true;
          });

          return (
            <Card key={g.key}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{g.titulo}</p>
                    <p className="text-xs text-muted-foreground">{g.ayuda}</p>
                  </div>
                  {docsDeGrupo.length > 0 && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />
                      {docsDeGrupo.length}
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {g.tipos.map((t) => {
                    const Icon = ICONO_TIPO[t];
                    const lookupKey =
                      g.garanteIndex != null ? `${t}::g${g.garanteIndex}` : t;
                    const yaCargado = (docsPorTipo.get(lookupKey)?.length ?? 0) > 0;
                    return (
                      <Button
                        key={t}
                        type="button"
                        variant={yaCargado ? 'outline' : 'secondary'}
                        size="sm"
                        className="justify-start"
                        onClick={() => abrirUpload(g, t)}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 text-left text-xs">
                          {TIPO_DOC_LABEL[t]}
                        </span>
                        {yaCargado ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    );
                  })}
                </div>

                {docsDeGrupo.length > 0 && (
                  <ul className="divide-y rounded-md border">
                    {docsDeGrupo.map((d) => {
                      const Icon = ICONO_TIPO[d.tipo];
                      const esImagen = d.tipoMime.startsWith('image/');
                      return (
                        <li
                          key={d.id}
                          className="flex items-center gap-3 p-3 text-sm"
                        >
                          {esImagen ? (
                            <img
                              src={d.dataUrl}
                              alt={d.etiqueta}
                              className="h-10 w-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                              <Icon className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">
                              {d.nombreArchivo}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatTamanio(d.tamanioBytes)} ·{' '}
                              {formatFecha(d.subidoAt)}
                            </p>
                          </div>
                          <Button asChild variant="ghost" size="sm">
                            <a
                              href={d.dataUrl}
                              download={d.nombreArchivo}
                              aria-label="Descargar"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => eliminar(d)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,image/heic,image/heif,application/pdf"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}
