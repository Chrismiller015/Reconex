"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createPostSchema, type CreatePostInput } from "@/lib/validators/post";
import { logger } from "@/lib/logger";
import { pusherServer } from "@/lib/pusherServer";
import { sendTransactionalEmail } from "@/lib/email";

export type CreatePostActionResult = {
  message?: string;
  error?: string;
};

export const createPostAction = async (
  values: CreatePostInput,
): Promise<CreatePostActionResult> => {
  const parsed = createPostSchema.safeParse(values);

  if (!parsed.success) {
    const formErrors = parsed.error.flatten();
    const message = [...formErrors.formErrors, ...Object.values(formErrors.fieldErrors).flat()].join(", ");
    return { error: message || "Invalid input" };
  }

  try {
    const post = await prisma.post.create({
      data: parsed.data,
    });

    await Promise.all([
      pusherServer
        .trigger("posts", "new-post", { id: post.id, title: post.title })
        .catch((error) => logger.error({ err: error }, "Failed to emit pusher event")),
      sendTransactionalEmail({
        to: "founders@example.com",
        subject: `New post created: ${post.title}`,
        htmlContent: `<p>${post.content}</p>`,
      }).catch((error) => logger.error({ err: error }, "Failed to send Brevo email")),
    ]);

    revalidatePath("/");
    revalidatePath("/dashboard");

    logger.info({ postId: post.id }, "Post created successfully");
    return { message: "Post created successfully" };
  } catch (error) {
    logger.error({ err: error }, "Failed to create post");
    return { error: "Something went wrong while creating the post" };
  }
};
