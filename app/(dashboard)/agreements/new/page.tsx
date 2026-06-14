"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AgreementBuilderShell from "@/components/agreements/builder/AgreementBuilderShell";

function NewAgreementInner() {
  const router = useRouter();
  const params = useSearchParams();
  const templateId = params.get("template") ?? undefined;
  const customerId = params.get("customer") ?? undefined;

  return (
    <AgreementBuilderShell
      mode="create"
      initialTemplateId={templateId}
      initialCustomerId={customerId}
      onClose={() => router.push("/agreements")}
      onSaved={(id) => router.push(`/agreements/${id}`)}
    />
  );
}

export default function NewAgreementPage() {
  return (
    <Suspense fallback={null}>
      <NewAgreementInner />
    </Suspense>
  );
}
