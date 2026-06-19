import { z } from 'zod';

/** Payload del JWT de un usuario de inmobiliaria. */
export const JwtUsuarioSchema = z.object({
  kind: z.literal('usuario'),
  userId: z.string(),
  inmobiliariaId: z.string(),
  rol: z.enum(['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA']),
});
export type JwtUsuario = z.infer<typeof JwtUsuarioSchema>;

/** Payload del JWT de un inquilino. */
export const JwtInquilinoSchema = z.object({
  kind: z.literal('inquilino'),
  inquilinoId: z.string(),
  inmobiliariaId: z.string(),
  contratoId: z.string().nullable(),
});
export type JwtInquilino = z.infer<typeof JwtInquilinoSchema>;

/**
 * Payload del JWT de un CO-INQUILINO. Identidad distinta del titular: no tiene
 * `inquilinoId` (no existe como `Inquilino`); accede al MISMO contrato pero con
 * un `permiso` acotado que se enforça server-side.
 */
export const JwtCoInquilinoSchema = z.object({
  kind: z.literal('co-inquilino'),
  coInquilinoId: z.string(),
  inmobiliariaId: z.string(),
  contratoId: z.string(),
  permiso: z.enum(['VER', 'PAGAR', 'COMPLETO']),
});
export type JwtCoInquilino = z.infer<typeof JwtCoInquilinoSchema>;

export const JwtPayloadSchema = z.discriminatedUnion('kind', [
  JwtUsuarioSchema,
  JwtInquilinoSchema,
  JwtCoInquilinoSchema,
]);
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// ---- Requests/Responses de auth ----

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const OtpRequestSchema = z.object({ email: z.string().email() });
export const OtpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const AuthResponseSchema = z.object({
  token: z.string(),
  nombre: z.string(),
  rol: z.enum(['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA']).optional(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
