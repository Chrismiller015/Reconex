import { RunsListView } from "@/components/runs/RunsListView";

// Force dynamic rendering to avoid build-time prerender issues with MUI in Next.js 14
export const dynamic = "force-dynamic";

export default function RunsPage() {
  // Avoid importing MUI in a server `page.tsx` to prevent Next.js build-time prerender crashes in Coolify.
  return <RunsListView />;
}



