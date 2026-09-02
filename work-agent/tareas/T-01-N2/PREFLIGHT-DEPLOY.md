# Pre-flight de T-01 y T-02 — las trece migraciones, auditadas una por una

**Para qué es esto.** T-01 dice "aplicar las migraciones pendientes" y T-02 "deployar los tres
servicios". Este documento es la verificación previa: qué hace cada migración, cuáles pueden
fallar sobre datos reales, en qué orden va cada cosa y qué mirar antes de tocar nada.

Auditado el 19/08/2026 leyendo las trece migraciones y el `Dockerfile`. **No se aplicó ninguna
ni se consultó la base de producción**: todo lo de acá sale del código.

---

## 1. Lo primero, porque cambia el trabajo: T-01 y T-02 son la MISMA cosa

`apps/api/Dockerfile:30`:

```
CMD ["sh", "-c", "pnpm db:deploy && exec node dist/index.js"]
```

`db:deploy` es `prisma migrate deploy`. O sea: **el contenedor aplica las migraciones pendientes
antes de arrancar la app, en cada deploy.** No hay un paso manual de T-01 que hacer aparte.

Tres consecuencias:

1. **"Primero la migración, después el código" está garantizado por construcción.** Cinco de las
   trece migraciones lo piden explícitamente en sus comentarios; las cinco quedan satisfechas
   solas por el `&&`.
2. **Si una migración falla, la app NO arranca.** El `&&` corta. En Railway el contenedor viejo
   sigue sirviendo hasta que el nuevo pasa el healthcheck, así que el modo de falla esperable es
   "el deploy no toma", no "la API se cae" — pero conviene mirar los logs y no dar por hecho que
   quedó arriba.
3. **Deployar la API es el paso que aplica las migraciones.** El orden entre servicios importa:
   **API primero**, después los dos fronts.

---

## 2. Las trece, y qué riesgo tiene cada una

| # | Migración | Qué hace | Riesgo |
|---|---|---|---|
| 1 | `rol_caja` | `ADD VALUE 'CAJA'` | ninguno |
| 2 | `movimiento_caja_sin_propiedad` | columna nullable | ninguno |
| 3 | `evento_contrato_renovacion` | `ADD VALUE 'RENOVACION'` | ninguno |
| 4 | `otp_propietario` | tabla nueva | ninguno |
| 5 | `email_propietario_minusculas` | UPDATE de datos | **mirar antes** (§3) |
| 6 | `limpiar_pines_heredados` | guarda evidencia + UPDATE | ninguno — **pero ver §3.3** |
| 7 | `dni_persona_solo_digitos` | UPDATE de datos | **mirar antes** (§3) |
| 8 | `propietario_baja_logica` | columna con default | ninguno |
| 9 | `conmutador_usuarios` | 4 × `ADD VALUE` | ninguno |
| 10 | `destinatario_por_aviso` | tabla nueva + único | ninguno |
| 11 | `historial_reparto` | tabla nueva | ninguno |
| 12 | `rendicion_moneda` | columna con default | ninguno |
| 13 | `sacar_texto_del_inquilino_de_gastos` | UPDATE de datos | ninguno |

### Lo que se verificó, y no se dio por sentado

- **Los cuatro `ALTER TYPE ... ADD VALUE` usan `IF NOT EXISTS`** y **no usan el valor nuevo en la
  misma migración**. Esto importa: PostgreSQL rechaza usar un valor de enum recién agregado
  dentro de la misma transacción, y Prisma corre cada migración en una. Ninguna cae en eso.
- **El `CREATE UNIQUE INDEX` de `destinatario_por_aviso` va sobre una tabla recién creada y
  vacía.** No puede chocar con datos existentes, que es el modo clásico en que un índice único
  voltea un deploy.
- **Ningún `DROP COLUMN` ni `DROP TABLE` real.** Los "DROP" que aparecen buscando a ciegas están
  todos dentro de comentarios que explican cómo revertir.

---

## 3. Las que conviene mirar antes (consultas de SOLO LECTURA)

Las dos primeras normalizan datos ya cargados: ninguna puede fallar —se verificó—, pero las dos
pueden dejar filas sin tocar que después hay que resolver a mano. La tercera no necesita nada
antes, pero deja una tabla que sí hay que mirar DESPUÉS.

### `email_propietario_minusculas`

Pasa a minúsculas el email de los propietarios, que desde T-23 es **la credencial del portal**:
un propietario cargado como `Juan.Perez@Gmail.com` nunca matchea al loguear, pide el código y no
le llega nunca.

```sql
-- ¿A cuántos afecta?
SELECT id, "inmobiliariaId", email FROM propietarios WHERE email <> lower(trim(email));

-- ¿Deja duplicados dentro de una misma inmobiliaria?
SELECT "inmobiliariaId", lower(trim(email)) AS email, count(*)
FROM propietarios WHERE trim(email) <> ''
GROUP BY 1, 2 HAVING count(*) > 1;
```

**No puede fallar:** se verificó que `Propietario.email` **no tiene** constraint único en el
schema. Si la segunda consulta devuelve filas, no es un bloqueante — dos propietarios de la misma
inmobiliaria pueden compartir email legítimamente (un matrimonio, el contador de varios dueños).

### `dni_persona_solo_digitos`

Deja el DNI en dígitos. Acá **sí** hay `@@unique([inmobiliariaId, dni])`, así que un UPDATE
ingenuo reventaría el deploy.

```sql
-- ¿Cuántos DNI están sin normalizar?
SELECT count(*) FROM personas
WHERE dni IS NOT NULL AND dni <> regexp_replace(dni, '\D', '', 'g');
```

**No puede fallar, y se verificó leyendo el SQL, no el comentario:** el `UPDATE` lleva un
`NOT EXISTS` que excluye toda fila cuyo DNI normalizado chocaría con otra del mismo tenant. Esas
quedan **sin tocar a propósito**, para fusionarlas a mano después. Si dos filas normalizan al
mismo valor, se saltean las dos.


### `limpiar_pines_heredados` — deja una tabla de evidencia

Borra los `pinHash` heredados (T-35), y **antes** copia a `_t35_usuarios_con_credencial` quiénes
tenían PIN y password seteados. Sin ese paso previo el UPDATE destruye la única forma de
responder la pregunta que abrió T-35: *¿hubo usuarios con la credencial del admin?*

Es idempotente (`CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING`) y el orden es el
correcto: preserva y después borra, todo en la misma transacción.

**Después del deploy, esa tabla responde la pregunta de T-35:**

```sql
SELECT * FROM "_t35_usuarios_con_credencial" WHERE "teniaPassword" = true;
```

Si devuelve filas, esos usuarios tenían acceso con credenciales que no eligieron ellos, y hay que
rotarlas. Es la acción urgente que T-35 dejó anotada.

⚠️ La tabla **no está en `schema.prisma`** a propósito: es evidencia, no modelo. Quien corra
`prisma migrate dev` alguna vez va a ver drift por ella. Borrarla cuando ya no haga falta.

---

## 4. El acople código ↔ migración que NO se puede romper

Tres migraciones agregan valores de enum que el código ya escribe. **Deployar el código sin su
migración rompe la funcionalidad al escribir el evento**, y ya pasó una vez con `RENOVACION`:
renovar un contrato fallaba y la renovación entera se perdía en silencio.

| Migración | Valores | Lo escribe |
|---|---|---|
| `rol_caja` | `CAJA` | la asignación de rol (T-03) |
| `evento_contrato_renovacion` | `RENOVACION` | la renovación de contrato |
| `conmutador_usuarios` | `SESION_CONMUTADA`, `CONMUTACION_RECHAZADA`, `PIN_DESBLOQUEADO`, `PIN_ELIMINADO` | el conmutador de usuarios (T-25) |

Como el contenedor migra antes de arrancar, esto queda cubierto **siempre que se deploye la API
con su propio código**. El riesgo aparecería sólo si alguien aplicara las migraciones por un lado
y deployara por otro, o al revés.

**Y hay un orden con T-03:** `rol_caja` tiene que estar aplicada antes de reasignar a nadie al rol
CAJA. Como se aplica sola en el deploy: **T-02 antes que T-03**.

---

## 5. El orden sugerido

1. **Correr las dos consultas de solo lectura de §3.** No bloquean nada; sirven para saber
   cuántas filas quedan para revisar a mano después.
2. **Deployar la API.** Acá se aplican las trece. Mirar los logs de arranque: si el deploy no
   toma, el motivo va a estar en la salida de `prisma migrate deploy`.
3. **Deployar los dos fronts** (panel y PWA).
4. **Recién ahí, T-03** (reasignar al personal de mostrador a CAJA), que necesita `rol_caja`
   aplicada.

---

## 6. Lo que este documento NO cubre

- **No se consultó la base de producción.** Cuántas filas afecta cada UPDATE es exactamente lo que
  responden las consultas de §3, y hay que correrlas contra la base real.
- **No se verificó el estado actual de las migraciones aplicadas.** Las trece son las que están en
  el repo y no figuran como aplicadas según T-01; si alguna ya corrió, `migrate deploy` la saltea
  sin hacer nada.
- **T-04** (la duda de los $850) sigue necesitando su propia consulta: no es parte de esto.
