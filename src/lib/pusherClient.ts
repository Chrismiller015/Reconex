"use client";

import Pusher, { type Channel } from "pusher-js";

let client: Pusher | null = null;

const getHost = () => process.env.NEXT_PUBLIC_SOKETI_HOST ?? "localhost";
const getPort = () => Number(process.env.NEXT_PUBLIC_SOKETI_PORT ?? 6001);
const getUseTLS = () => (process.env.NEXT_PUBLIC_SOKETI_USE_TLS ?? "false") === "true";

export const getPusherClient = () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!process.env.NEXT_PUBLIC_SOKETI_KEY) {
    console.warn("NEXT_PUBLIC_SOKETI_KEY is not defined. Realtime features are disabled.");
    return null;
  }

  if (!client) {
    client = new Pusher(process.env.NEXT_PUBLIC_SOKETI_KEY, {
      wsHost: getHost(),
      wsPort: getPort(),
      forceTLS: getUseTLS(),
      cluster: "mt1",
      enabledTransports: ["ws", "wss"],
    });
  }

  return client;
};

export const subscribeToChannel = (
  channelName: string,
): { channel: Channel; unsubscribe: () => void } | null => {
  const pusher = getPusherClient();
  if (!pusher) {
    return null;
  }
  const channel = pusher.subscribe(channelName);
  return {
    channel,
    unsubscribe: () => pusher.unsubscribe(channelName),
  };
};
