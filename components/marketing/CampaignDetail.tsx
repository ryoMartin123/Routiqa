"use client";

// ─── Campaign detail drawer ───────────────────────────────
// Click a campaign row → everything about it in a slide-over (CRM drawer
// conventions: dot-pill status, top-right 4-dot menu, single primary CTA).
// Before launch the audience preview is LIVE; after launch it's the frozen
// recipient snapshot. Engagement stays honest — zeros until a real provider.

import { useEffect, useRef, useState } from "react";
import {
  X, Rocket, Users, Mail, MessageSquare, Phone, Star, FilePen, RefreshCw, Megaphone,
  Copy, Trash2, Pause, Play, Check, CalendarClock, FileText, ListChecks, Pencil, Workflow, Clock,
} from "lucide-react";
import ActionsMenu from "@/components/shared/ActionsMenu";
import DesignSurface from "@/components/design-studio/BlockRenderer";
import {
  getCampaign, getTemplate, getAudience, resolveRecipients, audienceNameFor,
  sendCampaign, runSequenceStep, pauseCampaign, resumeCampaign, duplicateCampaign, deleteCampaign,
  CAMPAIGN_TYPE_CONFIG, CAMPAIGN_STATUS_CONFIG, type CampaignType, type SequenceStepKind,
} from "@/lib/marketing/data";

const ROSE = "#e11d48";
const TYPE_ICON: Record<CampaignType, typeof Mail> = {
  email: Mail, sms: MessageSquare, review_request: Star, estimate_followup: FilePen,
  maintenance_renewal: RefreshCw, seasonal: Megaphone, call_reminder: Phone, sequence: Workflow,
};
const STEP_ICON: Record<SequenceStepKind, typeof Mail> = { email: Mail, sms: MessageSquare, task: Phone };
const STEP_LABEL: Record<SequenceStepKind, string> = { email: "Email", sms: "SMS", task: "Call tasks" };

export default function CampaignDetail({ campaignId, onClose, onChanged, onEdit }: {
  campaignId: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit?: (id: string) => void;
}) {
  const [tick, setTick] = useState(0);
  const refresh = () => { setTick(t => t + 1); onChanged(); };

  // Slide-in / out (shared drawer pattern).
  const [visible, setVisible] = useState(false);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const requestClose = () => {
    if (reduce.current) { onClose(); return; }
    setVisible(false);
    setTimeout(onClose, 300);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick re-reads after actions
  const c = getCampaign(campaignId);
  if (!c) return null;
  void tick;

  const tc = CAMPAIGN_TYPE_CONFIG[c.type];
  const TI = TYPE_ICON[c.type];
  const sc = CAMPAIGN_STATUS_CONFIG[c.status];
  const tpl = c.templateId ? getTemplate(c.templateId) : undefined;
  const audience = getAudience(c.audienceKey);
  const sent = c.status === "sent";
  // Live preview until launch; the launch snapshot once one exists (an ACTIVE
  // sequence must show its snapshot too — that's where exit tracking lives).
  const people = c.recipientList ?? resolveRecipients(c.audienceKey, c.customAudience);
  const audienceDisplay = audience
    ? `${audience.name} — ${audience.description}`
    : audienceNameFor(c.audienceKey, c.customAudience);
  const isTask = c.channel === "task";

  const menuActions = [
    !sent && onEdit && { label: "Edit campaign", icon: Pencil, onClick: () => { onEdit(c.id); requestClose(); } },
    c.status === "scheduled" && { label: "Pause schedule", icon: Pause, onClick: () => { pauseCampaign(c.id); refresh(); } },
    c.status === "paused" && { label: "Resume schedule", icon: Play, onClick: () => { resumeCampaign(c.id); refresh(); } },
    { label: "Duplicate", icon: Copy, onClick: () => { duplicateCampaign(c.id); refresh(); } },
    { label: "Delete campaign", icon: Trash2, danger: true, separated: true, onClick: () => { if (confirm(`Delete "${c.name}"?`)) { deleteCampaign(c.id); onChanged(); requestClose(); } } },
  ].filter(Boolean) as { label: string; icon: typeof Mail; onClick: () => void; danger?: boolean; separated?: boolean }[];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={requestClose}
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[460px] max-w-full"
        style={{
          backgroundColor: "var(--bg-page)", borderLeft: "1px solid var(--border)", boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)",
        }}>

        {/* ── Header ── */}
        <div className="shrink-0 px-5 pt-4 pb-4" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Campaign · {tc.label}</p>
            <button onClick={requestClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: tc.color + "1f" }}><TI className="w-5 h-5" style={{ color: tc.color }} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{c.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {c.sentAt ? `${isTask ? "Ran" : "Sent"} ${c.sentAt}` : c.scheduledFor ? `Scheduled for ${c.scheduledFor}` : `Created ${c.createdAt}`}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: sc.bg, color: sc.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} /> {sc.label}
            </span>
            <ActionsMenu actions={menuActions} />
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto thin-scroll-y p-4 space-y-3.5">

          {/* Sequence flow — the step timeline with manual fire buttons */}
          {c.sequence && (
            <Card icon={Workflow} title={`Flow · ${c.sequence.filter(s => s.status === "sent").length}/${c.sequence.length} steps run`}>
              <div>
                {c.sequence.map((s, i) => {
                  const SI = STEP_ICON[s.kind];
                  const stepSent = s.status === "sent";
                  const firstPending = c.sequence!.findIndex(x => x.status !== "sent") === i;
                  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  const overdue = !stepSent && s.dueDate ? Date.parse(s.dueDate) < Date.parse(today) : false;
                  const dueNow = !stepSent && s.dueDate ? Date.parse(s.dueDate) <= Date.parse(today) : false;
                  const tpl = s.templateId ? getTemplate(s.templateId) : undefined;
                  return (
                    <div key={s.id} className="flex gap-2.5">
                      <div className="flex flex-col items-center shrink-0">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: stepSent ? "#d1fae5" : "var(--bg-surface-2)" }}>
                          {stepSent ? <Check className="w-3.5 h-3.5" style={{ color: "#059669" }} /> : <SI className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
                        </span>
                        {i < c.sequence!.length - 1 && <span className="flex-1 w-px my-0.5" style={{ backgroundColor: stepSent ? "#05966955" : "var(--border)" }} />}
                      </div>
                      <div className={`flex-1 min-w-0 ${i < c.sequence!.length - 1 ? "pb-3" : ""}`}>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>
                            Step {i + 1} · {STEP_LABEL[s.kind]}{tpl ? ` — ${tpl.name}` : ""}
                          </p>
                          {!stepSent && c.status === "active" && firstPending && (
                            <button onClick={() => { runSequenceStep(c.id, s.id); refresh(); }}
                              className="text-[11px] font-semibold px-2 py-1 rounded-lg text-white shrink-0 hover:brightness-110" style={{ backgroundColor: ROSE }}>
                              Run now
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: overdue ? "#dc2626" : "var(--text-muted)" }}>
                          {stepSent
                            ? `Ran ${s.sentAt}${s.sentTo != null ? ` · sent to ${s.sentTo}` : ""}${s.exited ? ` · ${s.exited} exited` : ""}${s.skipped ? ` · ${s.skipped} skipped` : ""}`
                            : s.dueDate
                            ? <><Clock className="w-3 h-3" /> Due {s.dueDate}{overdue ? " — overdue" : dueNow ? " — due today" : ""}</>
                            : i === 0 ? "Fires at launch"
                            : s.scheduleMode === "on" ? `On ${s.onDate ?? "…"}${s.timeOfDay ? ` at ${s.timeOfDay}` : ""}`
                            : `${s.waitDays} day${s.waitDays === 1 ? "" : "s"} after the previous step`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {c.status === "active" && (
                <p className="text-[10px] mt-2 pt-2" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                  Steps don&apos;t auto-fire — run each one when it comes due.
                  {(c.sequenceMembership ?? "recheck") === "recheck"
                    ? " The audience is re-checked before every step; people whose records stop matching exit."
                    : " Audience frozen at launch — every step goes to the original snapshot."}
                </p>
              )}
            </Card>
          )}

          {/* Message */}
          {!c.sequence && (
          <Card icon={isTask ? Phone : Mail} title={isTask ? "Call script" : "Message"}>
            {tpl ? (
              <>
                <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{tpl.name}{tpl.subject ? <span className="font-normal" style={{ color: "var(--text-muted)" }}> · {tpl.subject}</span> : null}</p>
                {tpl.design ? (
                  <div className="rounded-lg overflow-hidden pointer-events-none" style={{ height: 220, border: "1px solid var(--border)" }}>
                    <div style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%" }}>
                      <DesignSurface blocks={tpl.design.blocks} global={tpl.design.global} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs whitespace-pre-wrap rounded-lg p-3" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>{tpl.body}</p>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No template attached{isTask ? " — tasks carry the campaign name only." : "."}</p>
            )}
          </Card>
          )}

          {/* Audience / recipients */}
          <Card icon={Users} title={c.recipientList ? `Recipients · ${people.length}` : `Audience · ${people.length} right now`}>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              {audienceDisplay}
              {!c.recipientList && " · the list snapshots at launch"}
            </p>
            {people.length === 0 ? (
              <p className="text-sm py-1" style={{ color: "var(--text-muted)" }}>Nobody matches right now.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto thin-scroll-y -mr-1 pr-1">
                {people.map(r => {
                  // Sequence recipients can EXIT mid-flow when their record
                  // stops matching the audience — show that instead of a check.
                  const exitedAt: number | undefined = (r as { exitedAtStep?: number }).exitedAtStep;
                  return (
                    <div key={r.id} className="flex items-center gap-2 py-1.5" style={{ borderTop: "1px solid var(--border-subtle)", opacity: exitedAt != null ? 0.55 : 1 }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: ROSE + "1a", color: ROSE }}>
                        {r.name.split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{r.name}</span>
                      {exitedAt != null
                        ? <span className="text-[11px] shrink-0" style={{ color: "#b45309" }}>exited before step {exitedAt}</span>
                        : <>
                            {r.detail && <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{r.detail}</span>}
                            {sent && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#10b981" }} />}
                          </>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Performance — only once sent, and honest about what's real */}
          {sent && c.stats && (
            <Card icon={Rocket} title="Performance">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{c.stats.delivered}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{isTask ? "call tasks created" : "recipients in the send"}</span>
              </div>
              {!isTask && (
                <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                  Opens, clicks, and replies light up once a real {c.channel === "sms" ? "SMS" : "email"} provider is connected — no simulated numbers.
                </p>
              )}
            </Card>
          )}

          {/* Schedule */}
          <Card icon={CalendarClock} title="Timing">
            <Row label="Created" value={c.createdAt} />
            {c.scheduledFor && <Row label="Scheduled for" value={c.scheduledFor} />}
            {c.sentAt && <Row label={isTask ? "Ran" : "Sent"} value={c.sentAt} />}
          </Card>

          {/* Activity */}
          {(c.activity?.length ?? 0) > 0 && (
            <Card icon={ListChecks} title="Activity">
              <ul className="space-y-2">
                {[...c.activity!].reverse().map(a => (
                  <li key={a.id} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {a.text}
                    <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{a.when}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* ── Footer: the one action ── */}
        <div className="shrink-0 p-4" style={{ backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
          {sent ? (
            <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>
              <Check className="w-4 h-4" /> {c.sequence ? "Sequence complete" : isTask ? "Campaign ran — tasks are on the board" : "Campaign sent"}
            </div>
          ) : c.status === "active" && c.sequence ? (() => {
            const idx = c.sequence.findIndex(s => s.status !== "sent");
            const nextStep = idx >= 0 ? c.sequence[idx] : undefined;
            return nextStep ? (
              <button onClick={() => { runSequenceStep(c.id, nextStep.id); refresh(); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white hover:brightness-110"
                style={{ backgroundColor: ROSE }}>
                <Rocket className="w-4 h-4" /> Run step {idx + 1} now — {STEP_LABEL[nextStep.kind]}{nextStep.dueDate ? ` (due ${nextStep.dueDate})` : ""}
              </button>
            ) : null;
          })() : (
            <button onClick={() => { sendCampaign(c.id); refresh(); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white hover:brightness-110"
              style={{ backgroundColor: ROSE }}>
              <Rocket className="w-4 h-4" />
              {c.sequence ? `Start sequence — ${people.length} ${people.length === 1 ? "person" : "people"}` : isTask ? `Run now — create ${people.length} call task${people.length === 1 ? "" : "s"}` : `Send now — ${people.length} ${people.length === 1 ? "person" : "people"}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof Mail; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
