# ReconEx Deployment Guide

## 🚀 Quick Start

### Prerequisites
- **Server Requirements:**
  - Minimum 6GB RAM (8GB recommended)
  - 4+ CPU cores
  - 20GB free disk space
  - Docker & Docker Compose installed

- **External Services:**
  - PostgreSQL database (Coolify-managed recommended)
  - Google OAuth credentials
  - Brevo API key (for email)
  - Soketi/Pusher (for real-time features)

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/reconex?schema=public

# Authentication
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.com
APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Google OAuth
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Email (Brevo)
BREVO_API_KEY=<from Brevo dashboard>
BREVO_SENDER_EMAIL=noreply@your-domain.com

# Real-time (Soketi/Pusher)
SOKETI_APP_ID=reconex
SOKETI_KEY=<your-key>
SOKETI_SECRET=<your-secret>
SOKETI_HOST=<your-soketi-host>
SOKETI_PORT=6001
SOKETI_USE_TLS=true

# Public Soketi config (for browser)
NEXT_PUBLIC_SOKETI_KEY=<same as SOKETI_KEY>
NEXT_PUBLIC_SOKETI_HOST=<your-soketi-host>
NEXT_PUBLIC_SOKETI_PORT=6001
NEXT_PUBLIC_SOKETI_USE_TLS=true

# Build optimization
SKIP_ENV_VALIDATION=true
```

## 📦 Deployment Methods

### Option 1: Coolify (Recommended)

1. **Create Application:**
   ```bash
   coolify-cli app create \
     --name ReconEx \
     --git-repository https://github.com/your-org/reconex.git \
     --git-branch main \
     --domains "https://reconex.your-domain.com"
   ```

2. **Set Environment Variables:**
   - Go to Coolify UI → Application → Environment Variables
   - Add all required variables from the list above

3. **Configure Health Check:**
   - Path: `/api/health`
   - Port: `3000`

4. **Deploy:**
   ```bash
   git push origin main  # Auto-deploys via webhook
   ```

### Option 2: Docker Compose

1. **Clone repository:**
   ```bash
   git clone https://github.com/your-org/reconex.git
   cd reconex
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Start services:**
   ```bash
   docker-compose -f docker-compose.coolify.yml up -d
   ```

## 🔧 Build Optimization

### Current Build Performance
- **First build (no cache):** 15-20 minutes
- **Subsequent builds (with cache):** 7-10 minutes
- **Image size:** ~800MB (production-only deps)
- **Peak RAM usage:** 5-6GB

### What Makes This Build Heavy?
1. **Large dependency footprint:** 1.3GB node_modules
   - Material-UI v7 + icons + charts + date pickers
   - TipTap rich text editor (6 packages)
   - Emotion CSS-in-JS
   - Prisma ORM

2. **Complex build process:**
   - TypeScript compilation (125 files)
   - Next.js optimization & bundling
   - Prisma client generation

### Optimizations Applied
✅ Self-hosted fonts (saves 3-4 min)
✅ Docker BuildKit npm cache mount (saves 2-3 min on rebuilds)
✅ Production-only dependencies (saves 60% image size)
✅ `.dockerignore` to exclude unnecessary files
✅ Removed unused dependencies (saved 100MB)

## 🩺 Health Checks

### Health Check Endpoint
```bash
curl https://your-domain.com/api/health
```

**Healthy response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-16T15:30:00.000Z",
  "checks": {
    "database": "connected"
  }
}
```

**Unhealthy response (503):**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-12-16T15:30:00.000Z",
  "checks": {
    "database": "disconnected"
  },
  "error": "Connection refused"
}
```

## 🐛 Troubleshooting

### Build Fails: "Prisma schema not found"
**Cause:** Prisma schema not copied before `npm ci`

**Fix:** Ensure Dockerfile has:
```dockerfile
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps
```

### Build Fails: "Unknown font Geist"
**Cause:** Next.js 14 doesn't support `Geist` font from `next/font/google`

**Fix:** Use self-hosted fonts (already implemented)

### Build Fails: "unstable_createUseMediaQuery is not a function"
**Cause:** MUI components used in server components during prerendering

**Fix:** Add `"use client";` to pages using MUI components

### Deployment Takes 20+ Minutes
**Causes:**
- Cold npm cache (first build)
- Server under-resourced (< 6GB RAM)
- Network issues (font downloads, npm registry)

**Fixes:**
- Use BuildKit cache mount (already implemented)
- Ensure server has 8GB RAM
- Self-host fonts (already implemented)

### App Shows "404 page not found" (Traefik)
**Cause:** Coolify domain/port not configured

**Fix:**
```bash
coolify-cli app update <uuid> \
  --domains "https://your-domain.com" \
  --ports-exposes "3000"
coolify-cli app restart <uuid>
```

### App Status: "running:unhealthy"
**Causes:**
1. Database connection failed
2. Health check not configured
3. App crashed on startup

**Debug:**
```bash
# Check logs
coolify-cli app logs <uuid> --lines 100

# Check DATABASE_URL
coolify-cli app env list <uuid> | grep DATABASE_URL

# Test health check
curl https://your-domain.com/api/health
```

## 📊 Monitoring

### Key Metrics to Watch
- **Build time:** Should be 7-10 min (with cache)
- **Image size:** Should be ~800MB
- **Memory usage:** 200-500MB at runtime
- **Health check:** Should return 200

### Logs
```bash
# Application logs
coolify-cli app logs <uuid> --follow

# Deployment logs
coolify-cli app deployments logs <uuid> <deployment-uuid> --follow
```

## 🔄 Rollback

If a deployment fails:

```bash
# List recent deployments
coolify-cli app deployments list <uuid>

# Rollback to previous commit
git revert HEAD
git push origin main
```

## 📝 Pre-Deployment Checklist

Run before every deployment:

```bash
./scripts/check-deployment-ready.sh
```

This checks:
- ✓ Required files exist
- ✓ No known configuration issues
- ✓ Build script is valid
- ✓ Environment variables documented

## 🚨 Known Issues

1. **Next.js 14 Security Vulnerability**
   - Current version (14.2.3) has a security issue
   - Consider upgrading to Next.js 15 when stable
   - See: https://nextjs.org/blog/security-update-2025-12-11

2. **Build Time Variability**
   - First build: 15-20 min (cold cache)
   - Subsequent: 7-10 min (warm cache)
   - Can spike to 30+ min on under-resourced servers

3. **MUI Prerendering Issues**
   - Some MUI components cause build failures in server components
   - Solution: Use `"use client";` directive on affected pages

## 📞 Support

If you encounter issues not covered here:
1. Check application logs: `coolify-cli app logs <uuid>`
2. Check deployment logs: `coolify-cli app deployments logs <uuid> <deployment-uuid>`
3. Verify environment variables are set correctly
4. Ensure server meets minimum requirements (6GB RAM, 4 cores)

