#!/usr/bin/env node
/**
 * Guard de build: aborta si el dev server de Next está corriendo en el puerto.
 *
 * Motivo: ya tuvimos dos veces el bug de pisar el .next/ con `pnpm build`
 * mientras `pnpm dev` estaba vivo. El dev server queda con chunks rotos y
 * empieza a 404ear las páginas. Antes de gastar 30 minutos buscando un bug
 * que no existe, mejor abortar acá con un mensaje claro.
 *
 * Uso desde package.json:
 *   "build": "node ../../scripts/check-dev-port.js 3001 && next build"
 *
 * Cómo detectamos: intentamos conectar como cliente al puerto. Si conecta,
 * algo está escuchando — sin importar si es IPv4 o IPv6, que es el bug que
 * tenía la versión anterior de este script (next dev binds en IPv6 *:3001).
 */
const net = require('net');

const port = Number(process.argv[2]);
if (!port || Number.isNaN(port)) {
  console.error('❌ check-dev-port: falta el puerto como argumento.');
  process.exit(2);
}

function probarHost(host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resuelto = false;
    const acabar = (resultado) => {
      if (resuelto) return;
      resuelto = true;
      socket.destroy();
      resolve(resultado);
    };
    socket.setTimeout(800);
    socket.once('connect', () => acabar('OCUPADO'));
    socket.once('timeout', () => acabar('LIBRE'));
    socket.once('error', () => acabar('LIBRE'));
    socket.connect(port, host);
  });
}

(async () => {
  // Probamos IPv4 e IPv6 — si cualquiera contesta, alguien está escuchando.
  const [v4, v6] = await Promise.all([probarHost('127.0.0.1'), probarHost('::1')]);
  if (v4 === 'OCUPADO' || v6 === 'OCUPADO') {
    console.error('');
    console.error('  ❌ No puedo buildear: hay algo escuchando en el puerto', port + '.');
    console.error('');
    console.error('  Si es `pnpm dev`, apagalo antes (Ctrl+C en su terminal).');
    console.error('  Si no, matalo con:  lsof -ti:' + port + ' | xargs kill -9');
    console.error('');
    console.error('  Por qué este guard existe:');
    console.error('  `next build` y `next dev` comparten la carpeta .next/.');
    console.error('  Si buildeás con el dev vivo, el dev queda sirviendo chunks');
    console.error('  rotos y las páginas empiezan a 404. Prevenirlo > debuggearlo.');
    console.error('');
    process.exit(1);
  }
  process.exit(0);
})();
