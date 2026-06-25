import { PageSkeleton } from "@/components/ui/Skeleton";

// Detail-shaped skeleton so opening a quote doesn't flash the quotes LIST
// skeleton and jump when the detail page mounts.
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
