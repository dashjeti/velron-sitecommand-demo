# SiteCommand

A live, white-label demo of Velron Digital's Operations Intelligence Platform:
multi-site production, fleet, SHEQ/compliance and TSF monitoring, with role-based
dashboards for executives, project managers, supervisors, workshop, SHEQ and clients.

**Frontend-only demo**: all data is an in-memory seed (`src/demo/db.ts`), every
feature works, and refreshing the page resets it. No backend, no env vars.

## Run

```bash
npm install
npm run dev      # local
npm run build    # production build (tsc + vite)
```

## Deploy

Any static host. On Vercel: import the repo, framework "Vite", no environment
variables needed. `vercel.json` handles SPA routing.

---

Built by [Velron Digital](https://velrondigital.online).
