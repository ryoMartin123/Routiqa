import { Suspense } from "react";
import RolesSection from "@/components/settings/RolesSection";

// Suspense boundary required because RolesSection reads useSearchParams
// (deep link from App Access: /admin/roles?role=<key>).
export default function AdminRolesPage() {
  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <RolesSection />
      </Suspense>
    </div>
  );
}
