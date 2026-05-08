'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, CheckCircle2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { NavBar } from '@/components/nav-bar';
import type { Categoria, Urgencia } from '@/lib/types';

const categorias: Array<{ value: Categoria; label: string; emoji: string }> = [
  { value: 'PLOMERIA', label: 'Plomería', emoji: '🚰' },
  { value: 'ELECTRICIDAD', label: 'Electricidad', emoji: '💡' },
  { value: 'CERRADURA', label: 'Cerradura', emoji: '🔑' },
  { value: 'CALEFACCION', label: 'Calefacción / aire', emoji: '🔥' },
  { value: 'OTRO', label: 'Otro', emoji: '🛠️' },
];

const urgencias: Array<{ value: Urgencia; label: string; descripcion: string }> = [
  { value: 'BAJA', label: 'Puede esperar', descripcion: 'No urge, podés resolverlo cuando puedas' },
  { value: 'MEDIA', label: 'Esta semana', descripcion: 'Me molesta pero no es grave' },
  { value: 'ALTA', label: 'Urgente', descripcion: 'Necesito una solución hoy o mañana' },
  { value: 'EMERGENCIA', label: 'Emergencia', descripcion: 'Hay riesgo o no puedo vivir así' },
];

export default function NuevoReclamoPage() {
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [urgencia, setUrgencia] = useState<Urgencia | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <>
        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          <h1 className="mt-4 text-xl font-semibold">Reclamo enviado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La inmobiliaria ya tiene tu reclamo. Te avisamos por WhatsApp cuando lo tomen.
          </p>
          <Button asChild className="mt-6 w-full" size="xl">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </main>
        <NavBar />
      </>
    );
  }

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <Link href="/" className="rounded-full p-2 hover:bg-muted" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Nuevo reclamo</h1>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6">
        <div className="space-y-2">
          <Label>¿De qué se trata?</Label>
          <div className="grid grid-cols-2 gap-2">
            {categorias.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategoria(c.value)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                  categoria === c.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="font-medium">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Contanos un poco</Label>
          <Textarea
            id="desc"
            placeholder="Ej: Pierde la canilla del baño desde anoche."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
          />
        </div>

        <Card className="flex items-center gap-3 border-dashed p-4 text-sm text-muted-foreground">
          <Camera className="h-5 w-5 text-primary" />
          <span>Subí una foto (opcional, recomendado)</span>
        </Card>

        <div className="space-y-2">
          <Label>Urgencia</Label>
          <Select value={urgencia} onValueChange={(v) => setUrgencia(v as Urgencia)}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí cuán urgente es" />
            </SelectTrigger>
            <SelectContent>
              {urgencias.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{u.label}</span>
                    <span className="text-xs text-muted-foreground">{u.descripcion}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="xl"
          className="w-full"
          disabled={!categoria || !urgencia || descripcion.length < 10}
          onClick={() => setEnviado(true)}
        >
          Enviar reclamo
        </Button>
      </main>
      <NavBar />
    </>
  );
}
