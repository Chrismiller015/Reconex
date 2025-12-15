import { FileLibraryView } from "@/components/files/FileLibraryView";

export default function FileLibraryPage() {
  // Keep this page as a server component, but avoid importing MUI here.
  // MUI should stay inside client components to prevent Next.js build-time prerender crashes in Coolify.
  return <FileLibraryView />;
}



