'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Progress } from '@llave/ui/progress';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { contratoExtraidoMock } from '@/lib/mock-data';
import type { ContratoExtraido } from '@/lib/types';

type Paso = 1 | 2 | 3 | 4;

const pasos = [
  { id: 1, label: 'Subir PDF' },
  { id: 2, label: 'Extracción IA' },
  { id: 3, label: 'Revisar y editar' },
  { id: 4, label: 'Confirmar' },
] as const;

const confianzaVariant = {
  alto: 'success',
  medio: 'warning',
  bajo: 'destructive',
} as const;

const confianzaLabel = {
  alto: 'Alta confianza',
  medio: 'Revisar',
  bajo: 'Bajo — completar',
} as const;

const camposVisible: Array<{ key: keyof ContratoExtraido; label: string; tipo: 'text' | 'number' | 'date' }> = [
  { key: 'inquilino', label: 'Inquilino', tipo: 'text' },
  { key: 'cuit', label: 'CUIT', tipo: 'text' },
  { key: 'direccion', label: 'Dirección', tipo: 'text' },
  { key: 'montoInicial', label: 'Monto inicial', tipo: 'number' },
  { key: 'moneda', label: 'Moneda', tipo: 'text' },
  { key: 'fechaInicio', label: 'Fecha inicio', tipo: 'date' },
  { key: 'fechaFin', label: 'Fecha fin', tipo: 'date' },
  { key: 'diaPago', label: 'Día de pago', tipo: 'number' },
  { key: 'indiceAjuste', label: 'Índice de ajuste', tipo: 'text' },
  { key: 'frecuenciaAjusteMeses', label: 'Frecuencia ajuste (meses)', tipo: 'number' },
  { key: 'comisionInmobiliaria', label: 'Comisión inmobiliaria %', tipo: 'number' },
  { key: 'depositoGarantia', label: 'Depósito en garantía', tipo: 'number' },
  { key: 'tasaPunitorioDiaria', label: 'Tasa punitorio diaria %', tipo: 'number' },
];

export default function CargarContratoPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(1);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [datos, setDatos] = useState<ContratoExtraido>(contratoExtraidoMock);

  const subir = async (file: File) => {
    setArchivo(file);
    setPaso(2);
    setProgreso(10);
    // mock IA: en Sprint 1 esto pega a /api/contratos/parse
    await delay(400);
    setProgreso(45);
    await delay(700);
    setProgreso(80);
    await delay(500);
    setProgreso(100);
    await delay(300);
    setDatos(contratoExtraidoMock);
    setPaso(3);
  };

  return (
    <>
      <Topbar titulo="Cargar contrato" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div>
          <Link
            href="/contratos"
            className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </Link>
          <Steps actual={paso} />
        </div>

        {paso === 1 && <PasoSubir onArchivo={subir} />}
        {paso === 2 && <PasoIa archivo={archivo} progreso={progreso} />}
        {paso === 3 && (
          <PasoRevisar
            datos={datos}
            setDatos={setDatos}
            onContinuar={() => {
              setPaso(4);
              toast({
                title: 'Datos guardados',
                description: 'Revisá un último resumen antes de confirmar.',
              });
            }}
          />
        )}
        {paso === 4 && (
          <PasoConfirmar
            onConfirmar={() => {
              toast({
                title: 'Contrato dado de alta',
                description: 'Generamos la primera liquidación y mandamos invitación al inquilino.',
              });
              router.push('/contratos');
            }}
          />
        )}
      </main>
    </>
  );
}

function Steps({ actual }: { actual: Paso }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {pasos.map((p, i) => {
        const completado = p.id < actual;
        const activo = p.id === actual;
        return (
          <li key={p.id} className="flex items-center gap-2 sm:gap-3">
            <div
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                completado
                  ? 'bg-primary text-primary-foreground'
                  : activo
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {completado ? <CheckCircle2 className="h-4 w-4" /> : p.id}
            </div>
            <span
              className={`text-xs sm:text-sm ${activo ? 'font-medium' : completado ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {p.label}
            </span>
            {i < pasos.length - 1 && <span className="hidden h-px w-8 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function PasoSubir({ onArchivo }: { onArchivo: (file: File) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subí el PDF del contrato</CardTitle>
        <CardDescription>
          Aceptamos contratos digitales y escaneados. Si está escaneado, hacemos OCR.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label
          htmlFor="file"
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-12 text-center transition-colors hover:border-primary/60"
        >
          <FileUp className="h-10 w-10 text-primary" />
          <div>
            <p className="font-medium">Arrastrá el PDF acá o hacé clic</p>
            <p className="text-xs text-muted-foreground">PDF de hasta 10 MB</p>
          </div>
          <input
            id="file"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onArchivo(f);
            }}
          />
        </label>
      </CardContent>
    </Card>
  );
}

function PasoIa({ archivo, progreso }: { archivo: File | null; progreso: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Extrayendo datos con IA
        </CardTitle>
        <CardDescription>
          {archivo?.name ?? 'PDF'} · Claude está leyendo el contrato.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progreso} />
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <Tarea done={progreso >= 25} label="Extrayendo texto del PDF" />
          <Tarea done={progreso >= 50} label="Identificando cláusulas" />
          <Tarea done={progreso >= 75} label="Extrayendo campos estructurados" />
          <Tarea done={progreso >= 100} label="Calculando confianza por campo" />
        </div>
      </CardContent>
    </Card>
  );
}

function Tarea({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <span className={done ? 'text-foreground' : ''}>{label}</span>
    </div>
  );
}

function PasoRevisar({
  datos,
  setDatos,
  onContinuar,
}: {
  datos: ContratoExtraido;
  setDatos: (d: ContratoExtraido) => void;
  onContinuar: () => void;
}) {
  const update = (key: keyof ContratoExtraido, valor: string | number) => {
    setDatos({ ...datos, [key]: { ...datos[key], valor } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisá los datos extraídos</CardTitle>
        <CardDescription>
          Editá lo que la IA marcó con confianza media o baja antes de confirmar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {camposVisible.map((c) => {
            const campo = datos[c.key];
            return (
              <div key={c.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={c.key}>{c.label}</Label>
                  <Badge variant={confianzaVariant[campo.confianza]}>
                    {confianzaLabel[campo.confianza]}
                  </Badge>
                </div>
                <Input
                  id={c.key}
                  type={c.tipo}
                  value={campo.valor ?? ''}
                  onChange={(e) =>
                    update(c.key, c.tipo === 'number' ? Number(e.target.value) : e.target.value)
                  }
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button onClick={onContinuar}>
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PasoConfirmar({ onConfirmar }: { onConfirmar: () => void }) {
  return (
    <Card className="text-center">
      <CardContent className="space-y-4 p-10">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h2 className="text-xl font-semibold">¿Damos de alta el contrato?</h2>
        <p className="text-sm text-muted-foreground">
          Vamos a generar la primera liquidación y mandar la invitación al inquilino por WhatsApp.
        </p>
        <Button size="lg" onClick={onConfirmar}>
          Confirmar y dar de alta
        </Button>
      </CardContent>
    </Card>
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
