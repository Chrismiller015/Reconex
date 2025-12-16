#!/bin/sh
set -e

echo "Starting ReconEx application..."

# Wait for database to be ready with retries
MAX_RETRIES=30
RETRY_COUNT=0

echo "Waiting for database to be ready..."
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if npx prisma db push --skip-generate --accept-data-loss 2>/dev/null; then
    echo "Database is ready!"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Database not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES), waiting 2 seconds..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Could not connect to database after $MAX_RETRIES attempts"
  echo "DATABASE_URL: $DATABASE_URL"
  exit 1
fi

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "Starting Next.js server..."
exec node server.js

