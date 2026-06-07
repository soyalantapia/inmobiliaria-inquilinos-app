import { Topbar } from '@/components/topbar';
import { BandejaAprobaciones } from '@/components/bandeja-aprobaciones';

export const dynamic = 'force-static';

export default function AprobacionesPage() {
  return (
    <>
      <Topbar titulo="Aprobaciones" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aprobaciones</h1>
          <p className="text-sm text-muted-foreground">
            Lo que tu equipo (Operadores y Carga) cargó y necesita tu visto, con
            PIN: contratos, gastos, devoluciones y ajustes.{' '}
            <span className="font-medium text-foreground">
              Los pagos se validan en Pagos.
            </span>
          </p>
        </div>
        <BandejaAprobaciones />
      </main>
    </>
  );
}
