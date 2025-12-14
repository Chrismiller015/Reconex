import type { DestinationStream } from "pino";
import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

const createDevStream = (): DestinationStream | undefined => {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pretty = require("pino-pretty");
    return pretty({
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    });
  } catch (error) {
    console.warn("pino-pretty not available, falling back to JSON logs.", error);
    return undefined;
  }
};

const devStream = createDevStream();

export const logger = devStream ? pino({ level }, devStream) : pino({ level });
