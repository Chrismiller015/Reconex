# --- Base dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache ca-certificates && update-ca-certificates
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY prisma ./prisma
RUN npx prisma generate

# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache ca-certificates && update-ca-certificates

ARG DATABASE_URL
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG APP_URL
ARG NEXT_PUBLIC_APP_URL
ARG BREVO_API_KEY
ARG BREVO_SENDER_EMAIL
ARG SOKETI_APP_ID
ARG SOKETI_KEY
ARG SOKETI_SECRET
ARG SOKETI_HOST
ARG SOKETI_PORT
ARG SOKETI_USE_TLS
ARG NEXT_PUBLIC_SOKETI_KEY
ARG NEXT_PUBLIC_SOKETI_HOST
ARG NEXT_PUBLIC_SOKETI_PORT
ARG NEXT_PUBLIC_SOKETI_USE_TLS
ARG SKIP_ENV_VALIDATION=true

ENV DATABASE_URL=${DATABASE_URL}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV APP_URL=${APP_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV BREVO_API_KEY=${BREVO_API_KEY}
ENV BREVO_SENDER_EMAIL=${BREVO_SENDER_EMAIL}
ENV SOKETI_APP_ID=${SOKETI_APP_ID}
ENV SOKETI_KEY=${SOKETI_KEY}
ENV SOKETI_SECRET=${SOKETI_SECRET}
ENV SOKETI_HOST=${SOKETI_HOST}
ENV SOKETI_PORT=${SOKETI_PORT}
ENV SOKETI_USE_TLS=${SOKETI_USE_TLS}
ENV NEXT_PUBLIC_SOKETI_KEY=${NEXT_PUBLIC_SOKETI_KEY}
ENV NEXT_PUBLIC_SOKETI_HOST=${NEXT_PUBLIC_SOKETI_HOST}
ENV NEXT_PUBLIC_SOKETI_PORT=${NEXT_PUBLIC_SOKETI_PORT}
ENV NEXT_PUBLIC_SOKETI_USE_TLS=${NEXT_PUBLIC_SOKETI_USE_TLS}
ENV SKIP_ENV_VALIDATION=${SKIP_ENV_VALIDATION}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Production runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache ca-certificates && update-ca-certificates
ENV NODE_ENV=production
ENV PORT=3000
ENV RECONEX_STORAGE_DIR=/app/storage/uploads

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
# Note: copying node_modules from builder to ensure devDependencies (like prisma CLI) are available for migration script if needed,
# though ideally we'd prune. For now, safety first.
COPY --from=builder /app/node_modules ./node_modules

# Create storage directory and assign permissions
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]