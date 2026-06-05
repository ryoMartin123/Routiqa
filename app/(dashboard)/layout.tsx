import Sidebar from "@/components/layout/Sidebar";
import MainArea from "@/components/layout/MainArea";
import { HierarchyProvider } from "@/components/providers/HierarchyProvider";
import { CustomerProvider } from "@/components/providers/CustomerProvider";
import { PermissionProvider } from "@/components/providers/PermissionProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HierarchyProvider>
      <CustomerProvider>
      <PermissionProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-page)" }}>
        <Sidebar />
        <MainArea>{children}</MainArea>
      </div>
      </PermissionProvider>
      </CustomerProvider>
    </HierarchyProvider>
  );
}
