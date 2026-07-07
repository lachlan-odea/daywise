# daywise — Marketing Website

A best-in-class SaaS marketing site for **daywise**, the AI-powered teacher
productivity platform that turns everyday teaching into professional evidence — automatically.

> **Teach. Talk. Done.**

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** (custom brand design system)
- **Framer Motion** (scroll & micro animations)
- **Lucide** (icons)
- **React Router** (marketing + app routing)
- **Firebase** — Authentication (email/password, Google, Microsoft) + Cloud Firestore

## Authentication

The site includes a real login flow backed by Firebase:

- `/login` and `/signup` — branded auth pages (email/password + Google + Microsoft)
- `/app` — a protected dashboard shell, only reachable when signed in
- User profiles are written to Firestore (`users/{uid}`) on first sign-in

**Before auth works you must configure Firebase.** See **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**
for step-by-step instructions (create the project, enable providers, add your `.env` values, and
set the GitHub Actions secrets for production). Until then, the pages render but sign-in shows a
"Firebase isn't configured yet" message.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start local dev server (http://localhost:5173)
npm run build    # production build → /dist
npm run preview  # preview the production build locally
```

## Project structure

```
public/                 Static assets (favicon, 404.html SPA fallback)
src/
  components/           Reusable UI (Logo, Navbar, Footer, Reveal, Mockups,
                        AuthLayout, SocialAuthButtons, ProtectedRoute)
  context/             AuthContext (Firebase auth state + actions)
  lib/                 firebase.ts (app init, auth, firestore, providers)
  pages/               LandingPage, Login, Signup, Dashboard (/app)
  sections/            Landing-page sections (Hero, HowItWorks, Pricing, FAQ, …)
  App.tsx              Router + AuthProvider
  index.css            Tailwind layers + component utilities
tailwind.config.js     Brand colors, fonts, animations
.env.example           Firebase config template (copy to .env)
```

## Brand

Colours are derived from the logo: **navy** `#132145`, **teal** `#17a085`, **sky** `#3491f0`.
The logo mark is rendered as inline SVG in `src/components/Logo.tsx` so it stays crisp at every
size. To use the original PNG artwork instead, drop it in `public/logo.png` and swap the
`<LogoMark />` component for an `<img>` tag.

## Sections

Dashboard/Home · Record Lesson · Curriculum Intelligence · Programs · History ·
Data & Reports — mirroring the product's planned interface.

## Deployment

The build output in `/dist` is fully static and deploys to any host (Vercel, Netlify,
Cloudflare Pages, GitHub Pages, S3, etc.). No server required.
