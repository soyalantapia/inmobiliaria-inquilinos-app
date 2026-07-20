// Cliente fino del loader de Sonar (window.Sonar) ya embebido en el layout raíz.
// Permite al inquilino reportar bugs manualmente y ser identificado en los tickets.

export type SonarSeverity = 'low' | 'medium' | 'high' | 'critical';

interface SonarCapture {
  kind?: string;
  errorType?: string;
  message?: string;
  stack?: string | null;
  severity?: SonarSeverity;
  title?: string;
  route?: string;
}

interface SonarApi {
  setContext?: (o: Record<string, unknown>) => void;
  setUser?: (u: Record<string, unknown> | null) => void;
  setRelease?: (r: string) => void;
  addBreadcrumb?: (c: string, d?: string) => void;
  capture?: (o: SonarCapture) => void;
  captureMessage?: (m: string, sev?: SonarSeverity) => void;
}

declare global {
  interface Window {
    Sonar?: SonarApi;
  }
}

export function sonarReady(): boolean {
  return typeof window !== 'undefined' && !!window.Sonar && typeof window.Sonar.capture === 'function';
}

/** OJO: `capture()` es fire-and-forget. `true` = se encoló, NO = llegó a Sonar. */
export function reportarBug(input: { message: string; severity: SonarSeverity; title?: string }): boolean {
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

export function identificarSonarUser(
  u: { id?: string; name?: string; email?: string; role?: string } | null,
): void {
  try {
    if (window.Sonar?.setUser) {
      window.Sonar.setUser(u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null);
    }
  } catch {
    /* no-op */
  }
}
