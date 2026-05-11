#!/usr/bin/env bash
# Builda las dos apps en modo static export para deployar a GitHub Pages.
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

# Apagar dev servers si los hay (el guard de build los detecta y aborta).
for puerto in 3000 3001; do
  pids=$(lsof -ti:$puerto 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "→ Apagando proceso en :$puerto"
    kill -9 $pids 2>/dev/null || true
  fi
done

[[ -f "$MW_INMO" ]] && mv "$MW_INMO" "$MW_INMO.bak"
[[ -f "$MW_INQ" ]] && mv "$MW_INQ" "$MW_INQ.bak"

cd "$ROOT"

rm -rf apps/inmobiliaria/.next apps/inquilino/.next out

echo ""
echo "▶ Build inmobiliaria"
STATIC_EXPORT=1 pnpm --filter inmobiliaria build

echo ""
echo "▶ Build inquilino"
STATIC_EXPORT=1 pnpm --filter inquilino build

# Combinamos los dos outputs bajo /out con la estructura que espera GH Pages
echo ""
echo "▶ Combinando outputs en ./out"
mkdir -p out/inmobiliaria out/inquilino
cp -R apps/inmobiliaria/out/. out/inmobiliaria/
cp -R apps/inquilino/out/. out/inquilino/

# Landing en la raíz del sitio que enlaza a las dos apps.
cp scripts/landing.html out/index.html

# .nojekyll para que GH Pages no ignore archivos con _
touch out/.nojekyll

echo ""
echo "✅ Listo. out/ tiene:"
ls -la out/ | head
echo ""
echo "Subí ./out a la branch gh-pages o dejá que el workflow lo haga."
