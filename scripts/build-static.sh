#!/usr/bin/env bash
# Builda las tres apps en modo static export para deployar a GitHub Pages.
#
# next.js no soporta middleware en static export, así que renombramos los
# archivos middleware.ts temporalmente y los restauramos al final (incluso
# si el build falla). También usamos STATIC_EXPORT=1 que activa el bloque
# `output: 'export'` en cada next.config.mjs.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MW_INMO="$ROOT/apps/inmobiliaria/src/middleware.ts"
MW_INQ="$ROOT/apps/inquilino/src/middleware.ts"

restaurar() {
  [[ -f "$MW_INMO.bak" ]] && mv "$MW_INMO.bak" "$MW_INMO" || true
  [[ -f "$MW_INQ.bak" ]] && mv "$MW_INQ.bak" "$MW_INQ" || true
}
trap restaurar EXIT

# Los tres dev servers, chequeados ANTES de buildear nada.
#
# 3003 es el del portal del propietario. NO va 3002: ese es el del API, que no tiene nada que
# ver con estos builds y matarlo sería sabotear a quien esté laburando al lado.
#
# POR QUÉ SE CHEQUEA ACÁ Y NO SE CONFÍA EN EL GUARD POR APP. El guard de `check-dev-port.js`
# sigue existiendo y está bien, pero salta recién al llegar a SU app: con el 3003 ocupado, el
# script buildeaba inmobiliaria e inquilino enteras —minutos— y recién ahí abortaba. Pasó.
#
# Y POR QUÉ NO ALCANZA CON `lsof`. En Git Bash de Windows `lsof` no existe, así que el
# `|| true` se lo comía y esto era un no-op silencioso: el script decía "Apagando proceso" sin
# apagar nada, y después el guard abortaba igual. Ahora se detecta con `/dev/tcp`, que es de
# bash y anda en los dos lados; si no se puede apagar, al menos se avisa temprano y con el
# puerto.
ocupados=""
for puerto in 3000 3001 3003; do
  (echo >"/dev/tcp/127.0.0.1/$puerto") >/dev/null 2>&1 || continue
  pids=$(lsof -ti:$puerto 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "→ Apagando proceso en :$puerto"
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
  # Se vuelve a mirar: si no había lsof no se mató nada, y si se mató puede tardar un instante.
  (echo >"/dev/tcp/127.0.0.1/$puerto") >/dev/null 2>&1 && ocupados="$ocupados $puerto"
done

if [[ -n "$ocupados" ]]; then
  echo ""
  echo "❌ Hay dev servers escuchando en:$ocupados"
  echo "   Apagalos antes de buildear (Ctrl+C en su terminal)."
  echo "   No se pudieron apagar solos: 'lsof' no está en este shell (típico en Windows)."
  echo ""
  echo "   Se aborta ACÁ y no a mitad de camino: si no, el build de las apps anteriores"
  echo "   se hace igual y se tira a la basura cuando falla la que tiene el puerto tomado."
  exit 1
fi

[[ -f "$MW_INMO" ]] && mv "$MW_INMO" "$MW_INMO.bak"
[[ -f "$MW_INQ" ]] && mv "$MW_INQ" "$MW_INQ.bak"

cd "$ROOT"

rm -rf apps/inmobiliaria/.next apps/inquilino/.next apps/propietario/.next out

echo ""
echo "▶ Build inmobiliaria"
STATIC_EXPORT=1 pnpm --filter inmobiliaria build

echo ""
echo "▶ Build inquilino"
# NEXT_PUBLIC_BASE_PATH se hornea en el bundle: lo usan los componentes que arman
# URLs absolutas para compartir (compartir-garante, certificado) — en GH Pages la
# app vive bajo este prefijo. En Railway NO se setea (basePath vacío = correcto).
NEXT_PUBLIC_BASE_PATH=/inmobiliaria-inquilinos-app/inquilino STATIC_EXPORT=1 pnpm --filter inquilino build

echo ""
echo "▶ Build propietario"
# NEXT_PUBLIC_DEMO=1 es lo ÚNICO que prende los datos de mentira del portal, y se escribe
# acá y en ningún otro lado (T-46). El portal es el que muestra plata rendida, así que su
# modo demo no puede colgarse de "no hay API": una app de producción a la que se le olvidó
# NEXT_PUBLIC_API_URL tiene que seguir diciendo "no estoy conectada" en vez de inventar
# números. Ver el docblock de apps/propietario/src/lib/api.ts.
# El basePath no se pasa: su next.config.mjs ya lo hornea en el bloque de export.
NEXT_PUBLIC_DEMO=1 STATIC_EXPORT=1 pnpm --filter propietario build

# Combinamos los tres outputs bajo /out con la estructura que espera GH Pages
echo ""
echo "▶ Combinando outputs en ./out"
mkdir -p out/inmobiliaria out/inquilino out/propietario
cp -R apps/inmobiliaria/out/. out/inmobiliaria/
cp -R apps/inquilino/out/. out/inquilino/
cp -R apps/propietario/out/. out/propietario/

# Root del sitio: picker simple (3 opciones — presentación, panel inmo, app inquilino).
# Para editarlo: scripts/picker.html
cp scripts/picker.html out/index.html

# Página de legales en /legales/: documentos preliminares (T&C, Privacidad, Datos).
# QW2-01: antes el footer apuntaba a `href="#"` y rebotaba al hero — peor que vacío.
# Ahora cada link va a /legales/#terminos|#privacidad|#datos y aterriza en una página
# real con la versión preliminar de cada documento + contacto legal.
# Para editar el contenido: scripts/legales-page.html
mkdir -p out/legales
cp scripts/legales-page.html out/legales/index.html

# Landing rica en /presentacion/: se genera desde landing-data.json + template.
# Para cambiar contenido de la landing, editás scripts/landing-data.json.
echo ""
echo "▶ Generando landing en /presentacion/ desde landing-data.json"
node scripts/build-landing.js

# .nojekyll para que GH Pages no ignore archivos con _
touch out/.nojekyll

echo ""
echo "✅ Listo. out/ tiene:"
ls -la out/ | head
echo ""
echo "Subí ./out a la branch gh-pages o dejá que el workflow lo haga."
