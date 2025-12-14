"use client";

import { useEffect } from "react";
import { subscribeToChannel } from "@/lib/pusherClient";

export const useRealtimePosts = (onNewPost: () => void) => {
  useEffect(() => {
    const subscription = subscribeToChannel("posts");
    if (!subscription) {
      return undefined;
    }

    const handler = () => onNewPost();
    subscription.channel.bind("new-post", handler);

    return () => {
      subscription.channel.unbind("new-post", handler);
      subscription.unsubscribe();
    };
  }, [onNewPost]);
};
