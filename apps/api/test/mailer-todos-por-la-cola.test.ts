/**
 * T-31 · GUARDARRAÍL: ningún envío puede esquivar los dos carriles.
 *
 * POR QUÉ ESTE TEST EXISTE, y por qué mira el código fuente en vez de comportamiento.
 *
 * T-31 puso todos los mails detrás de dos funciones —`enviarEnCola` (throttle, para lo que
 * sale de a muchos) y `enviarYa` (directo, sólo el OTP)— porque veinte mails en ráfaga desde
 * la misma cuenta SMTP es la receta para que el proveedor los marque como spam, y ahí no se
 * entera NADIE del aumento.
 *
 * Ese invariante duró horas. Al integrar las ramas de los chats paralelos aparecieron TRES
 * `sendMail` nuevos (las notificaciones de reclamos de T-17) llamando al transporter directo:
 * se escribieron en paralelo a T-31, sin saber que la cola existía. No es culpa de nadie —
 * es lo que pasa cuando la regla vive sólo en un docblock.
 *
 * Los tests de comportamiento (`mailer-cola`, `mailer-otp-no-espera`) prueban que la cola
 * funciona; ninguno puede probar que TODOS la usen. Por eso éste lee el archivo: es la única
 * forma de que agregar un mail nuevo por afuera se note al instante en vez de en producción.
 *
 * SI ESTE TEST TE FALLA: no lo edites para que pase. Cambiá tu `t.sendMail(...)` por
 * `enviarEnCola(...)` — o por `enviarYa(...)` si, y sólo si, hay una persona mirando la
 * pantalla esperando ese mail (hoy eso es únicamente el OTP de login).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const MAILER = join(AQUI, '..', 'src', 'mailer.ts');

/**
 * Los dos únicos `sendMail` legítimos, ambos DENTRO de la plomería:
 *  - el que ejecuta la cola  → `(mail) => getTransporter()!.sendMail(mail)`
 *  - el de `enviarYa`        → `return t.sendMail(mail);`
 * Cualquier otro es un caller saltándose los carriles.
 */
const PERMITIDOS = [
  '(mail) => getTransporter()!.sendMail(mail)',
  'return t.sendMail(mail);',
];

describe('mailer · todos los envíos pasan por un carril (T-31)', () => {
  it('no hay ningún sendMail suelto fuera de enviarEnCola / enviarYa', () => {
    const fuente = readFileSync(MAILER, 'utf8');

    const infractores = fuente
      .split('\n')
      .map((linea, i) => ({ n: i + 1, texto: linea.trim() }))
      // Sólo llamadas reales: la firma de los helpers menciona `Transporter['sendMail']`
      // como TIPO, y eso no es una invocación.
      .filter((l) => /\.sendMail\s*\(/.test(l.texto))
      .filter((l) => !PERMITIDOS.some((ok) => l.texto.includes(ok)));

    expect(
      infractores,
      infractores.length === 0
        ? ''
        : `Estos envíos esquivan la cola de T-31 y salen en ráfaga:\n` +
            infractores.map((l) => `  mailer.ts:${l.n} → ${l.texto}`).join('\n') +
            `\nUsá enviarEnCola(...) — o enviarYa(...) sólo si alguien está esperando ese mail en pantalla.`,
    ).toEqual([]);
  });

  it('el carril directo es exactamente el de los mails que un request AWAITEA', () => {
    const fuente = readFileSync(MAILER, 'utf8');
    const directos = (fuente.match(/await enviarYa\(/g) ?? []).length;

    // Este test decía "el OTP es el ÚNICO", y esa regla era demasiado angosta: el
    // razonamiento que la justificaba —"si comparte la cola, un anuncio a 200
    // inquilinos lo deja esperando 80 segundos"— aplica igual a TODO mail que un
    // request awaitea antes de responder. La bienvenida del registro y las dos
    // invitaciones también, y estaban en la cola: durante un ajuste masivo de 220
    // contratos, un alta de contrato se colgaba detrás de 220 mails ≈ 88 s y moría
    // por timeout con el alta ya hecha.
    //
    // La regla ahora es la de verdad: **si tu caller hace `await`, va derecho; si
    // dispara con `void` y sigue, va por la cola.** Son cuatro, y el número está
    // fijo a propósito: sumar un quinto rompe este test, y ahí hay que decidir si
    // ese mail realmente lo espera alguien en pantalla o si sale de a muchos. Es
    // una decisión de producto (fricción vs deliverability), no un detalle.
    expect(
      directos,
      'El carril directo cambió. Los que van derecho son los que un request awaitea: ' +
        'OTP, bienvenida del registro, invitación al inquilino e invitación al equipo. ' +
        'Si agregaste otro, confirmá que alguien lo está esperando en pantalla.',
    ).toBe(4);
  });
});
