import Pusher from "pusher";
import { env } from "@/env.mjs";

export const pusherServer = new Pusher({
  appId: env.SOKETI_APP_ID,
  key: env.SOKETI_KEY,
  secret: env.SOKETI_SECRET,
  host: env.SOKETI_HOST,
  port: env.SOKETI_PORT,
  useTLS: env.SOKETI_USE_TLS === "true",
  scheme: env.SOKETI_USE_TLS === "true" ? "https" : "http",
  keepAlive: true,
  cluster: "mt1",
});
