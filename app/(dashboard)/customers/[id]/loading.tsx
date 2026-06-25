import { PageSkeleton } from "@/components/ui/Skeleton";

// Detail-shaped skeleton so opening a customer doesn't flash the customers LIST
// skeleton and jump when the detail page mounts.
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
