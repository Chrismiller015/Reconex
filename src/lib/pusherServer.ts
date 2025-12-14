import Pusher from "pusher";
import { env } from "@/env.mjs";

type PusherServerLike = Pick<Pusher, "trigger">;

const soketiConfigured =
  !!env.SOKETI_APP_ID &&
  !!env.SOKETI_KEY &&
  !!env.SOKETI_SECRET &&
  !!env.SOKETI_HOST &&
  !!env.SOKETI_PORT &&
  !!env.SOKETI_USE_TLS;

export const pusherServer: PusherServerLike = soketiConfigured
  ? new Pusher({
      appId: env.SOKETI_APP_ID!,
      key: env.SOKETI_KEY!,
      secret: env.SOKETI_SECRET!,
      host: env.SOKETI_HOST!,
      port: env.SOKETI_PORT!,
      useTLS: env.SOKETI_USE_TLS === "true",
      cluster: "mt1",
    })
  : {
      trigger: async () => {
        throw new Error("Realtime is not configured (missing Soketi env vars)");
      },
    };
