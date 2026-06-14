"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import AgreementBuilderShell from "@/components/agreements/builder/AgreementBuilderShell";

export default function EditAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <AgreementBuilderShell
      mode="edit"
      agreementId={id}
      onClose={() => router.push(`/agreements/${id}`)}
      onSaved={(savedId) => router.push(`/agreements/${savedId}`)}
    />
  );
}
