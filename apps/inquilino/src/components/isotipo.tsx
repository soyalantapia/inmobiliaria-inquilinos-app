/**
 * Isotipo de marca My Alquiler (puerta-cerradura): la casa cuya puerta es una
 * cerradura. SVG vectorial, un solo componente para toda la app (login, nav-bar,
 * pantallas). Los colores son de marca (violeta fijo), no tokens de tema.
 * Fuente de verdad del vector: /brand/isotipo.svg
 */
export function Isotipo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="My Alquiler"
    >
      <rect width="64" height="64" rx="16" fill="#6D28D9" />
      <path d="M32 14 L50 29 L50 50 L14 50 L14 29 Z" fill="#ffffff" />
      <circle cx="32" cy="34" r="4.4" fill="#6D28D9" />
      <path d="M29 37.5 H35 L34 50 H30 Z" fill="#6D28D9" />
    </svg>
  );
}
