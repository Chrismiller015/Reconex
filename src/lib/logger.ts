import type { DestinationStream } from "pino";
import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

// Keep logger dependency-free and lint-clean for CI/test environments.
// If you want pretty logs locally, prefer running `pino-pretty` via tooling/CLI.
export const logger = pino({ level }) as unknown as pino.Logger & { destination?: DestinationStream };
