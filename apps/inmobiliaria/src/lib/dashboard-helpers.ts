// Cálculos del dashboard a partir de los mocks. En backend real esto es
// una query agregada del servidor. Mantengo todo derivado en cliente
// para que las métricas sean coherentes con cambios en otros mocks.

import { contratosMock, propiedadesMock, reclamosMock } from './mock-data';

export interface DashboardStats {
  // Financieras
  cobradoMes: number;
  porCobrarMes: number;
  enMora: { monto: number; cantidad: number };
  comisionMes: number; // estimada con 8% promedio
  aRendirMes: number; // a propietarios después de comisión

  // Operacionales
  contratosActivos: number;
  ocupacionPct: number;
  reclamosAbiertos: number;
  cobrabilidadPct: number;
}

const COMISION_DEFAULT = 0.08; // 8% promedio

// `gastosPendientes` = gastos de caja aún no descontados (se pasa desde el
// componente, leído de caja-storage tras montar para no romper la hidratación).
// El neto "A rendir a propietarios" = cobrado − comisión − gastos pendientes.
export function calcularDashboardStats(
  gastosPendientes = 0,
  // `reclamosAbiertosLive` viene del store (localStorage) leído tras montar, igual
  // que gastosPendientes — para no romper hidratación. Si es undefined (SSR/primer
  // render) usamos el conteo del mock; el cliente lo corrige al instante. Sin esto
  // el KPI quedaba congelado en reclamosMock y contradecía al Inbox tras resolver.
  reclamosAbiertosLive?: number,
): DashboardStats {
  // Excluye PROPIETARIO_DIRECTO de cobrado/porCobrar/mora: esa plata va directo
  // del inquilino al dueño, no pasa por la inmo (alinea el demo con el path API,
  // hooks.ts que ya lo saltea).
  const activos = contratosMock.filter(
    (c) => c.estado === 'ACTIVO' && c.modoCobranza !== 'PROPIETARIO_DIRECTO',
  );
  // El CONTEO de contratos activos NO excluye PROPIETARIO_DIRECTO (sí es un
  // contrato activo, aunque su plata no la cobre la inmo) → así coincide con
  // el contador de /contratos. La exclusión de PD es solo para los agregados $$.
  const todosActivos = contratosMock.filter((c) => c.estado === 'ACTIVO');

  const cobrado = activos
    .filter((c) => c.estadoPagoActual === 'PAGADO')
    .reduce((acc, c) => acc + c.monto, 0);

  const porCobrar = activos
    .filter((c) => c.estadoPagoActual === 'PENDIENTE')
    .reduce((acc, c) => acc + c.monto, 0);

  const moraContratos = activos.filter((c) => c.estadoPagoActual === 'VENCIDO');
  const enMora = {
    monto: moraContratos.reduce((acc, c) => acc + c.monto, 0),
    cantidad: moraContratos.length,
  };

  const totalActivos = cobrado + porCobrar + enMora.monto;
  const comisionMes = Math.round(cobrado * COMISION_DEFAULT);
  const aRendirMes = Math.max(0, Math.round(cobrado - comisionMes - gastosPendientes));

  const totalPropiedades = propiedadesMock.length;
  const alquiladas = propiedadesMock.filter((p) => p.estado === 'ALQUILADA').length;
  const ocupacionPct = totalPropiedades > 0 ? Math.round((alquiladas / totalPropiedades) * 100) : 0;

  const reclamosAbiertos =
    reclamosAbiertosLive ??
    reclamosMock.filter((r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO').length;

  const cobrabilidadPct =
    totalActivos > 0 ? Math.round((cobrado / totalActivos) * 100) : 0;

  return {
    cobradoMes: cobrado,
    porCobrarMes: porCobrar,
    enMora,
    comisionMes,
    aRendirMes,
    contratosActivos: todosActivos.length,
    ocupacionPct,
    reclamosAbiertos,
    cobrabilidadPct,
  };
}
