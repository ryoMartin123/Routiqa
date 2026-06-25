import { PageSkeleton } from "@/components/ui/Skeleton";

// Detail-shaped skeleton so opening an agreement doesn't flash the agreements
// LIST skeleton and jump when the detail page mounts.
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
