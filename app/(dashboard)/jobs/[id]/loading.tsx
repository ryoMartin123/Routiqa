import { PageSkeleton } from "@/components/ui/Skeleton";

// Detail-shaped skeleton so opening a job doesn't flash the jobs LIST skeleton
// (a different layout) and jump when the detail page mounts.
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
