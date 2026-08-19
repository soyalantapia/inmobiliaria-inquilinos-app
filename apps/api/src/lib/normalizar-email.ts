/**
 * Normaliza un email para GUARDARLO.
 *
 * POR QUÉ VIVE ACÁ Y NO SUELTO EN UNA RUTA: desde T-23 el email del propietario dejó de ser un
 * dato de contacto y pasó a ser **la credencial** del portal. Los tres logins por OTP del
 * sistema —panel, inquilino y propietario— buscan `where: { email: <lo tipeado>.toLowerCase() }`,
 * y Postgres compara strings distinguiendo mayúsculas. O sea: **lo que se guarda tiene que
 * estar normalizado, o esa persona no puede entrar nunca.**
 *
 * El fallo era mudo, que es lo peor: el propietario pedía el código, el endpoint respondía `ok`
 * —no revela si el email existe, a propósito— y el código no llegaba jamás. Del otro lado se
 * ve como "el portal no anda", sin nada que mirar.
 *
 * Los otros dos modelos ya lo hacían, cada uno por su cuenta y con su propio comentario
 * explicando lo mismo (`Usuario` en el registro, `Inquilino` en el alta). Ahora la regla vive
 * en un solo lugar, testeada.
 *
 * NO valida: eso lo hace el zod de cada endpoint. Acá sólo se recorta y se baja a minúsculas.
 */
export function normalizarEmail(input: string | undefined | null): string {
  return (input ?? '').trim().toLowerCase();
}
