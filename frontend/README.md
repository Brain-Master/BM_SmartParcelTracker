# Frontend — BM Smart Parcel Tracker

React 18+, Vite, TailwindCSS, TanStack Table. PWA-ready.

## Stack (frozen)

- React 19, Vite 7
- Tailwind CSS 4
- TanStack Table (Master Table grouping: Parcel → OrderItems)
- React Router
- Shadcn/UI: add when needed via `npx shadcn@latest init`

## Run

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API proxy: `/api` → http://localhost:8000

## Structure

- `src/pages/` — DesktopDashboard (§4.1 Command Center)
- `src/components/` — MasterTable (TanStack Table, tags pills, protection colors)
- `src/types/` — API types (Order, Parcel, OrderItem, ParcelRow)
- `public/manifest.json` — PWA manifest

## Mobile (§4.2)

- FAB + barcode scanner and "Содержимое посылки" + "Принять выбранное" to be added.
- Use `html5-qrcode` or similar for scanner.
