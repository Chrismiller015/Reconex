import { FileLibraryView } from "@/components/files/FileLibraryView";

// Force dynamic rendering to avoid build-time prerender issues with MUI in Next.js 14
export const dynamic = "force-dynamic";

export default function FileLibraryPage() {
  // Keep this page as a server component, but avoid importing MUI here.
  // MUI should stay inside client components to prevent Next.js build-time prerender crashes in Coolify.
  return <FileLibraryView />;
}



