# ReconEx

A fully wired Next.js 14+ starter focused on real-world SaaS foundations. It demonstrates how to combine MUI, Prisma/PostgreSQL, Auth.js (NextAuth) with Google SSO, Soketi/Pusher, TanStack Query, Zustand, Storybook, Jest, and Brevo so teams can start shipping features immediately.

## Highlights

- **Next.js App Router + Server Actions** with typed Prisma workflows and cache revalidation.
- **Component system** powered by MUI, Material React Table, mui-tiptap, mui-chips-input, notistack, and Storybook stories.
- **Analytics dashboard** showcases @mui/x-charts line, bar, and donut visualizations backed by mock housing data.
- **Authentication** via Auth.js (NextAuth) with Google sign-in restricted to company domains, plus a protected dashboard page.
- **State management** with TanStack Query, Axios, and Zustand for UI chrome such as theme toggling.
- **Realtime updates** using Soketi/Pusher server + client SDKs with a live post feed.
- **Tooling** ready for production: ESLint, Prettier, Jest + RTL, Storybook, Docker, and env validation with `@t3-oss/env-nextjs`.

## Project Layout

```
src/
  app/                 # App Router routes, layouts, server actions, API routes
  components/
    auth/              # Auth.js (NextAuth) session provider + widgets (login/logout/profile)
    forms/             # React Hook Form + Server Action examples
    layout/            # Global providers wrapper
    dashboard/         # Data visualisations and KPI widgets for the analytics page
    showcase/          # Component gallery demos (mui-tiptap, chips input, notifications)
    ui/                # Button, DataTable, PostList, ThemeToggle, etc.
  hooks/               # Custom hooks (e.g. realtime subscriptions)
  lib/                 # Prisma, Pusher, Axios, logger, validators, email helpers
  store/               # Zustand global UI store
  styles/              # MUI theme factory
  types/               # Shared TypeScript types
prisma/                # Prisma schema
.storybook/            # Storybook config with MUI ThemeProvider
```

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Copy the environment template**
   ```bash
   cp .env.example .env
   ```
   Fill in the Google OAuth, Brevo, and Soketi credentials. Generate `NEXTAUTH_SECRET` with `openssl rand -hex 32` if you do not already have one.
3. **Generate Prisma client & apply migrations**
   ```bash
   npm run prisma:generate
   npx prisma migrate dev --name init
   ```
4. **Run the development server**
   ```bash
   npm run dev
   ```
5. Visit `http://localhost:3000` for the app, `http://localhost:3000/dashboard` for the protected page, and `http://localhost:3000/api/posts` for the sample API route.

### Key Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js in development mode |
| `npm run build && npm start` | Production build & serve |
| `npm run lint` | Lint the repo using the flat ESLint config |
| `npm run format` | Format with Prettier |
| `npm run test` | Execute Jest + React Testing Library |
| `npm run storybook` | Launch Storybook with the MUI theme decorator |
| `npm run build-storybook` | Static Storybook export |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:dev:deploy` | Apply migrations in non-production envs |

## Feature Walkthrough

### UI / Component System

- `src/styles/theme.ts` defines the MUI theme used across the app and Storybook.
- `src/components/ui/Button.tsx` wraps MUI Button with a `loading` prop, plus a Storybook story (`Button.stories.tsx`) and Jest test (`Button.test.tsx`).
- `src/components/ui/DataTable.tsx` demonstrates Material React Table with filtering and sorting enabled by default.
- `src/components/ui/PostList.tsx` combines TanStack Query, Axios (`src/lib/axios.ts`), and `useRealtimePosts` to show how client/server state stay in sync.
- The `/components` route surfaces hands-on demos for the shared DataTable, `mui-chips-input`, notistack-powered toasts, and a fully themed `mui-tiptap` rich-text editor.

### Forms, Validation, and Server Actions

- `src/components/forms/CreatePostForm.tsx` uses React Hook Form + `zodResolver` for client validation.
- `src/lib/validators/post.ts` holds the shared Zod schema.
- `src/app/actions/postActions.ts` is a typed server action that validates again server-side, persists via Prisma, triggers Soketi, logs with Pino, and sends a Brevo transactional email.
- Success triggers revalidation of `/` and `/dashboard` so server-rendered content stays fresh.

### Data & API Layer

- `prisma/schema.prisma` contains Auth.js (NextAuth) compatible `User`, `Account`, `Session`, and `VerificationToken` models alongside `Post`.
- `src/lib/prisma.ts` reuses the Prisma client safely between hot reloads.
- `src/app/api/posts/route.ts` exposes a simple REST endpoint used by the PostList query hook.

### Authentication (Auth.js / NextAuth)

- `src/lib/auth/options.ts` centralises the NextAuth configuration (Prisma adapter, Google provider, domain allowlist).
- `src/app/api/auth/[...nextauth]/route.ts` exposes the Auth.js handler for the App Router.
- `src/components/auth/AuthProvider.tsx` wraps NextAuth's `SessionProvider` so client components can call `useSession`.
- `src/components/auth/AuthGate.tsx` renders the global AppBar + sidebar and gates content behind a Google sign-in prompt, reusing the shared `LoginButton`.
- `src/components/layout/AppHeader.tsx` surfaces the signed-in avatar, company email, theme toggle, and one-click sign-out button.
- `/dashboard` combines these providers with analytics widgets from `src/components/dashboard/` to present the data visualisations.

### State Management

- Zustand store (`src/store/uiStore.ts`) tracks the current theme mode. `ThemeToggle` uses it to flip between light/dark palettes.
- React Query lives inside `src/components/layout/AppProviders.tsx` alongside the ThemeProvider and AuthProvider.

### Realtime & Notifications

- `src/lib/pusherServer.ts` and `src/lib/pusherClient.ts` initialize Soketi-compatible server and browser clients using the validated env vars.
- `src/hooks/useRealtimePosts.ts` subscribes to the `posts` channel and invalidates React Query caches when server actions trigger events.
- `src/lib/email.ts` contains the Brevo transactional email helper that runs after every successful post creation.
- `src/components/layout/NotificationProvider.tsx` wraps notistack so any client component can `enqueueSnackbar` for theme-aware toasts.

### Environment Safety

- `src/env.mjs` validates server & client variables on boot using `@t3-oss/env-nextjs`. Importing it inside `next.config.ts` ensures builds fail fast when values are missing.
- `.env.example` lists every required variable with sample values (Google OAuth, Brevo, Soketi, database, app URLs).

### Tooling

- **ESLint**: `eslint.config.mjs` extends `next/core-web-vitals` with zero-config usage.
- **Prettier**: `.prettierrc` + `.prettierignore` keep formatting consistent.
- **Testing**: `jest.config.ts` (via `next/jest`) and `jest.setup.ts` enable RTL and jest-dom utilities.
- **Storybook**: `.storybook/preview.ts` applies the MUI theme/CssBaseline so stories match the app shell.
- **Logging**: `src/lib/logger.ts` exposes a configured Pino instance which is already used in server actions and API routes.

## Docker & Local Services

Use Docker for parity with production:

```bash
docker compose up --build
```

- `db` service runs PostgreSQL 16 with a persistent volume (`postgres-data`).
- `app` service builds the standalone Next.js image (see `Dockerfile`) and runs `npm run dev` with live code mounted from your host. Update `DATABASE_URL` inside `.env` to point at `db` when running under Compose.

## Coolify Deployment

- `docker-compose.coolify.yml` is tailored for Coolify. It builds the production image with the required environment variables injected at build time, then runs the standalone Next.js server on port 3000.
- In Coolify, define the following variables in the **Environment** panel so both build and runtime stages succeed:
  `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `SOKETI_APP_ID`, `SOKETI_KEY`, `SOKETI_SECRET`, `SOKETI_HOST`, `SOKETI_PORT`, `SOKETI_USE_TLS`, `NEXT_PUBLIC_SOKETI_KEY`, `NEXT_PUBLIC_SOKETI_HOST`, `NEXT_PUBLIC_SOKETI_PORT`, `NEXT_PUBLIC_SOKETI_USE_TLS`, and optionally `SKIP_ENV_VALIDATION`.
- Set `NEXTAUTH_URL`, `APP_URL`, and `NEXT_PUBLIC_APP_URL` to `https://reconex.envolvedi.com` and ensure the Coolify domain points to that host on port 3000.
- Because secrets are passed as build args, they will be baked into the client bundle where appropriate (e.g. `NEXT_PUBLIC_*` variables). Avoid committing production values; manage them solely through Coolify.

## Email & Realtime Integrations

- Brevo (`@getbrevo/brevo`) is initialized once in `src/lib/email.ts`. Provide `BREVO_API_KEY` and optional `BREVO_SENDER_EMAIL`.
- Soketi deployments need `SOKETI_APP_ID`, `SOKETI_KEY`, `SOKETI_SECRET`, `SOKETI_HOST`, `SOKETI_PORT`, and `SOKETI_USE_TLS`. Mirror host/port/TLS values with the `NEXT_PUBLIC_SOKETI_*` counterparts for browser usage.

## Extending ReconEx

- Add new domain modules under `src/app` and keep shared logic inside `src/lib` for reusability.
- Use `src/lib/logger.ts` for observability, and colocate additional env schemas in `src/env.mjs`.
- When introducing more server actions, follow the `CreatePostForm` pattern: Zod validation on both sides, Prisma access via `src/lib/prisma.ts`, and optional realtime/email/logging hooks.
- Create additional Storybook stories under `src/components/**/` to document UI primitives.

This starter aims to stay infrastructure-heavy but product-light. Plug in your own domain logic while keeping the best practices baked in here.
