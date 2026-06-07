import { cn } from '@llave/ui/cn';

/**
 * Badge numérico (pendientes / notificaciones).
 * - 1 dígito → círculo perfecto; 2+ dígitos → pill, siempre centrado
 *   (`leading-none` + flex + `tabular-nums`).
 * - Capea en **99+** para no deformar el layout con números grandes (100, 1000…).
 * - No renderiza nada si count <= 0.
 */
export function CountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none tabular-nums text-destructive-foreground',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
