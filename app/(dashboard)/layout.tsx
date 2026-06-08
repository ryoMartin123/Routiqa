import Sidebar from "@/components/layout/Sidebar";
import MainArea from "@/components/layout/MainArea";
import { HierarchyProvider } from "@/components/providers/HierarchyProvider";
import { CustomerProvider } from "@/components/providers/CustomerProvider";
import { PermissionProvider } from "@/components/providers/PermissionProvider";
import { Suspense } from "react";
import { CommentsProvider } from "@/components/providers/CommentsProvider";
import CommentsDrawer from "@/components/comments/CommentsDrawer";
import CommentModeController from "@/components/comments/CommentModeController";
import CommentDeepLinkWatcher from "@/components/comments/CommentDeepLinkWatcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HierarchyProvider>
      <CustomerProvider>
      <PermissionProvider>
      <CommentsProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-page)" }}>
        <Sidebar />
        <MainArea>{children}</MainArea>
      </div>
      <CommentsDrawer />
      <Suspense fallback={null}><CommentModeController /></Suspense>
      <Suspense fallback={null}><CommentDeepLinkWatcher /></Suspense>
      </CommentsProvider>
      </PermissionProvider>
      </CustomerProvider>
    </HierarchyProvider>
  );
}
