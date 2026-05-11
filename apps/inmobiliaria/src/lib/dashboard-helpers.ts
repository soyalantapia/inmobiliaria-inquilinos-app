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

export function calcularDashboardStats(): DashboardStats {
  const activos = contratosMock.filter((c) => c.estado === 'ACTIVO');

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
  const aRendirMes = Math.round(cobrado - comisionMes);

  const totalPropiedades = propiedadesMock.length;
  const alquiladas = propiedadesMock.filter((p) => p.estado === 'ALQUILADA').length;
  const ocupacionPct = totalPropiedades > 0 ? Math.round((alquiladas / totalPropiedades) * 100) : 0;

  const reclamosAbiertos = reclamosMock.filter(
    (r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO',
  ).length;

  const cobrabilidadPct =
    totalActivos > 0 ? Math.round((cobrado / totalActivos) * 100) : 0;

  return {
    cobradoMes: cobrado,
    porCobrarMes: porCobrar,
    enMora,
    comisionMes,
    aRendirMes,
    contratosActivos: activos.length,
    ocupacionPct,
    reclamosAbiertos,
    cobrabilidadPct,
  };
}
