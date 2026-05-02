# DK Production Manager

App full‑stack: **React (Vite) + Tailwind CSS + Node.js (Express) + PostgreSQL (Prisma)**.

## Démarrage rapide

### 1) Base de données (PostgreSQL)

Si tu utilises Docker Desktop:

```bash
docker compose up -d
```

> Si tu vois une erreur du type `dockerDesktopLinuxEngine ... introuvable`, démarre **Docker Desktop** (ou active le moteur Docker), puis relance la commande.

### 2) Backend (API)

Copie les variables d’env si besoin:

```bash
copy server\.env.example server\.env
```

Puis:

```bash
cd server
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

API: `http://localhost:3001` (health: `/api/health`)

### 3) Frontend (web)

Dans un autre terminal:

```bash
npm install
npm run dev
```

Le front est configuré pour proxy `/api` vers `http://localhost:3001`.

### 4) Tout lancer (option)

```bash
npm run dev:full
```

## Comptes de démo (seed)

- admin: `dakarai@dkproduction.com` / `admin123`
- manager: `alex.r@dkproduction.com` / `manager123`
- operator: `sarah.c@dkproduction.com` / `operator123`
- viewer: `maya.p@dkproduction.com` / `viewer123`

