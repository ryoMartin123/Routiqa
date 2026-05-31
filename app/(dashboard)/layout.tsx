import Sidebar from "@/components/layout/Sidebar";
import MainArea from "@/components/layout/MainArea";
import { HierarchyProvider } from "@/components/providers/HierarchyProvider";
import { CustomerProvider } from "@/components/providers/CustomerProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HierarchyProvider>
      <CustomerProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-page)" }}>
        <Sidebar />
        <MainArea>{children}</MainArea>
      </div>
      </CustomerProvider>
    </HierarchyProvider>
  );
}
