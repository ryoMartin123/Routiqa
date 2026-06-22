import BusinessStructureManager from "@/components/admin/BusinessStructureManager";

// Business Structure lives in Admin because CRM, HR, Accounting, and Documents
// all consume companies / locations / service areas as shared working context.
// Admin owns the structure; the other apps read the selected scope.
export default function AdminBusinessStructurePage() {
  return (
    <div className="p-6 h-full">
      <BusinessStructureManager />
    </div>
  );
}
