# ♟ Chess Tournament Manager

Swiss-system chess tournament manager with Google sign-in, Firestore storage, and a clean Vercel-inspired design. No backend server needed — Firebase handles everything client-side.

## Quick Start

```bash
# Install dependencies
npm install

# Set up Firebase config (create .env from .env.example)
cp .env.example .env
# Fill in your Firebase config values in .env

# Start dev server
npm run dev
```

## Deploy to Vercel

```bash
npm run build       # Builds to dist/
npx vercel          # Deploy (follow prompts)
```

Set the `PUBLIC_FIREBASE_*` environment variables in your Vercel project dashboard.

## Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Google** sign-in method
3. Create **Firestore Database** in test mode
4. Register a web app and copy the config into `.env`
5. Set the same env vars in Vercel for deployment

## Features

- **Swiss Pairing** — FIDE Dutch system (score groups, top-half vs bottom-half, color balance, no rematches)
- **Tiebreakers** — Buchholz, Sonneborn-Berger
- **Google Auth** — One-click sign in
- **Live Standings** — Animated leaderboard with podium, win/draw/loss bars, color-coded results
- **Panel-by-panel** — Simple wizard-style flow: Players → Rounds → Standings
- **Grandma-friendly** — Large buttons, clear labels, minimal steps
- **Children-friendly** — 🥇🥈🥉 podium, colorful progress bars, emoji badges

## Stack

Astro + React + Tailwind CSS v4 + Firebase
