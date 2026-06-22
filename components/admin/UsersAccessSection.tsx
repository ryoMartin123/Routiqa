"use client";

// ─── Admin → Users & Access ───────────────────────────────
// One section for everything about platform access: the Directory (login
// accounts + role/layer assignments, invite/edit) and App Access (the read-only
// audit matrix of who — by user, role, or app — can open each platform app).
// App Access has no data of its own; it's a lens over the same users + roles, so
// the two live together here. Each child renders embedded (its title comes from
// the shared header below). Deep links: ?tab=access opens the matrix; ?user=<id>
// always belongs to the Directory editor.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users, AppWindow } from "lucide-react";
import StatusTabs from "@/components/shared/StatusTabs";
import UsersSection from "@/components/settings/UsersSection";
import AppAccessMatrix from "@/components/admin/AppAccessMatrix";

type Tab = "directory" | "access";

export default function UsersAccessSection() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "access" ? "access" : "directory");

  // React to deep links: a ?user= link is a Directory action; ?tab=access opens
  // the matrix. Manual tab changes (no param change) are left untouched.
  useEffect(() => {
    if (params.get("user")) setTab("directory");
    else if (params.get("tab") === "access") setTab("access");
  }, [params]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Users &amp; Access</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Manage login accounts and their roles, and audit which apps each user and role can open.
        </p>
      </div>

      <StatusTabs active={tab} onChange={(k) => setTab(k as Tab)}
        tabs={[
          { key: "directory", label: "Directory", icon: Users },
          { key: "access", label: "App Access", icon: AppWindow },
        ]} />

      {tab === "directory" ? <UsersSection embedded /> : <AppAccessMatrix embedded />}
    </div>
  );
}
