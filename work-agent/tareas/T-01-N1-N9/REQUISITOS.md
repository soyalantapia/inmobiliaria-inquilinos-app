# T-01-N1-N9 · La compuerta reporta, no frena — y yo dije que frenaba

**Prioridad:** 🟠 · **Experto:** OPS + **el dueño** (la acción que la cierra es de configuración)
**Origen:** revisar mis propias afirmaciones sobre lo que construí.

---

## El problema

Durante los últimos días construí `revision.yml`, le agregué la base de datos, le saqué el
`continue-on-error` y le sumé los builds. En cada paso dije —en los commits, en los comentarios
del YAML y en el chat— que **bloqueaba** y que **frenaba el merge**.

**No frena nada.** Verificado el 20/08:

| | verificado |
|---|---|
| Branch protection en `main` | **No existe.** `GET /branches/main/protection` → 404 *"Branch not protected"* |
| `deploy.yml` (Pages) | Se dispara con `on: push: branches: [main]`, **sin depender** de `Revisión`. El único `needs:` que tiene es entre sus propios jobs |
| Railway | Deploya con el push, y eso no se puede condicionar desde el repo |

O sea: si los cuatro jobs quedan en rojo, el código **sale a producción igual** y el rojo
aparece al costado, después. Que un job falle no es lo mismo que frenar un merge.

Lo curioso —y lo que hay que aprender— es que el encabezado original del workflow lo decía
bien: *"Esta compuerta NO bloquea el deploy todavía (…) Volverlo required es del dueño."* La
afirmación se me deslizó **después**, al sacar el `continue-on-error`: confundí "el job hace
fallar el workflow" con "el workflow frena algo". Son cosas distintas y la diferencia es
exactamente la que importa.

## Por qué es serio y no una cuestión de palabras

El riesgo es la **confianza falsa**. Un verde que no frena nada se lee igual que uno que sí. Este
proyecto ya tuvo el deploy de Pages roto **dos semanas y media** justamente porque nadie miraba
lo que nadie estaba obligado a mirar. Decir "ya hay compuerta" y que no la haya reproduce el
mismo agujero con otra cara.

## Lo que se hizo acá

Corregir las afirmaciones donde viven: el encabezado del workflow ahora abre con el aviso, y el
comentario del job `integracion` dice **"falla el workflow (que no es lo mismo que frenar el
merge)"** en vez de "BLOQUEA".

## Lo que falta, y es tuyo

**Marcar los cuatro checks como required en la branch protection de `main`:**
`revision`, `integracion`, `build` y `ramas-sin-integrar`.

Se hace en Settings → Branches → Add rule sobre `main`, o con:

```bash
gh api -X PUT repos/soyalantapia/inmobiliaria-inquilinos-app/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -F "required_status_checks[strict]=true" \
  -F "required_status_checks[contexts][]=revision" \
  -F "required_status_checks[contexts][]=integracion" \
  -F "required_status_checks[contexts][]=build" \
  -F "required_status_checks[contexts][]=ramas-sin-integrar" \
  -F "enforce_admins=false" \
  -F "required_pull_request_reviews=null" \
  -F "restrictions=null"
```

**No lo corrí yo**: es configuración del repositorio y cambia cómo trabaja todo el mundo.

### Lo que hay que saber antes de apretar

1. **Con `main` protegido, se acaba el `git push origin HEAD:main` directo.** Hoy todos los
   chats trabajan así. Habría que pasar a PRs, o poner `enforce_admins=false` y aceptar que el
   dueño puede saltearlo.
2. **`Revisión` se cancela sola seguido**, por el `cancel-in-progress` cuando llegan pushes
   encadenados. Un check cancelado no cuenta como aprobado: con `strict` habría que esperar a
   que corra la última.
3. **Railway sigue sin poder gatearse desde el repo.** La protección frena el *merge*, y con eso
   el deploy — pero si alguien corre `railway up`, sube igual.

## Alternativa más liviana, si la protección es demasiado

Hacer que `deploy.yml` dependa de `Revisión` con un trigger `workflow_run`. Eso al menos evita
publicar una demo rota. **No se hizo**: `deploy.yml` es el workflow del dueño, y con lo seguido
que se cancela `Revisión` el riesgo concreto es que la demo deje de publicarse sin que nadie
entienda por qué. Queda dicho, no hecho.
