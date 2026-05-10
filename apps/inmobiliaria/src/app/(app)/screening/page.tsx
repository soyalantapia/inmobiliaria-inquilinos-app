'use client';

import { useState } from 'react';
import { CheckCircle2, Download, Loader2, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { screeningMock } from '@/lib/mock-data';
import { formatMonto } from '@/lib/format';
import { formatearCuit, validarCuit } from '@/lib/cuit';
import type { Recomendacion, ScreeningResultado } from '@/lib/types';

const recoConfig: Record<
  Recomendacion,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  APTO: { label: 'Apto', color: 'text-emerald-600', icon: ShieldCheck },
  APTO_CON_GARANTIA: { label: 'Apto con garantía', color: 'text-amber-600', icon: ShieldAlert },
  NO_APTO: { label: 'No apto', color: 'text-red-600', icon: ShieldX },
};

export default function ScreeningPage() {
  const [cuit, setCuit] = useState('');
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState<'idle' | 'loading' | 'done'>('idle');
  const [resultado, setResultado] = useState<ScreeningResultado | null>(null);

  const validacionCuit = validarCuit(cuit);
  const cuitDirty = cuit.length > 0;
  const formValido = validacionCuit.valido && nombre.trim().length >= 3;

  const verificar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValido) return;
    setEstado('loading');
    // mock: en Sprint 3 esto pega a /api/screening (Nosis + BCRA)
    await new Promise((r) => setTimeout(r, 1800));
    setResultado({ ...screeningMock, cuit, nombre });
    setEstado('done');
    toast({
      title: 'Screening listo',
      description: `${nombre} — recomendación ${screeningMock.recomendacion.replace('_', ' ').toLowerCase()}.`,
    });
  };

  return (
    <>
      <Topbar titulo="Verificar inquilino" />
      <main className="flex-1 space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Screening crediticio</CardTitle>
            <CardDescription>
              Combina BCRA + Nosis y devuelve recomendación en menos de 30 segundos. Cacheado por 30 días.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={verificar} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT / CUIL</Label>
                <Input
                  id="cuit"
                  inputMode="numeric"
                  placeholder="20-31256789-0"
                  value={formatearCuit(cuit)}
                  onChange={(e) => setCuit(e.target.value)}
                  aria-invalid={cuitDirty && !validacionCuit.valido}
                  aria-describedby="cuit-error"
                  required
                />
                {cuitDirty && !validacionCuit.valido && (
                  <p id="cuit-error" className="text-xs text-destructive">
                    {validacionCuit.motivo}
                  </p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  placeholder="Carlos Eduardo Méndez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-3">
                <Button type="submit" disabled={!formValido || estado === 'loading'}>
                  {estado === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Consultando…
                    </>
                  ) : (
                    'Verificar'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {estado === 'done' && resultado && <Resultado data={resultado} />}
      </main>
    </>
  );
}

function Resultado({ data }: { data: ScreeningResultado }) {
  const cfg = recoConfig[data.recomendacion];
  const Icon = cfg.icon;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Icon className={`h-14 w-14 ${cfg.color}`} />
          <h3 className="text-2xl font-semibold">{cfg.label}</h3>
          <p className="text-sm text-muted-foreground">{data.recomendacionRazon}</p>
          <Button variant="outline" className="mt-2">
            <Download className="h-4 w-4" />
            Descargar informe
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{data.nombre}</CardTitle>
          <CardDescription>CUIT {data.cuit}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Metric label="Score Nosis" value={data.scoreNosis.toString()} hint="700+ óptimo" />
            <Metric
              label="BCRA — categoría"
              value={data.resultadoBcra.toString()}
              hint={data.resultadoBcra === 1 ? 'Sin atrasos' : 'Atrasos detectados'}
            />
            <Metric label="Deudas activas" value={data.deudasCount.toString()} hint={formatMonto(data.deudasMonto)} />
            <Metric label="Cheques rechazados" value={data.chequesRechazados.toString()} />
            <Metric label="Juicios" value={data.juiciosCount.toString()} />
            <Metric label="Cache válida" value="30 días" hint="No volvemos a cobrar la consulta" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
