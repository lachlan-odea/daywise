# Project Daybook — Marketing Website

A best-in-class SaaS marketing site for **Project Daybook**, the AI-powered teacher
productivity platform that turns everyday teaching into professional evidence — automatically.

> **Teach. Record. Evidence. Automated.**

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** (custom brand design system)
- **Framer Motion** (scroll & micro animations)
- **Lucide** (icons)

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start local dev server (http://localhost:5173)
npm run build    # production build → /dist
npm run preview  # preview the production build locally
```

## Project structure

```
public/                 Static assets (favicon)
src/
  components/           Reusable UI (Logo, Navbar, Footer, Reveal, Mockups)
  sections/            Landing-page sections (Hero, HowItWorks, Pricing, FAQ, …)
  App.tsx              Page composition
  index.css            Tailwind layers + component utilities
tailwind.config.js     Brand colors, fonts, animations
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
