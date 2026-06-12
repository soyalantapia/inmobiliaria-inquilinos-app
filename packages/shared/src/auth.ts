import { z } from 'zod';

/** Payload del JWT de un usuario de inmobiliaria. */
export const JwtUsuarioSchema = z.object({
  kind: z.literal('usuario'),
  userId: z.string(),
  inmobiliariaId: z.string(),
  rol: z.enum(['ADMIN', 'OPERADOR', 'CARGA']),
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

export const JwtPayloadSchema = z.discriminatedUnion('kind', [
  JwtUsuarioSchema,
  JwtInquilinoSchema,
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
  rol: z.enum(['ADMIN', 'OPERADOR', 'CARGA']).optional(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
