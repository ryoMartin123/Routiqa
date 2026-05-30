import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
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
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          {/* No padding here — each page manages its own */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      </CustomerProvider>
    </HierarchyProvider>
  );
}
