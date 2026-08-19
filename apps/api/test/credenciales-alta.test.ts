import { describe, it, expect } from 'vitest';
// @ts-expect-error -- .mjs sin tipos: es un script de operaciones, no parte del build de la API.
import { passwordDeUsuarioExtra, MIN_PASSWORD, PIN_SE_CREA_EN_LA_SESION } from '../../../scripts/lib/credenciales-alta.mjs';

/**
 * CAZABUG — los usuarios extra del alta heredaban la contraseña Y el PIN del admin.
 *
 * `scripts/onboarding-real.mjs` creaba cada usuario de `usuariosExtra` así:
 *
 *     passwordHash: bcrypt.hashSync(u.password ?? A.password, 10),
 *     pinHash:      bcrypt.hashSync(u.pin      ?? A.pin,      10),
 *
 * Los dos `??` caían en las credenciales del ADMIN. Si al alta no se le pasaba
 * una contraseña propia para cada persona, la cajera quedaba con la contraseña
 * de la administradora.
 *
 * Y no era latente: `POST /auth/login` (auth.ts:113) hace `bcrypt.compareSync`
 * contra `passwordHash`, así que un usuario de rol bajo podía entrar como ADMIN
 * —hoy, sin adivinar nada, con una credencial que ya conoce porque es la suya—
 * y sin dejar rastro: para el sistema es el admin logueándose.
 *
 * El arreglo NO es acordarse de pasar contraseñas: es que la función que decide
 * la contraseña de un extra **no reciba al admin**. No puede heredarle algo que
 * no tiene. Eso es lo que fijan estos tests.
 *
 * Tests PUROS: la lib no lee disco ni abre conexiones (por eso vive separada del
 * script, que sí hace las dos cosas al importarse).
 */

describe('un usuario extra del alta NUNCA hereda credenciales', () => {
  it('la función ni siquiera recibe al admin: heredarle es imposible por la forma', () => {
    // Este test es sobre la FIRMA, no sobre el resultado. Si alguien le agrega un
    // segundo parámetro con el admin, esto sigue verde pero el `?? A.password`
    // vuelve a ser posible — por eso el test de abajo cubre el comportamiento.
    expect(passwordDeUsuarioExtra.length).toBe(1);
  });

  it('sin contraseña propia queda en null: la cuenta entra por OTP', () => {
    expect(passwordDeUsuarioExtra({ email: 'caja@inmo.com' }).password).toBeNull();
    expect(passwordDeUsuarioExtra({ email: 'caja@inmo.com', password: '' }).password).toBeNull();
    expect(passwordDeUsuarioExtra({ email: 'caja@inmo.com', password: null }).password).toBeNull();
  });

  it('con contraseña propia, se usa esa', () => {
    const r = passwordDeUsuarioExtra({ email: 'caja@inmo.com', password: 'la-suya-propia' });

    expect(r.password).toBe('la-suya-propia');
    expect(r.error).toBeUndefined();
  });

  it('una contraseña corta se rechaza nombrando al usuario, no se completa con otra', () => {
    const r = passwordDeUsuarioExtra({ email: 'caja@inmo.com', password: 'corta' });

    expect(r.password).toBeUndefined();
    expect(r.error).toContain('caja@inmo.com');
    expect(r.error).toContain(String(MIN_PASSWORD));
  });

  it('una contraseña que no es texto se rechaza en vez de hashear un objeto', () => {
    expect(passwordDeUsuarioExtra({ email: 'x@y.com', password: 1234 }).error).toBeTruthy();
    expect(passwordDeUsuarioExtra({ email: 'x@y.com', password: {} }).error).toBeTruthy();
  });

  it('el error nombra al usuario aunque falte el email, para poder ubicarlo en el input', () => {
    expect(passwordDeUsuarioExtra({ password: 'ab' }).error).toBeTruthy();
  });

  it('no explota con un input vacío o nulo', () => {
    expect(passwordDeUsuarioExtra({}).password).toBeNull();
    expect(passwordDeUsuarioExtra(undefined).password).toBeNull();
  });
});

describe('el PIN no se escribe desde el alta, para nadie', () => {
  it('la constante que va al alta es null', () => {
    // El alta usa `pinHash: PIN_SE_CREA_EN_LA_SESION`. Es una constante y no un
    // comentario justamente para que quien venga a poner un PIN en el alta se
    // choque con algo que explica por qué no.
    expect(PIN_SE_CREA_EN_LA_SESION).toBeNull();
  });
});
