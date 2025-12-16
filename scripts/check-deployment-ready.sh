#!/bin/bash
# Pre-deployment validation script
# Run this before deploying to catch issues early

set -e

echo "🔍 Checking deployment readiness..."

# Check required files exist
echo "✓ Checking required files..."
required_files=(
  "package.json"
  "package-lock.json"
  "Dockerfile"
  "docker-compose.coolify.yml"
  "prisma/schema.prisma"
  "next.config.mjs"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing required file: $file"
    exit 1
  fi
done

# Check for common issues
echo "✓ Checking for common issues..."

# Check if next.config.ts exists (should be .mjs)
if [ -f "next.config.ts" ]; then
  echo "❌ Found next.config.ts - should be next.config.mjs for Next.js 14"
  exit 1
fi

# Check if build script has invalid flags
if grep -q "next build --webpack" package.json; then
  echo "❌ Found invalid --webpack flag in build script"
  exit 1
fi

# Check if Dockerfile has proper layer ordering
if ! grep -q "COPY prisma ./prisma" Dockerfile; then
  echo "⚠️  Warning: Prisma schema might not be copied in Dockerfile"
fi

# Check environment variables template
echo "✓ Checking environment variables..."
required_env_vars=(
  "DATABASE_URL"
  "NEXTAUTH_SECRET"
  "NEXTAUTH_URL"
  "APP_URL"
  "NEXT_PUBLIC_APP_URL"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
)

echo "Required environment variables for deployment:"
for var in "${required_env_vars[@]}"; do
  echo "  - $var"
done

# Estimate build resources
echo ""
echo "📊 Estimated build requirements:"
echo "  - RAM: 5-6GB peak (4GB for Next.js build + 1-2GB for npm)"
echo "  - CPU: All cores (TypeScript + Webpack)"
echo "  - Disk: ~2GB for build artifacts"
echo "  - Time: 7-10 minutes (with cache), 15-20 minutes (cold)"
echo ""

echo "✅ Deployment readiness check passed!"
echo ""
echo "Next steps:"
echo "  1. Ensure all required env vars are set in Coolify"
echo "  2. Verify DATABASE_URL points to Coolify-managed Postgres"
echo "  3. Check server has at least 6GB RAM available"
echo "  4. Push to main branch to trigger deployment"

