import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(posts);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch posts");
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
