# T-25-N1 · La matriz de permisos prometía un PIN que el server no pide

- tomada: 2026-08-20T16:20Z
- rama: `fix/T-25-N1-pin-decorativo`
- fase: TERMINADA

## Cómo apareció

Buscando el último hueco de cobertura en `packages/shared` (`requierePinPara`, sin tests).
La hipótesis inicial era peor de lo que resultó: que el panel siguiera **pidiéndole el PIN** al
operador mientras el server aprobaba todo.

**Esa hipótesis era falsa y conviene decirlo.** `PinPromptDialog` es un shim honesto: renderiza
`null`, no muestra ningún prompt y ejecuta la acción directamente. Mantuvieron la API del
componente para no tocar los ~9 call sites. La eliminación del PIN se hizo prolija.

## Lo que sí estaba mal

Siete capacidades de plata seguían declarando `requierePin: true` en la matriz compartida:
confirmar pago, rechazar pago, revertir conciliación, aprobar contrato, **rendir al
propietario**, devolver depósito y eliminar gasto de caja.

Y `matriz-permisos-card.tsx` las renderizaba con un candado (`aria-label="Requiere PIN"`) más
una leyenda explícita: *"Las acciones marcadas con 🔑 **piden el PIN del usuario**"*.

Era falso desde que el PIN se sacó de la plataforma. Y **en la peor pantalla para serlo**: la
matriz de permisos es exactamente donde alguien va a entender qué protege su sistema. Un admin
que la mira concluye que revertir una conciliación o rendirle a un propietario tienen un segundo
factor, y no lo tienen.

Alguien ya lo había notado —el docblock de `bloqueo-inactividad.tsx` dice que ese flag "es
decorativo"— pero el icono siguió ahí.

## Qué se hizo

1. **Sacar el candado y la leyenda** del panel: es lo que ve el usuario.
2. **Sacar el flag de los datos**, no sólo del display: mientras el `true` esté ahí, el próximo
   que arme una pantalla con la matriz vuelve a pintarlo.
3. **Dejar el campo `requierePin?`** con el porqué escrito, para que rehabilitarlo sea una línea.
4. **`test/pin-coherencia.test.ts`** — el guardarraíl.

**No prohíbe el PIN: exige coherencia entre las dos mitades.** Si mañana el producto decide
volver a pedirlo, el test falla hasta que el server lo verifique de verdad — que es el orden
correcto, porque una promesa de seguridad sin backend es peor que no tenerla. Detecta que
`pin.ts` dejó de ser el stub mirando si aparece `bcrypt`/`pinHash`/`compare(`.

El tercer test fija lo que **sí** protege esas acciones hoy: el ROL. Las cuatro más sensibles
siguen siendo exclusivas de ADMIN, y eso el server lo resuelve contra la base en cada request.

**Verificación por mutación:** le devolví el flag a `rendicion.confirmar` y el guardarraíl se
puso en rojo.

## Lo que NO se pudo verificar

El cambio es visible en pantalla, pero la matriz está detrás del login del panel y un agente no
ingresa credenciales. Queda verificado lo verificable: `tsc` en 0 en los 5 paquetes, el icono y
su leyenda ya no se renderizan, y ninguna capacidad declara el flag.

## Migraciones

Ninguna. En el server no cambia nada: `auth/pin.ts` queda igual.

## Tests

- `test/pin-coherencia.test.ts` — 3 nuevos, mutación verificada.
- Suite puro: **63 archivos / 600 tests**. `tsc` 0 en los 5 paquetes.
