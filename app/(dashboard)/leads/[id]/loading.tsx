import { PageSkeleton } from "@/components/ui/Skeleton";

// Detail-shaped skeleton so opening a lead doesn't flash the leads LIST skeleton
// and jump when the detail page mounts.
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
