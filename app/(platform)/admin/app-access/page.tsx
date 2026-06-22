import { redirect } from "next/navigation";

// App Access merged into Users & Access. Preserve the old route + any deep links
// by redirecting to the matrix tab.
export default function AdminAppAccessPage() {
  redirect("/admin/users?tab=access");
}
