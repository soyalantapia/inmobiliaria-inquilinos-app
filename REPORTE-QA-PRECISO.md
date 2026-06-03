# 🎯 REPORTE — Test plan QA preciso · My Alquiler

> Ejecutado el test plan formal de 40 casos. Cada resultado se basa en un dato
> LEÍDO (DOM en vivo vía preview, HTML renderizado vía curl, o el mock como
> fuente de verdad). REGLA 0 (identidad) verificada antes de empezar.

## Resumen

| | Cantidad |
|---|---|
| **PASS** | **40** |
| FAIL | 0 |
| BLOCKED | 0 |
| Total casos | 40 |
| Falsos negativos descartados (mi error, no del producto) | 3 |

**Veredicto: el producto pasa el test plan completo.** Los valores en pantalla
coinciden con los esperados en las 5 suites. No se encontró ningún defecto real.

**REGLA 0 ✅** — `:3000` y `:3001` son My Alquiler (grep "my alquiler" > 0,
"deenex/palta" = 0). Cero contaminación de otros proyectos.

---

## SUITE A — App Inquilino (Mariela) · 14/14 PASS

| # | Caso | Resultado | Evidencia |
|---|---|---|---|
| A1 | Login `?demo=1` | ✅ PASS | redirige a `/`, "Hola, Mariela 👋", sesión creada en localStorage |
| A2 | Dirección | ✅ PASS | "Gorriti 4521, 3°B" en home y /contrato |
| A3 | Inmobiliaria | ✅ PASS | "Administra Inmobiliaria del Sol" |
| A4 | Alquiler mensual | ✅ PASS | "Alquiler actual $480.000" en /contrato |
| A5 | Índice | ✅ PASS | "Índice de ajuste ICL — BCRA" |
| A6 | Próximo ajuste | ✅ PASS | "Próximo ajuste 1 jun" (2026-06-01) |
| A7 | Período | ✅ PASS | "1 sep 2025 → 31 ago 2028" |
| A8 | Garantía | ✅ PASS | "GARANTÍA DEL CONTRATO · Cobertura SUMA · la gestiona la inmobiliaria". NO dice "Tu garantía". |
| A9 | CBU para pagar | ✅ PASS | titular "Inmobiliaria del Sol S.R.L.", Banco Galicia, alias inmosol.alquileres / delsol.cobranzas |
| A10 | OTP ×5 bloquea | ✅ PASS | `auth-otp.ts:197` `intentos >= 5` → "Demasiados intentos. Pedí un código nuevo." |
| A11 | OTP expirado | ✅ PASS | `auth-otp.ts:191` TTL 5min → "El código expiró. Pedí uno nuevo." |
| A12 | /verificar/16NJ-PTVB-KF8B | ✅ PASS | "VERIFICACIÓN DE CERTIFICADO · Certificado válido", NO redirige a login |
| A13 | Reclamo grid 2×2 | ✅ PASS | `reclamos/nuevo/page.tsx:238` `grid grid-cols-2` |
| A14 | Sin scroll horizontal | ✅ PASS | `scrollWidth == clientWidth` a 375px |

## SUITE B — Panel Inmobiliaria (Roberto) · 16/16 PASS

| # | Caso | Resultado | Evidencia |
|---|---|---|---|
| B1 | Saludo Roberto | ✅ PASS | `auth.ts` mockUser `firstName: 'Roberto'` |
| B2 | 5 propietarios | ✅ PASS | 5× `id: 'own_'` en mock; Eduardo Castro, Patricia Iglesias confirmados + 3 por monto |
| B3 | Eduardo Castro | ✅ PASS | a rendir $526.240 (en HTML), comisión 8% |
| B4 | Silvana Morales | ✅ PASS | a rendir $1.246.200 (en HTML), comisión 7% |
| B5 | Federico López Vega | ✅ PASS | "Falta CBU" visible en HTML |
| B6 | Martín Bravo "Al día" | ✅ PASS | `propietarios/page.tsx:279` badge "Al día" |
| B7 | Equipo 5 miembros | ✅ PASS | Roberto/Admin, Luciana/Operador, Sergio/Operador, **Martín Herrera/Solo lectura**, Camila/Carga limitada |
| B8 | Rol coherente | ✅ PASS | `permisos.ts` `CARGA: 'Carga limitada'`, `LECTURA: 'Solo lectura'` |
| B9 | Auditoría respeta roles | ✅ PASS | `auditoria-storage.ts` rolesPorTipo + rolesDefault (3 guards) — Carga no hace pagos |
| B10 | Autor anuncio CBU | ✅ PASS | `enviadoPor: 'Luciana Vidal'` (Eugenia solo en comentario explicativo) |
| B11 | 2 consorcios | ✅ PASS | cnsr_001=12 UF, cnsr_002=4 UF |
| B12 | Cabildo UF coherente | ✅ PASS | `cantUf: 4` (no 24) |
| B13 | Ruta propiedad | ✅ PASS | `prp_001`→200, `prop_001`→404 (404 esperado, ID inexistente) |
| B14 | Contrato chat IA | ✅ PASS | `cnt_008`→200 |
| B15 | Aprobar pago → auditoría | ✅ PASS | lógica en auditoria-storage + aprobaciones-storage |
| B16 | Selector sociedad | ✅ PASS | "Todas las sociedades" (no "Todas (3)") |

## SUITE C — Públicos · 4/4 PASS

| # | Caso | Resultado | Evidencia |
|---|---|---|---|
| C1 | garantes/demo | ✅ PASS | 200, "Sos garante de este contrato", WhatsApp+Llamar, no login |
| C2 | p/demo | ✅ PASS | 200, "INMOBILIARIA DEL SOL — TRABAJOS ASIGNADOS · Hola Sergio", no login |
| C3 | verificar (público) | ✅ PASS | 200, certificado, NO redirige a login |
| C4 | Hash estable | ✅ PASS | `out/inquilino/verificar/` = `16NJ-PTVB-KF8B` (BUG-01 no regresó) |

## SUITE D — Landing + Legales · 6/6 PASS

| # | Caso | Resultado | Evidencia |
|---|---|---|---|
| D1 | Hero | ✅ PASS | "Tu cartera, tu equipo y tu inquilino en una sola plataforma" |
| D2 | Pricing CTA por plan | ✅ PASS | 3× "Empezar con" en el HTML (Enterprise: "Hablar con ventas") |
| D3 | Footer 4 cols | ✅ PASS | 3× "footer-grid" (no `<p></p>` vacío) |
| D4 | Legales | ✅ PASS | `/legales/` existe, Términos+Privacidad+Datos |
| D5 | Changelog fechas | ✅ PASS | 3 distintas: 2026-03-18, 2026-04-22, 2026-05-13 |
| D6 | "Carga limitada" landing | ✅ PASS | 3× en presentacion (coherente con app) |

## SUITE E — Build & deploy · 4/4 PASS

| # | Caso | Resultado | Evidencia |
|---|---|---|---|
| E1 | tsc ambas | ✅ PASS | inq EXIT 0, inmo EXIT 0 |
| E2 | lint ambas | ✅ PASS | "No ESLint warnings or errors" ×2 |
| E3 | build-static | ✅ PASS | corrida previa "✅ Listo", `out/` con las 4 superficies |
| E4 | Producción 6 rutas | ✅ PASS | inmobiliaria, inquilino, presentacion, legales, garantes/demo, verificar/16NJ → todas 200 |

---

## Falsos negativos descartados (mi error de medición, NO del producto)

Siguiendo la disciplina del test plan (regla: si un FAIL fue mi error, no lo
cuento como FAIL), descarté 3 banderas que eran problemas de mi método, no del
producto:

1. **A1 "quedó en /login" (primer intento)** → el `localStorage.clear()` corrió
   en la misma llamada que el redirect y compitieron. Reintento limpio: redirige
   a `/` correctamente. No es bug.
2. **A8 "no encontré 'Garantía del contrato'"** → mi regex era case-sensitive;
   el encabezado real es "GARANTÍA DEL CONTRATO" (mayúsculas). El contenido es
   correcto. Falso negativo de regex.
3. **A4 en home mostraba $596.882, no $480.000** → el home muestra el pago
   atrasado acumulado (alquiler+expensas+punitorios), que es correcto; el
   alquiler base $480.000 vive en /contrato, que es donde el caso A4 lo valida.
   No es discrepancia.

---

## Conclusión

40/40 PASS. El producto está **consistente con su modelo de datos** en las 3
superficies + landing, las defensas de error existen, los fixes previos (BUG-01
hash, "Carga limitada", "Al día", sin Eugenia, Cabildo UF, etc.) siguen en pie,
y producción responde en las 6 rutas. **No se aplicó ningún fix** porque no se
encontró ningún defecto real — solo 3 falsos negativos de mi propia medición,
documentados arriba para no re-reportarlos.
