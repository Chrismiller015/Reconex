import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    // Auth is optional for the initial ReconEx release (no role gating per spec).
    NEXTAUTH_SECRET: z.string().min(1).optional(),
    NEXTAUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    // Optional third-party integrations (boilerplate leftovers; keep optional).
    BREVO_API_KEY: z.string().min(1).optional(),
    BREVO_SENDER_EMAIL: z.string().email().optional(),
    SOKETI_APP_ID: z.string().min(1).optional(),
    SOKETI_KEY: z.string().min(1).optional(),
    SOKETI_SECRET: z.string().min(1).optional(),
    SOKETI_HOST: z.string().min(1).optional(),
    SOKETI_PORT: z.string().min(1).optional(),
    SOKETI_USE_TLS: z.enum(["true", "false"]).optional(),

    // ReconEx settings
    RECONEX_STORAGE_DIR: z.string().min(1).optional(),
    RECONEX_MAX_UPLOAD_BYTES: z.string().min(1).optional(),
    APP_URL: z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_SOKETI_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SOKETI_HOST: z.string().min(1).optional(),
    NEXT_PUBLIC_SOKETI_PORT: z.string().min(1).optional(),
    NEXT_PUBLIC_SOKETI_USE_TLS: z.enum(["true", "false"]).optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
    SOKETI_APP_ID: process.env.SOKETI_APP_ID,
    SOKETI_KEY: process.env.SOKETI_KEY,
    SOKETI_SECRET: process.env.SOKETI_SECRET,
    SOKETI_HOST: process.env.SOKETI_HOST,
    SOKETI_PORT: process.env.SOKETI_PORT,
    SOKETI_USE_TLS: process.env.SOKETI_USE_TLS,
    RECONEX_STORAGE_DIR: process.env.RECONEX_STORAGE_DIR,
    RECONEX_MAX_UPLOAD_BYTES: process.env.RECONEX_MAX_UPLOAD_BYTES,
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SOKETI_KEY: process.env.NEXT_PUBLIC_SOKETI_KEY,
    NEXT_PUBLIC_SOKETI_HOST: process.env.NEXT_PUBLIC_SOKETI_HOST,
    NEXT_PUBLIC_SOKETI_PORT: process.env.NEXT_PUBLIC_SOKETI_PORT,
    NEXT_PUBLIC_SOKETI_USE_TLS: process.env.NEXT_PUBLIC_SOKETI_USE_TLS,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
