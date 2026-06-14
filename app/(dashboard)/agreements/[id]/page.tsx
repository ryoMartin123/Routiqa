"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import DetailTabs from "@/components/shared/DetailTabs";
import {
  AGREEMENTS, getAgreement, deleteAgreement, updateAgreement, renewAgreement,
  type CustomerAgreement,
} from "@/lib/agreements/data";
import DetailHeader, { type HeaderActions } from "@/components/agreements/detail/DetailHeader";
import OverviewTab from "@/components/agreements/detail/OverviewTab";
import CoverageTab from "@/components/agreements/detail/CoverageTab";
import VisitsTab from "@/components/agreements/detail/VisitsTab";
import ServicesTab from "@/components/agreements/detail/ServicesTab";
import BillingTab from "@/components/agreements/detail/BillingTab";
import RenewalTab from "@/components/agreements/detail/RenewalTab";
import DocumentsTab from "@/components/agreements/detail/DocumentsTab";
import ActivityTab from "@/components/agreements/detail/ActivityTab";
import NotesTab from "@/components/agreements/detail/NotesTab";
import CommunicationTab from "@/components/agreements/detail/CommunicationTab";
import PhotoGallery from "@/components/files/PhotoGallery";

const TABS = [
  "Overview", "Coverage", "Visits", "Services", "Billing", "Renewal",
  "Documents", "Activity", "Notes", "Photos & Files", "Communication",
] as const;

export default function AgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [menuOpen, setMenuOpen] = useState(false);

  // Seed lookup on the server; merge in session-created agreements on the client.
  const [agreement, setAgreement] = useState<CustomerAgreement | undefined>(() => AGREEMENTS.find(a => a.id === id));
  useEffect(() => { setAgreement(getAgreement(id)); }, [id]);
  const refresh = () => setAgreement(getAgreement(id));

  function handleRenew() { renewAgreement(id); refresh(); setMenuOpen(false); }
  function handleCancel() {
    if (confirm("Cancel this agreement? It stays on record but is marked canceled.")) {
      updateAgreement(id, { status: "canceled" }); refresh(); setMenuOpen(false);
    }
  }
  function handleDelete() {
    if (confirm("Delete this agreement? This can't be undone.")) { deleteAgreement(id); router.push("/agreements"); }
  }
  function handleArchive() {
    // Prototype: no dedicated archive status yet — return to the list.
    if (confirm("Archive this agreement?")) router.push("/agreements");
  }

  if (!agreement) {
    return (
      <div className="p-6">
        <Link href="/agreements" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Agreements
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Agreement not found.</p>
      </div>
    );
  }

  const actions: HeaderActions = {
    scheduleVisit: () => setActiveTab("Visits"),
    createInvoice: () => setActiveTab("Billing"),
    renew: handleRenew,
    createRenewalQuote: () => setActiveTab("Renewal"),
    duplicate: () => router.push("/agreements/new"),
    preview: () => setActiveTab("Documents"),
    edit: () => router.push(`/agreements/${id}/edit`),
    uploadDocument: () => setActiveTab("Photos & Files"),
    downloadPdf: () => setActiveTab("Documents"),
    cancel: handleCancel,
    archive: handleArchive,
    remove: handleDelete,
  };

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        <DetailHeader agreement={agreement} actions={actions} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
        <DetailTabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="px-6 pb-2" />
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {activeTab === "Overview"       && <OverviewTab agreement={agreement} />}
        {activeTab === "Coverage"       && <CoverageTab agreement={agreement} />}
        {activeTab === "Visits"         && <VisitsTab agreement={agreement} onRefresh={refresh} />}
        {activeTab === "Services"       && <ServicesTab agreement={agreement} />}
        {activeTab === "Billing"        && <BillingTab agreement={agreement} />}
        {activeTab === "Renewal"        && <RenewalTab agreement={agreement} onRenew={handleRenew} onCancel={handleCancel} />}
        {activeTab === "Documents"      && <DocumentsTab agreement={agreement} />}
        {activeTab === "Activity"       && <ActivityTab agreement={agreement} />}
        {activeTab === "Notes"          && <NotesTab agreement={agreement} />}
        {activeTab === "Photos & Files" && (
          <PhotoGallery recordLevel="agreement"
            scope={{ accountId: agreement.customerId, agreementId: agreement.id, propertyId: agreement.propertyId }}
            accountName={agreement.customer} />
        )}
        {activeTab === "Communication"  && <CommunicationTab agreement={agreement} />}
      </div>
    </div>
  );
}
