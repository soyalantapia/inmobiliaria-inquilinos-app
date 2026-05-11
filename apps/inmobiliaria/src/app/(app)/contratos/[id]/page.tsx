import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, MessageSquare, Pencil } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { Topbar } from '@/components/topbar';
import { contratosMock } from '@/lib/mock-data';
import { formatFecha, formatMonto } from '@/lib/format';

export default function DetalleContratoPage({ params }: { params: { id: string } }) {
  const c = contratosMock.find((x) => x.id === params.id);
  if (!c) notFound();

  return (
    <>
      <Topbar titulo="Contrato" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/contratos"
              className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver a contratos
            </Link>
            <h2 className="truncate text-xl font-semibold">{c.inquilino}</h2>
            <p className="truncate text-sm text-muted-foreground">{c.direccion}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Mensaje al inquilino</span>
              <span className="sm:hidden">Mensaje</span>
            </Button>
            <Button className="flex-1 sm:flex-none">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="resumen">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 sm:w-auto sm:gap-0">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="comunicaciones">Comunicaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Datos del contrato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Estado" value={<Badge variant="success">{c.estado}</Badge>} />
                  <Row label="Vigencia" value={`${formatFecha(c.fechaInicio)} → ${formatFecha(c.fechaFin)}`} />
                  <Row label="Monto actual" value={formatMonto(c.monto, c.moneda)} bold />
                  <Row label="Próximo vencimiento" value={formatFecha(c.proximoVencimiento)} />
                  <Row label="Índice de ajuste" value="ICL — BCRA" />
                  <Row label="Frecuencia ajuste" value="12 meses" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Inquilino
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Nombre" value={c.inquilino} />
                  <Row label="WhatsApp" value="+54 9 11 4567 8900" />
                  <Row label="Email" value="mariela.sosa@gmail.com" />
                  <Row label="Garante" value="Cobertura SUMA — pólitica vigente" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pagos" className="space-y-2">
            <Card>
              <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                Historial de liquidaciones generadas y pagos conciliados. Tabla completa cuando exista la API.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documentos" className="space-y-2">
            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Contrato firmado.pdf</p>
                    <p className="text-xs text-muted-foreground">Subido el 28/08/2025 · 1.2 MB</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial">
            <Card>
              <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                Eventos del contrato (creación, ajustes, pagos, reclamos) en orden cronológico.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comunicaciones">
            <Card>
              <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                Mensajes enviados al inquilino y al garante (WhatsApp + email).
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}
