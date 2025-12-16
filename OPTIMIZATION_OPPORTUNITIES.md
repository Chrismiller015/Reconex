# ReconEx Optimization Opportunities

## 🔍 Current State Analysis

### Dependency Breakdown (1.3GB node_modules)

| Package | Size | Usage | Optimization Potential |
|---------|------|-------|----------------------|
| **@mui/icons-material** | **173MB** | 26 icons | 🔥 **HIGH** - Replace with tree-shakeable icons |
| @mui/material | 13MB | Core UI | ⚠️ Medium - Required, but could optimize imports |
| @mui/x-charts | 13MB | 1 file | 🔥 **HIGH** - Consider lighter alternative |
| @mui/x-date-pickers | 7.5MB | Not used! | 🔥 **HIGH** - Remove completely |
| material-react-table | ? | 7 files | ⚠️ Medium - Core feature, keep |
| @storybook/* | ~100MB+ | 1 story file | 🔥 **HIGH** - Remove or make optional |
| @tiptap/* | ~20MB | Rich text editor | ✅ Low - Required feature |
| @emotion/* | ~15MB | Required by MUI | ✅ Low - Dependency of MUI |
| Playwright | ~100MB | E2E tests | ⚠️ Medium - DevDep, but still installed |

---

## 🔥 HIGH IMPACT Optimizations (Non-Breaking)

### 1. **Replace @mui/icons-material with Tree-Shakeable Icons** ⭐⭐⭐
**Problem:** `@mui/icons-material` is **173MB** because it includes ALL Material icons, even though you only use 26.

**Current approach:**
```typescript
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
// Each import pulls in the entire icon package
```

**Solution A: Use @mui/material/SvgIcon with inline SVGs** (Best)
```typescript
// Create a custom icons file
// src/components/ui/icons.tsx
import SvgIcon from '@mui/material/SvgIcon';

export const CloseIcon = (props) => (
  <SvgIcon {...props}>
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </SvgIcon>
);

export const DownloadIcon = (props) => (
  <SvgIcon {...props}>
    <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
  </SvgIcon>
);
```

**Solution B: Use react-icons** (Easier, still better)
```bash
npm install react-icons  # Only 2MB!
```
```typescript
import { MdClose, MdDownload } from 'react-icons/md';
// Tree-shakeable, only includes what you import
```

**Impact:**
- **Savings:** 173MB → 2MB (171MB saved!)
- **Build time:** -2 to -3 minutes
- **Effort:** 2-3 hours to replace 26 imports

---

### 2. **Remove @mui/x-date-pickers** ⭐⭐⭐
**Problem:** 7.5MB package that's **not used anywhere** in the codebase.

**Solution:**
```bash
npm uninstall @mui/x-date-pickers
```

**Impact:**
- **Savings:** 7.5MB
- **Build time:** -30 seconds
- **Effort:** 1 minute

---

### 3. **Replace @mui/x-charts with Lightweight Alternative** ⭐⭐
**Problem:** 13MB package used in only 1 file (`HousingAnalytics.tsx`).

**Current usage:**
```typescript
// src/components/dashboard/HousingAnalytics.tsx
import { BarChart } from "@mui/x-charts/BarChart";
```

**Solution A: Use recharts** (More popular, lighter)
```bash
npm install recharts  # ~5MB vs 13MB
npm uninstall @mui/x-charts
```

**Solution B: Use Chart.js with react-chartjs-2** (Lightest)
```bash
npm install chart.js react-chartjs-2  # ~3MB total
npm uninstall @mui/x-charts
```

**Solution C: Use native SVG** (Smallest, but more work)
- Roll your own bar chart with SVG
- ~0MB additional dependencies

**Impact:**
- **Savings:** 8-10MB (depending on alternative)
- **Build time:** -1 minute
- **Effort:** 2-4 hours to migrate 1 component

---

### 4. **Make Storybook Optional / Remove** ⭐⭐
**Problem:** Storybook is ~100MB+ and only has 1 story file (`Button.stories.tsx`).

**Current usage:**
- 1 story file in `src/components/ui/Button.stories.tsx`
- `.storybook` config directory
- Scripts: `storybook`, `build-storybook`

**Options:**

**A. Remove completely** (if not actively using)
```bash
npm uninstall @storybook/nextjs @storybook/react storybook
rm -rf .storybook src/components/ui/Button.stories.tsx
# Remove scripts from package.json
```

**B. Move to separate repo** (if want to keep)
- Create `reconex-storybook` repo
- Develop components there, import as package

**C. Make it a workspace** (monorepo approach)
- Use npm workspaces
- Storybook in separate workspace
- Not installed in production builds

**Impact:**
- **Savings:** ~100MB
- **Build time:** -1 to -2 minutes
- **Effort:** 30 minutes (remove) or 4-6 hours (monorepo)

---

### 5. **Optimize MUI Imports** ⭐
**Problem:** Some files may be importing entire MUI modules instead of specific components.

**Bad:**
```typescript
import * as React from 'react';
import { Box, Button, Typography } from '@mui/material';
```

**Good:**
```typescript
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
```

**Solution:** Run a codebase audit and fix imports.

**Impact:**
- **Savings:** Minimal on disk, but better tree-shaking
- **Build time:** -30 seconds to -1 minute
- **Bundle size:** -5 to -10%
- **Effort:** 1-2 hours

---

## ⚠️ MEDIUM IMPACT Optimizations

### 6. **Code Splitting for Large Components** ⭐
**Problem:** Some components are very large:
- `BacDrilldownView.tsx` — 1,836 lines
- `pricingTableDb.ts` — 648 lines
- `RunSummaryView.tsx` — 633 lines

**Solution:** Use Next.js dynamic imports for heavy components.

**Before:**
```typescript
import { BacDrilldownView } from '@/components/runs/BacDrilldownView';
```

**After:**
```typescript
import dynamic from 'next/dynamic';

const BacDrilldownView = dynamic(
  () => import('@/components/runs/BacDrilldownView'),
  { loading: () => <CircularProgress /> }
);
```

**Impact:**
- **Initial bundle:** Smaller (lazy-loaded)
- **Build time:** Minimal change
- **User experience:** Faster initial page load
- **Effort:** 2-3 hours

---

### 7. **Remove Unused Dependencies** ⭐
**From depcheck analysis:**
- `@tanstack/react-table` — Unused (material-react-table wraps it)
- `@tiptap/extension-table-cell` — Unused
- `@tiptap/extension-table-header` — Unused
- `@tiptap/extension-table-row` — Unused
- `dayjs` — Unused (if not used anywhere)

**Solution:**
```bash
npm uninstall @tanstack/react-table \
  @tiptap/extension-table-cell \
  @tiptap/extension-table-header \
  @tiptap/extension-table-row \
  dayjs
```

**Impact:**
- **Savings:** ~10-15MB
- **Build time:** -30 seconds
- **Effort:** 5 minutes (verify not used, then uninstall)

---

### 8. **Optimize Prisma Client Generation** ⭐
**Problem:** Prisma generates a large client based on your schema.

**Current:**
```prisma
generator client {
  provider = "prisma-client-js"
}
```

**Optimized:**
```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native"]  // Only generate for current platform
  previewFeatures = []        // Disable unused features
}
```

**Impact:**
- **Savings:** ~5-10MB
- **Build time:** -10 to -20 seconds
- **Effort:** 5 minutes

---

## 📊 Optimization Impact Summary

| Optimization | Savings | Build Time | Effort | Risk |
|--------------|---------|------------|--------|------|
| **Replace @mui/icons-material** | **171MB** | **-2 to -3 min** | 2-3 hours | Low |
| **Remove @mui/x-date-pickers** | **7.5MB** | **-30 sec** | 1 min | None |
| **Replace @mui/x-charts** | **8-10MB** | **-1 min** | 2-4 hours | Low |
| **Remove/Optimize Storybook** | **100MB** | **-1 to -2 min** | 30 min - 6 hrs | Low |
| **Remove unused deps** | **10-15MB** | **-30 sec** | 5 min | None |
| **Optimize MUI imports** | **Bundle -5-10%** | **-30 sec** | 1-2 hours | None |
| **Code splitting** | **Bundle -10-20%** | **Minimal** | 2-3 hours | Low |
| **Optimize Prisma** | **5-10MB** | **-10 to -20 sec** | 5 min | None |
| **TOTAL** | **~300MB** | **-5 to -8 min** | 8-16 hours | Low |

---

## 🎯 Recommended Optimization Plan

### Phase 1: Quick Wins (1 hour, -4 to -5 minutes build time)
1. ✅ Remove @mui/x-date-pickers
2. ✅ Remove unused dependencies (dayjs, @tanstack/react-table, etc.)
3. ✅ Optimize Prisma client config
4. ✅ Remove Storybook (if not actively using)

**Expected result:** 1.3GB → 1.1GB, build time 7-10min → 5-7min

### Phase 2: Icon Replacement (2-3 hours, -2 to -3 minutes build time)
1. Install `react-icons`
2. Create icon mapping file
3. Replace all 26 @mui/icons-material imports
4. Test all pages
5. Uninstall @mui/icons-material

**Expected result:** 1.1GB → 900MB, build time 5-7min → 3-5min

### Phase 3: Charts Migration (2-4 hours, -1 minute build time)
1. Choose alternative (recharts recommended)
2. Migrate HousingAnalytics.tsx
3. Test dashboard
4. Uninstall @mui/x-charts

**Expected result:** 900MB → 890MB, build time 3-5min → 2.5-4.5min

### Phase 4: Advanced (4-6 hours, bundle size optimization)
1. Optimize MUI imports
2. Implement code splitting for large components
3. Audit and optimize large files

**Expected result:** Better runtime performance, faster page loads

---

## 🚀 Alternative: GitHub Actions CI/CD (Zero Server Build Time)

Instead of optimizing the build itself, **eliminate server builds entirely**:

### How It Works
1. **GitHub Actions** builds Docker image (free 2-core runner)
2. Push image to Docker Hub / GitHub Container Registry
3. **Coolify pulls pre-built image** (no build on server!)
4. Server just runs the image

### Benefits
- ✅ **Zero build time on server** (instant deploys)
- ✅ **No RAM/CPU pressure** on production server
- ✅ **Faster deployments** (pull image vs build from scratch)
- ✅ **Build failures don't affect production**
- ✅ **Free** (GitHub Actions has generous free tier)

### Effort
- 2-3 hours to set up GitHub Actions workflow
- Modify Coolify to use pre-built images

### Recommended?
**YES!** This is the best long-term solution. You can do Phase 1 optimizations first, then set up CI/CD to eliminate server builds entirely.

---

## 💡 Final Recommendation

**Short-term (Do this week):**
1. Phase 1 quick wins (1 hour) → Save 200MB, -4 to -5 min build time
2. Phase 2 icon replacement (2-3 hours) → Save 171MB, -2 to -3 min build time

**Total effort:** 3-4 hours
**Total savings:** 370MB, -6 to -8 minutes build time
**New build time:** 1-4 minutes (vs current 7-10 minutes)

**Medium-term (Next month):**
- Set up GitHub Actions CI/CD → **Zero server build time**

**Long-term (When stable):**
- Upgrade to Next.js 15 → Additional 20-30% build time improvement

