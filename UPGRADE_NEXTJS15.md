# Upgrading to Next.js 15

## Why Upgrade?

### Performance Improvements
- **Faster builds:** 20-30% faster compilation with Turbopack
- **Better caching:** Improved build cache reduces subsequent build times
- **Smaller bundles:** Better tree-shaking and optimization
- **Security:** Fixes critical vulnerability in Next.js 14.2.3

### Expected Impact on ReconEx
- **Build time:** 7-10 min → 5-7 min (with Turbopack)
- **Bundle size:** 10-15% smaller
- **Dev experience:** Faster hot reload

## Breaking Changes to Address

### 1. React 19 Required
Next.js 15 requires React 19, which has breaking changes:

**Current:**
```json
"react": "18.3.1",
"react-dom": "18.3.1"
```

**After upgrade:**
```json
"react": "^19.0.0",
"react-dom": "^19.0.0"
```

**Impact on ReconEx:**
- Material-UI v7 is compatible with React 19 ✅
- TipTap needs testing with React 19 ⚠️
- All other dependencies should be compatible ✅

### 2. `next.config` Changes
Minimal changes needed since we're already using `.mjs` format.

### 3. Font Optimization
Next.js 15 has improved font optimization, but we're already self-hosting fonts, so no changes needed.

## Upgrade Steps

### 1. Update Dependencies
```bash
npm install next@latest react@latest react-dom@latest
npm install @types/react@latest @types/react-dom@latest --save-dev
```

### 2. Update ESLint Config
```bash
npm install eslint-config-next@latest --save-dev
```

### 3. Test Build
```bash
npm run build
```

### 4. Test Application
- [ ] Authentication flow (Google OAuth)
- [ ] File uploads
- [ ] Run comparisons
- [ ] Real-time updates (Pusher)
- [ ] Pricing table
- [ ] Settings pages

### 5. Update Dockerfile (if needed)
No changes expected, but verify:
- Build still succeeds
- Image size remains ~800MB
- Health check still works

## Risks & Mitigation

### High Risk
- **TipTap compatibility with React 19**
  - Mitigation: Test rich text editor thoroughly
  - Fallback: Stay on Next.js 14 until TipTap confirms React 19 support

### Medium Risk
- **Material-UI edge cases**
  - Mitigation: Run full E2E test suite
  - Fallback: Pin MUI to current version

### Low Risk
- **Next.js API changes**
  - Mitigation: Review Next.js 15 migration guide
  - Most APIs are backward compatible

## Timeline Recommendation

**Option 1: Upgrade Now (Aggressive)**
- Pros: Faster builds immediately, security fix
- Cons: Potential bugs, testing overhead
- Timeline: 1-2 days

**Option 2: Upgrade After Stabilization (Conservative)**
- Pros: Let community find bugs first
- Cons: Delayed performance benefits, security risk remains
- Timeline: Wait 2-3 months

**Option 3: Staged Upgrade (Recommended)**
1. Upgrade on development branch
2. Run full test suite
3. Deploy to staging environment
4. Monitor for 1 week
5. Deploy to production
- Timeline: 1 week

## Testing Checklist

### Build & Deploy
- [ ] Local build succeeds
- [ ] Docker build succeeds
- [ ] Coolify deployment succeeds
- [ ] Build time improved (measure before/after)
- [ ] Image size acceptable

### Functionality
- [ ] Home page loads
- [ ] Authentication works (login/logout)
- [ ] File library (upload, download, delete)
- [ ] Run creation and comparison
- [ ] BAC drilldown views
- [ ] Pricing table CRUD
- [ ] Settings pages
- [ ] Real-time updates work

### Performance
- [ ] Page load times acceptable
- [ ] No console errors
- [ ] No hydration errors
- [ ] Memory usage normal

### E2E Tests
```bash
npm run test:e2e
```

All Playwright tests should pass.

## Rollback Plan

If upgrade causes issues:

```bash
# Revert package.json changes
git checkout HEAD -- package.json package-lock.json

# Reinstall old dependencies
npm ci

# Rebuild
npm run build

# Redeploy
git add -A
git commit -m "Revert Next.js 15 upgrade"
git push origin main
```

## Resources

- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/12/05/react-19)
- [Next.js 14 Security Advisory](https://nextjs.org/blog/security-update-2025-12-11)

## Decision

**Recommendation:** Wait 1-2 weeks for Next.js 15 to stabilize, then do a staged upgrade.

**Rationale:**
1. Current build time (7-10 min) is acceptable after optimizations
2. Security vulnerability is low severity for our use case (internal tool)
3. React 19 is very new (released Dec 2024)
4. Let community identify edge cases first
5. Focus on stability over cutting-edge performance

