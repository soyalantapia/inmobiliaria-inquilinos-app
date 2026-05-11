'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, FileText, Mail, MessageCircle, Phone, Plus, Search, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { SumarPropietarioDialog } from '@/components/sumar-propietario-dialog';
import { Topbar } from '@/components/topbar';
import { propietariosMock } from '@/lib/mock-data';
import { formatMonto } from '@/lib/format';

export default function PropietariosPage() {
  const [q, setQ] = useState('');
  const [abrirSumar, setAbrirSumar] = useState(false);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return propietariosMock;
    return propietariosMock.filter(
      (p) =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(term) ||
        p.cuit.includes(term) ||
        p.email.toLowerCase().includes(term),
    );
  }, [q]);

  const totalPropiedades = propietariosMock.reduce((acc, p) => acc + p.propiedadesIds.length, 0);
  const totalRecibir = propietariosMock.reduce((acc, p) => acc + p.totalRecibirMes, 0);
  const sinCbu = propietariosMock.filter((p) => !p.cbuAlias).length;

  return (
    <>
      <Topbar titulo="Propietarios" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Propietarios</p>
              <p className="mt-1 text-2xl font-semibold">{propietariosMock.length}</p>
              <p className="text-xs text-muted-foreground">{totalPropiedades} contratos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">A rendir este mes</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{formatMonto(totalRecibir)}</p>
              <p className="text-xs text-muted-foreground">Después de comisión</p>
            </CardContent>
          </Card>
          <Card className={sinCbu > 0 ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10' : ''}>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sin CBU</p>
              <p className={`mt-1 text-2xl font-semibold ${sinCbu > 0 ? 'text-amber-600' : ''}`}>
                {sinCbu}
              </p>
              <p className="text-xs text-muted-foreground">
                {sinCbu > 0 ? 'Pediles los datos antes de rendir' : 'Todos tienen CBU cargado'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, CUIT o email"
              className="pl-9"
            />
          </div>
          <Button onClick={() => setAbrirSumar(true)}>
            <Plus className="h-4 w-4" />
            Sumar propietario
          </Button>
        </div>

        {filtrados.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
              <Users className="mx-auto h-8 w-8" />
              <p className="font-medium text-foreground">Sin resultados para &quot;{q}&quot;</p>
              <button onClick={() => setQ('')} className="text-xs font-medium text-primary hover:underline">
                Limpiar búsqueda
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((p, i) => {
              const tel = p.telefono.replace(/[^\d]/g, '');
              return (
                <Card
                  key={p.id}
                  className="animate-fade-in transition-shadow hover:shadow-md"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
                >
                  <CardContent className="space-y-4 p-5">
                    <Link href={`/propietarios/${p.id}`} className="block space-y-3 -m-1 rounded-md p-1 transition-colors hover:bg-muted/20">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {p.nombre[0]}
                            {p.apellido[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">
                            {p.nombre} {p.apellido}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">CUIT {p.cuit}</p>
                        </div>
                        <Badge variant="secondary">
                          {p.propiedadesIds.length} {p.propiedadesIds.length === 1 ? 'unidad' : 'unidades'}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{p.email}</span>
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{p.telefono}</span>
                        </div>
                      </div>

                      <div className="rounded-md border bg-muted/50 p-3 text-sm">
                        <p className="text-xs text-muted-foreground">A rendir este mes</p>
                        <p className="text-lg font-semibold">{formatMonto(p.totalRecibirMes)}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Comisión {p.comisionPct}% · Bruto {formatMonto(p.totalCobradoMes)}
                        </p>
                      </div>
                    </Link>

                    {!p.cbuAlias && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Falta CBU para transferir
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/contratos?propietario=${p.id}`}>
                          <FileText className="h-3.5 w-3.5" />
                          Contratos
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <SumarPropietarioDialog open={abrirSumar} onOpenChange={setAbrirSumar} />
    </>
  );
}
