# Bartender App

App PWA del ecosistema Deenex para gestionar el retiro parcial o total de productos por QR. El operador escanea el código del cliente, ve los productos pendientes y confirma la entrega.

## Estructura

- `client/` — Frontend React 19 + Vite 7 + TypeScript + Tailwind 4 + React Router 7 + html5-qrcode (PWA)

## Stack

Mismo stack que `deenex-supervisor` (Vite + React + Tailwind + Mongo en backend cuando exista).

### Tema
- Light theme (`color-scheme: light` forzado)
- Paleta `primary` / `neutral` heredada de `palta-app-frontend`
- Tipografía Satoshi (Fontshare)

## Desarrollo

```bash
cd client
npm install
npm run dev          # http://localhost:5180
```

## Estado actual

- Frontend con flujos: escaneo (cámara + manual), detalle de pedido con selector de cantidades, confirmación de entrega y listado de pedidos
- Datos en mock (`src/data/mockOrders.ts`)
- Backend pendiente
