# Why ReconEx Builds Fine Locally But Struggles on Server

## 🖥️ Your Local Development Machine

### Resources Available
- **RAM:** 60GB total, 41GB available
- **CPU:** 16 cores
- **Disk:** 1.9TB total, 891GB free
- **OS:** Linux (Fedora 43)

### Build Environment
- **Node modules cached:** ✅ Persistent across builds
- **npm cache:** ✅ Reused between projects
- **Docker BuildKit cache:** ✅ Layers cached on disk
- **Other workloads:** Can be paused/backgrounded during build
- **Network:** Likely fast, stable connection

### What Happens During Local Build
```
npm ci (with cache):        30-60 seconds
prisma generate:            20-30 seconds
next build:                 2-3 minutes
Docker layer copying:       30-60 seconds
────────────────────────────────────────
Total:                      4-5 minutes
Peak RAM usage:             4-6GB (plenty of headroom)
CPU usage:                  100% (but 16 cores = smooth)
```

**Result:** Fast, reliable, no resource contention

---

## 🌐 Your Coolify Server

### Resources Available (Estimated)
Based on typical VPS/cloud server for Coolify:
- **RAM:** Likely 4-8GB total (shared with other apps)
- **CPU:** Likely 2-4 cores (shared with other apps)
- **Disk:** Varies, but often slower I/O than local NVMe
- **OS:** Linux (Docker containers)

### Build Environment
- **Node modules cached:** ⚠️ May be cleared between builds
- **npm cache:** ⚠️ Depends on Docker BuildKit mount config
- **Docker BuildKit cache:** ⚠️ May be limited by disk space
- **Other workloads:** Coolify, Postgres, other apps running
- **Network:** Shared bandwidth, potential throttling

### What Happens During Server Build
```
npm ci (cold cache):        4-6 minutes (downloading 1.3GB)
prisma generate:            30-60 seconds
next build:                 6-9 minutes (RAM pressure, CPU contention)
Docker layer copying:       2-3 minutes (slower disk I/O)
────────────────────────────────────────
Total:                      13-19 minutes
Peak RAM usage:             5-6GB (near or exceeding capacity!)
CPU usage:                  100% (but 2-4 cores = slow + blocks other apps)
```

**Result:** Slow, unreliable, resource starvation

---

## 🔥 Why Server Builds Fail

### 1. **RAM Exhaustion** (Most Common)
Your build needs **5-6GB peak RAM**:
- `npm ci`: 500MB-1GB
- `next build` with `NODE_OPTIONS=--max-old-space-size=4096`: **4GB**
- Docker overhead: 500MB-1GB
- Other running apps: 1-2GB

**If server has 4GB total RAM:**
```
Build needs:        5-6GB
Server has:         4GB
Deficit:            -1 to -2GB
Result:             OOM killer terminates build process
```

**If server has 8GB total RAM:**
```
Build needs:        5-6GB
Other apps using:   2-3GB
Available:          5GB
Result:             Builds succeed but slow, other apps degraded
```

### 2. **CPU Contention**
**Your local machine (16 cores):**
- Next.js build uses all 16 cores
- Each core processes TypeScript/Webpack in parallel
- Other apps barely affected

**Server (2-4 cores):**
- Next.js build uses all 2-4 cores
- Postgres, Coolify, other apps starved for CPU
- Build takes 2-3x longer
- Other apps become unresponsive

### 3. **Disk I/O Bottleneck**
**Your local machine (NVMe SSD):**
- Read/Write: 3000-7000 MB/s
- Writing 1.3GB node_modules: ~1-2 seconds

**Server (Cloud block storage):**
- Read/Write: 100-500 MB/s (10-30x slower)
- Writing 1.3GB node_modules: 10-30 seconds
- Docker layer copying: Much slower

### 4. **Network Variability**
**Your local machine:**
- Stable, fast connection
- npm registry: 50-100 Mbps
- Font downloads: Fast, no retries

**Server:**
- Shared bandwidth with other tenants
- npm registry: May be throttled
- Font downloads: 3-4 minutes with retries (before we self-hosted)
- DNS issues, packet loss, timeouts

### 5. **Cache Invalidation**
**Your local machine:**
- npm cache: Persistent in `~/.npm`
- Docker cache: Persistent in `/var/lib/docker`
- Rarely cleared

**Server:**
- npm cache: May be cleared to save disk space
- Docker cache: May be pruned by Coolify
- BuildKit cache: Limited by disk quota

### 6. **Concurrent Builds**
**Your local machine:**
- One build at a time (you control it)

**Server:**
- Multiple apps may deploy simultaneously
- Coolify may queue builds
- Resource contention multiplied

---

## 📊 Resource Comparison Table

| Resource | Your Local | Typical Server | Ratio |
|----------|------------|----------------|-------|
| **RAM** | 60GB | 4-8GB | **7-15x more** |
| **Available RAM** | 41GB | 2-4GB | **10-20x more** |
| **CPU Cores** | 16 | 2-4 | **4-8x more** |
| **Disk Speed** | NVMe (3000+ MB/s) | Block (100-500 MB/s) | **6-30x faster** |
| **Disk Space** | 891GB free | 20-100GB free | **9-45x more** |
| **Network** | Dedicated | Shared | **Varies** |
| **Workload** | Dev only | Multi-tenant | **Exclusive vs shared** |

---

## 🎯 Why Your Server Crashes Coolify

When ReconEx builds for 20+ minutes at peak resource usage:

```
ReconEx build consuming:
├── RAM: 5-6GB (75-100% of server capacity)
├── CPU: 100% of all cores
└── Disk I/O: Heavy writes

Other apps on server:
├── Coolify dashboard: Becomes unresponsive
├── Postgres: Queries slow/timeout
├── Other apps: Health checks fail
└── Docker daemon: Struggles to manage containers

Result:
├── Coolify thinks it's crashed (health checks timeout)
├── Other apps marked unhealthy
├── Server may trigger OOM killer
└── Entire server becomes unstable
```

---

## ✅ Solutions (Already Implemented)

### 1. **Reduce Build RAM Requirements**
- ❌ Before: 5-6GB peak
- ✅ After: Still 5-6GB (Next.js build inherently heavy)
- **Recommendation:** Upgrade server to 8GB minimum

### 2. **Reduce Build Time**
- ❌ Before: 20+ minutes
- ✅ After: 7-10 minutes (with optimizations)
- **Impact:** Less time blocking other apps

### 3. **Reduce Image Size**
- ❌ Before: ~2GB (all dependencies)
- ✅ After: ~800MB (production-only)
- **Impact:** Faster layer copying, less disk usage

### 4. **Optimize npm Cache**
- ✅ BuildKit cache mount: Reuses npm cache across builds
- **Impact:** 4-6 min npm ci → 30-60 seconds (on warm cache)

### 5. **Self-Host Fonts**
- ❌ Before: 3-4 minutes downloading from Google
- ✅ After: Instant (local files)
- **Impact:** Eliminates network dependency

---

## 🚀 Recommendations for Server

### Short-term (Do Now)
1. **Upgrade server RAM to 8GB minimum** (16GB ideal)
   - Prevents OOM during builds
   - Allows other apps to run smoothly

2. **Schedule builds during low-traffic periods**
   - Reduces impact on production apps
   - Use Coolify's manual deploy (not auto-deploy)

3. **Monitor resource usage during builds**
   ```bash
   # Watch RAM/CPU during build
   watch -n 1 'free -h && echo && docker stats --no-stream'
   ```

### Medium-term (Next Month)
1. **Consider dedicated build server**
   - Separate build server from production apps
   - Build images, push to registry, deploy to production server
   - Coolify supports this architecture

2. **Implement build queue**
   - Ensure only one heavy build runs at a time
   - Coolify has built-in queuing

### Long-term (Future)
1. **Upgrade to Next.js 15**
   - 20-30% faster builds with Turbopack
   - See `UPGRADE_NEXTJS15.md`

2. **Consider CI/CD pipeline**
   - Build on GitHub Actions (free 2-core runners)
   - Push pre-built image to Docker Hub
   - Coolify just pulls and runs (no build needed)
   - Build time on server: 0 minutes!

---

## 🎓 Key Takeaway

**Your local machine is a beast (60GB RAM, 16 cores, NVMe SSD).**

**Your server is a workhorse (4-8GB RAM, 2-4 cores, shared resources).**

ReconEx is a **heavyweight Next.js app** (1.3GB dependencies, 4GB build RAM, CPU-intensive).

It's like asking a Honda Civic to tow a trailer that a Ford F-350 handles easily. The Civic *can* do it, but it's slow, struggles, and might overheat.

**Solution:** Either make the trailer lighter (optimizations ✅ done) or get a bigger truck (upgrade server RAM).

