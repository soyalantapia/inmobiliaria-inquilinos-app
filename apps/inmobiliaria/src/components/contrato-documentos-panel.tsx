'use client';

import { useMemo, useRef, useState } from 'react';
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
  formatTamanio,
} from '@/lib/contrato-documentos-storage';
import {
  MAX_GARANTES,
  claveDocumento,
  enumerarFaltantes,
  faltantesDeExpediente,
} from '@/lib/documentos-requeridos';
import { useDocsContrato } from '@/lib/api/use-documentos';
import { useGarantes } from '@/lib/api/use-garantes';
import {
  descargarContratoWord,
  imprimirContratoPdf,
  type VariablesContrato,
} from '@/lib/contrato-generator';
import { sociedadPrincipal } from '@/lib/sociedades-storage';
import { formatFechaCorta } from '@/lib/format';
import type { ContratoListado, Propietario } from '@/lib/types';

interface Props {
  contrato: ContratoListado;
  /**
   * Dueños de la propiedad = LOCADOR del contrato de locación. Vienen de `useContrato`
   * (`propiedad.participaciones` del API). Obligatorio a propósito: derivarlos acá contra
   * los mocks es lo que hacía que todos los contratos salieran con un propietario falso.
   */
  propietarios: Propietario[];
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
  GARANTIA_PROPIETARIA: ScrollText,
  SEGURO_CAUCION: ShieldCheck,
  RECIBO_GARANTE: Wallet,
  CONSTANCIA_LABORAL: FileText,
  CONSTANCIA_CUIT: FileText,
  INVENTARIO_INGRESO: FileText,
  SERVICIOS_A_NOMBRE: FileText,
  COMPROBANTE_DEPOSITO: Wallet,
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
  // Siempre hay al menos un grupo de garante aunque el contrato tenga cero: es
  // la única superficie para adjuntar el DNI de alguien que garantiza sin estar
  // dado de alta como `Garante`. No es lo mismo que "se requiere" — lo que se
  // requiere lo dice `faltantesDeExpediente`, que con cero garantes no pide nada.
  for (let i = 1; i <= Math.max(1, garantesCount); i++) {
    garantes.push({
      key: `garante-${i}`,
      titulo: `Garante ${i}`,
      ayuda: 'DNI frente y dorso del garante + recibo de sueldo. Sumá la garantía propietaria si la ofrece.',
      tipos: ['DNI_GARANTE_FRENTE', 'DNI_GARANTE_DORSO', 'RECIBO_GARANTE', 'GARANTIA_PROPIETARIA'],
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
      titulo: 'Convenio, pagarés y caución',
      ayuda: 'Convenio de desocupación, pagarés en garantía y seguro de caución.',
      tipos: ['CONVENIO_DESOCUPACION', 'PAGARE', 'SEGURO_CAUCION'],
    },
    {
      key: 'documentacion',
      titulo: 'Documentación legal',
      ayuda: 'Constancia laboral, CUIT/AFIP, inventario de ingreso, servicios a nombre y comprobante del depósito.',
      tipos: ['CONSTANCIA_LABORAL', 'CONSTANCIA_CUIT', 'INVENTARIO_INGRESO', 'SERVICIOS_A_NOMBRE', 'COMPROBANTE_DEPOSITO'],
    },
    {
      key: 'fotos',
      titulo: 'Fotos de WhatsApp y otros',
      ayuda: 'Capturas que mandó el inquilino, fotos de comprobantes, adjuntos varios.',
      tipos: ['FOTO_WHATSAPP', 'OTRO'],
    },
  ];
}

export function ContratoDocumentosPanel({ contrato, propietarios }: Props) {
  // Documentos REALES vía API en prod (CRUD + Volume); localStorage en demo.
  const { docs, hidratado, subir, eliminar: eliminarDoc } = useDocsContrato(contrato.id);
  const {
    garantes,
    disponible: garantesDisponibles,
    cargando: garantesCargando,
  } = useGarantes(contrato.id);
  const [grupoActivo, setGrupoActivo] = useState<GrupoUI | null>(null);
  const [tipoElegido, setTipoElegido] = useState<TipoDocContrato>('DNI_TITULAR_FRENTE');
  const [garantesOverride, setGarantesOverride] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cuántos garantes tiene ESTE contrato sale de los garantes reales
  // (GET /contratos/:id/garantes), no de lo que haya tocado alguien en la
  // pantalla. Antes era un `useState(1)`: el mismo contrato mostraba "4 de 6" o
  // "4 de 8" según lo último que se hubiera elegido, y volvía a 1 en cada
  // recarga. Cualquier aviso de faltantes alimentado por eso miente.
  //
  // El <Select> de abajo sobrevive como override VISUAL —sirve para ver qué
  // pasaría con un garante más antes de darlo de alta— y por eso se guarda
  // aparte, en `garantesOverride`. En demo no existe el endpoint de garantes
  // (`disponible === false`): ahí el Select es la única fuente y arranca en 1,
  // como venía.
  const garantesReales = garantesDisponibles ? garantes.length : 1;
  const garantesCount = garantesOverride ?? garantesReales;

  const grupos = useMemo(() => gruposParaContrato(garantesCount), [garantesCount]);

  const docsPorTipo = useMemo(() => {
    const map = new Map<string, DocContrato[]>();
    for (const d of docs) {
      // El garante entra en la clave para CUALQUIER tipo, no solo para los DNI:
      // el recibo del garante 2 no tapa el del titular. Con la lista de tipos
      // hardcodeada, el recibo y la garantía propietaria de un garante quedaban
      // bajo la clave pelada y el botón del grupo nunca se marcaba cargado.
      const key = claveDocumento(d.tipo, d.garanteIndex);
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return map;
  }, [docs]);

  // La fórmula de "qué se requiere" vive en un módulo único que también usa el
  // alta: si acá se recalculara aparte, las dos pantallas dirían cosas distintas.
  const expediente = useMemo(
    () => faltantesDeExpediente(docs, garantesCount),
    [docs, garantesCount],
  );
  const pct =
    expediente.total === 0 ? 0 : Math.round((expediente.presentes / expediente.total) * 100);

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
    const etiqueta = `${TIPO_DOC_LABEL[tipoElegido]}${
      grupoActivo.garanteIndex ? ` · Garante ${grupoActivo.garanteIndex}` : ''
    }`;
    try {
      await subir({
        file,
        tipo: tipoElegido,
        etiqueta,
        garanteIndex: grupoActivo.garanteIndex,
      });
      toast({
        variant: 'success',
        title: 'Documento cargado',
        description: etiqueta,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: `Revisá el archivo (hasta ${formatTamanio(TAMANIO_MAX)}, imagen o PDF) e intentá de nuevo.`,
      });
    } finally {
      e.target.value = '';
    }
  };

  const eliminar = async (doc: DocContrato) => {
    try {
      await eliminarDoc(doc);
      toast({ title: 'Documento eliminado', description: doc.etiqueta });
    } catch {
      toast({
        variant: 'destructive',
        title: 'No se pudo eliminar',
        description: 'Intentá de nuevo.',
      });
    }
  };

  const variables = useMemo<VariablesContrato>(() => {
    const sociedad = sociedadPrincipal();
    // Los propietarios (= LOCADOR) llegan por prop desde `useContrato`, que los saca de
    // `propiedad.participaciones` del API.
    //
    // NO volver a derivarlos acá cruzando contra los mocks: esa era la causa del bug por
    // el que TODOS los contratos de locación se descargaban a nombre de Eduardo Castro.
    // El `find` contra `propiedadesMock` nunca matchea en prod (ids cuid vs `cnt_00X`) y
    // el fallback devolvía el primer propietario del mock. Si no hay propietarios, el
    // generador lo dice explícitamente en vez de inventar uno.
    return {
      contrato,
      propietarios,
      // Del contrato REAL. Antes eran constantes de la demo estampadas en un documento que
      // se FIRMA: el día de pago salía siempre 5, la comisión 4,17% (nunca pactada), la
      // ciudad CABA aunque la propiedad estuviera en Córdoba, y el depósito salía igual al
      // alquiler VIGENTE — que después de un par de ajustes por índice es muy superior al
      // que el inquilino entregó al firmar. En la demo coincidían y el Word salía perfecto.
      // Mismo criterio que ya usa este panel con la sociedad: si el dato no está, el
      // generador deja el blanco a completar. Un blanco se corrige a mano; un número falso
      // se firma.
      diaPago: contrato.diaPago ?? undefined,
      // Del contrato, no fijos: un contrato IPC/12m generaba un Word que decía
      // "ICL cada 6 meses". El generador ya aplica los mismos fallbacks.
      indiceAjuste: contrato.indiceAjuste ?? 'ICL',
      frecuenciaAjusteMeses: contrato.frecuenciaAjusteMeses ?? 6,
      comisionInmobiliariaPct: contrato.comisionInmobiliaria ?? undefined,
      depositoGarantia: contrato.depositoGarantia ?? undefined,
      ciudadFirma: contrato.ciudad ?? undefined,
      // Sin sociedad cargada omitimos el "representado por ..." del contrato: el
      // template ya lo trata como opcional. Antes se caía al seed de la demo y el
      // contrato salía representado por "Inmobiliaria del Sol S.R.L." con CUIT ajeno.
      sociedad: sociedad
        ? {
            razonSocial: sociedad.razonSocial,
            cuit: sociedad.cuit,
            direccion: sociedad.domicilioFiscal,
          }
        : undefined,
    };
  }, [contrato, propietarios]);

  // Esperar también a los garantes: si no, el checklist se pinta con 0 garantes
  // y salta a la cantidad real un instante después. Ese parpadeo del "X de Y"
  // se lee como un bug.
  if (!hidratado || (garantesDisponibles && garantesCargando)) return null;

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
                Documentos cargados: {expediente.presentes} de {expediente.total} requeridos.
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
          {/* Qué falta, nombrado. "3 de 6" no le dice a nadie qué tiene que ir a buscar. */}
          {expediente.faltantes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {expediente.faltantes.length === 1 ? 'Falta' : 'Faltan'}{' '}
              {enumerarFaltantes(expediente.faltantes)}.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Label htmlFor="garantes-count" className="text-xs">
              Cantidad de garantes
            </Label>
            <Select
              value={String(garantesCount)}
              onValueChange={(v) => setGarantesOverride(parseInt(v, 10))}
            >
              <SelectTrigger id="garantes-count" className="h-8 w-32 text-xs">
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
            {garantesDisponibles && garantesOverride != null && garantesOverride !== garantesReales && (
              <button
                type="button"
                onClick={() => setGarantesOverride(null)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                El contrato tiene {garantesReales} — volver
              </button>
            )}
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
                  <ul role="list" className="divide-y rounded-md border">
                    {docsDeGrupo.map((d) => {
                      const Icon = ICONO_TIPO[d.tipo];
                      const esImagen = d.tipoMime.startsWith('image/');
                      return (
                        <li
                          key={d.id}
                          className="flex items-center gap-3 p-3 text-sm"
                        >
                          {esImagen ? (
                            // eslint-disable-next-line @next/next/no-img-element
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
                              {formatFechaCorta(d.subidoAt)}
                            </p>
                          </div>
                          <Button asChild variant="ghost" size="sm">
                            <a
                              href={d.dataUrl}
                              download={d.nombreArchivo}
                              target="_blank"
                              rel="noopener"
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
