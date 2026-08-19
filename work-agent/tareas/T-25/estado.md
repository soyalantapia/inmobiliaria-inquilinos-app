# T-25 · Conmutador de usuarios — SPEC CERRADA, implementación no iniciada

rama: `feat/reunion-camila-0308` · fase: 4 (spec) · **cero código**

## Por qué se frenó acá y no se implementó

1. **T-35 la bloquea.** T-25 convierte `pinHash` en la credencial para volverse otra persona.
   `scripts/onboarding-real.mjs:98` hace que los usuarios extra hereden el PIN (y la contraseña)
   del admin. Implementar T-25 sobre eso es sumar un segundo camino de escalamiento.
2. **Dos decisiones son del dueño, no técnicas:** el TTL del token conmutado (12 h vs los 15 días
   de hoy) y si entra el bloqueo por inactividad, que el modelo de amenazas marcó como riesgo #1
   y que está fuera del texto literal de T-25.

La spec completa está en `requerimientos.md`, lista para implementar sin volver a preguntar nada
una vez resueltas esas tres cosas.

## Lo que produjo el panel (10 agentes)

Ganador **unánime** (8/8/8 en las tres lentes): autoridad server-side, un solo token, hard nav.

Correcciones que los jueces le injertaron al ganador, todas verificadas a mano:

- **Nunca 401 por PIN incorrecto.** `manejarSesionVencida` (`client.ts:78-87`) dispara ante
  cualquier 401 con token: un PIN mal desloguearía al operador. 403/423/409/404, nunca 401.
- **Contador de fallos atómico.** El ganador lo escribía read-then-write; con requests
  concurrentes el bloqueo nunca se puebla y romper 5 dígitos baja de ~208 días a **~9**.
- **`verificarPinUsuario` no se toca** (seis endpoints de plata dependen de que siga aprobando),
  y un test de regresión lo blinda.
- **El barrido de estado arregla el logout de paso.** Hoy limpia 1 de 34 claves y no hace hard
  nav: la caché del operador anterior sobrevive a salir Y a entrar.
- **`POST /auth/pin` es el único endpoint de auth sin rate limit** (`auth.ts:660`).
- Auditoría: 2 valores de enum nuevos, no 5.

## La conclusión honesta que vale trasladar

Un PIN de 5 dígitos vendido como *seguridad* es un fraude: se tipea 30 veces por día con público
del otro lado del vidrio, y el lockout no protege contra el que te miró teclear. Vendido como
**trazabilidad con fricción baja** es honesto — y para eso sirve bien.
