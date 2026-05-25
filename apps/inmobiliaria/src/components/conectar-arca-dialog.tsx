'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { guardarOverride } from '@/lib/propietarios-overrides-storage';
import type { Propietario } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propietario: Propietario;
}

type Condicion = 'MONOTRIBUTO' | 'RESPONSABLE_INSCRIPTO' | 'EXENTO';

const CONDICIONES: Array<{ value: Condicion; label: string }> = [
  { value: 'MONOTRIBUTO', label: 'Monotributo' },
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable inscripto' },
  { value: 'EXENTO', label: 'Exento' },
];

/**
 * Dialog que simula el OAuth con ARCA. En producción esto delegaría al
 * flujo real de afip.gov.ar; acá pedimos CUIT + condición fiscal + punto
 * de venta, y guardamos el override con `afip.conectado = true`.
 *
 * Tiene 2 pasos visuales:
 *  1. Form con CUIT + condición + punto venta
 *  2. Confirmación (chequeito verde + cierre auto)
 */
export function ConectarArcaDialog({ open, onOpenChange, propietario }: Props) {
  const [paso, setPaso] = useState<'form' | 'exito'>('form');
  const [cuit, setCuit] = useState(propietario.cuit);
  const [condicion, setCondicion] = useState<Condicion>('MONOTRIBUTO');
  const [puntoVenta, setPuntoVenta] = useState('0003');
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (open) {
      setPaso('form');
      setCuit(propietario.cuit);
      setCondicion('MONOTRIBUTO');
      setPuntoVenta('0003');
    }
  }, [open, propietario]);

  const conectar = async () => {
    if (!cuit.trim() || !puntoVenta.trim()) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'CUIT y punto de venta son obligatorios.',
      });
      return;
    }
    setProcesando(true);
    // Simulación: en la realidad acá iría window.open al OAuth de AFIP y
    // se completaría con el callback. Mostramos delay para que se sienta.
    await new Promise((r) => setTimeout(r, 900));
    guardarOverride(propietario.id, {
      cuit: cuit.trim(),
      afip: {
        conectado: true,
        condicionFiscal: condicion,
        puntoVenta: puntoVenta.trim(),
        tipoComprobante:
          condicion === 'RESPONSABLE_INSCRIPTO'
            ? 'FACTURA_A'
            : condicion === 'EXENTO'
              ? 'RECIBO_C'
              : 'FACTURA_C',
        conectadoDesde: new Date().toISOString(),
      },
    });
    setProcesando(false);
    setPaso('exito');
    // Toast lo damos en el step de éxito; cerramos después de 1.5s.
    setTimeout(() => onOpenChange(false), 1600);
    toast({
      variant: 'success',
      title: 'ARCA conectada',
      description: 'A partir de ahora la factura se emite sola al aprobar el pago.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar ARCA del propietario</DialogTitle>
          <DialogDescription>
            Vinculamos CUIT y clave fiscal una sola vez. Después, cada pago aprobado emite la
            factura automáticamente.
          </DialogDescription>
        </DialogHeader>

        {paso === 'form' ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="arca-cuit">CUIT</Label>
                <Input
                  id="arca-cuit"
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  placeholder="20-12345678-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="arca-cond">Condición fiscal</Label>
                <Select value={condicion} onValueChange={(v) => setCondicion(v as Condicion)}>
                  <SelectTrigger id="arca-cond">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDICIONES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="arca-pv">Punto de venta</Label>
                <Input
                  id="arca-pv"
                  value={puntoVenta}
                  onChange={(e) => setPuntoVenta(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                  placeholder="0003"
                  inputMode="numeric"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se usa para numerar las facturas que emite el propietario.
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-primary/5 p-3 text-xs">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-muted-foreground">
                  Las credenciales no se guardan en My Alquiler — la conexión vive del lado de
                  ARCA y solo recibimos el token de emisión.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={procesando}
              >
                Cancelar
              </Button>
              <Button onClick={conectar} disabled={procesando}>
                {procesando ? 'Conectando con ARCA…' : 'Vincular ahora'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <p className="text-base font-semibold">¡Listo, ARCA conectada!</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Desde el próximo pago aprobado, la factura sale sola y se manda al inquilino por
              WhatsApp y mail.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
