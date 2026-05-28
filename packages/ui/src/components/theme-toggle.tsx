// Light mode forzado. Sin botón de toggle — la app es always-light.
// El script inline se ejecuta en <head> de cada app, antes del primer
// paint, para sacar cualquier clase `dark` que algún script externo
// (DarkReader, extensions) pueda haber inyectado.
//
// `darkMode` en tailwind.preset.js también está apuntando a un selector
// que jamás matchea — doble blindaje: aunque la clase aparezca, las
// utilidades `dark:*` no se aplican.
export const themeScript = `
  (function() {
    try {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'only light';
      try { window.localStorage.removeItem('llave:theme'); } catch (_) {}
    } catch (_) {}
  })();
`;
