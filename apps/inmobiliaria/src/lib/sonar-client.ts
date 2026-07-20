// Cliente fino del loader de Sonar (window.Sonar) ya embebido en el layout raíz.
// El loader corre vanilla, auto-captura errores JS/promesas/API + breadcrumbs + contexto,
// y expone window.Sonar para reportes MANUALES e identidad del usuario. Este módulo tipa
// esa API global y da helpers seguros (no-op si el loader no cargó).

export type SonarSeverity = 'low' | 'medium' | 'high' | 'critical';

interface SonarCapture {
  kind?: string;
  errorType?: string;
  message?: string;
  stack?: string | null;
  severity?: SonarSeverity;
  title?: string;
  route?: string;
  correlationId?: string;
}

interface SonarApi {
  setContext?: (o: Record<string, unknown>) => void;
  setUser?: (u: Record<string, unknown> | null) => void;
  setRelease?: (r: string) => void;
  setBuildSha?: (s: string) => void;
  addBreadcrumb?: (c: string, d?: string) => void;
  capture?: (o: SonarCapture) => void;
  captureMessage?: (m: string, sev?: SonarSeverity) => void;
}

declare global {
  interface Window {
    Sonar?: SonarApi;
  }
}

/** ¿El loader cargó y expone capture()? */
export function sonarReady(): boolean {
  return typeof window !== 'undefined' && !!window.Sonar && typeof window.Sonar.capture === 'function';
}

/** Reporte manual de un bug por el usuario. Devuelve false si el loader no está listo. */
export function reportarBug(input: {
  message: string;
  severity: SonarSeverity;
  title?: string;
}): boolean {
  if (!sonarReady()) return false;
  try {
    window.Sonar!.capture!({
      kind: 'manual',
      errorType: 'UserReport',
      title: input.title,
      message: input.message,
      severity: input.severity,
    });
    return true;
  } catch {
    return false;
  }
}

/** Identifica al usuario logueado en Sonar → todo reporte queda atribuido.
 *  Idempotente; se llama al conocer la sesión. */
export function identificarSonarUser(
  u: { id?: string; name?: string; email?: string; role?: string } | null,
): void {
  try {
    if (window.Sonar?.setUser) {
      window.Sonar.setUser(u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null);
    }
  } catch {
    /* no-op: nunca romper la app por telemetría */
  }
}
