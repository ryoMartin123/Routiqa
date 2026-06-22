"use client";

import { PageHeader, FeaturePlaceholder } from "@/components/platform/ui";

export default function AdminBillingPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Billing & Plan" subtitle="Subscription, seats, and platform usage." accent="#a855f7" />
      <FeaturePlaceholder
        title="Subscription & billing"
        features={["Subscription plan", "Seats / users", "Payment method", "Invoices & receipts", "Usage limits", "Enabled apps / modules", "Upgrade / downgrade"]}
      />
    </div>
  );
}
