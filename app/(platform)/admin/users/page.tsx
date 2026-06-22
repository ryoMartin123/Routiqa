import { Suspense } from "react";
import UsersAccessSection from "@/components/admin/UsersAccessSection";

// Users & Access — platform login accounts + role assignments (Directory) and
// the app-access audit matrix, combined into one section. (Employee/person
// records live in the HR app; this is access, not HR data.)
// Suspense boundary required because the section + UsersSection read
// useSearchParams (?tab=access, ?user=<id>).
export default function AdminUsersPage() {
  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <UsersAccessSection />
      </Suspense>
    </div>
  );
}
