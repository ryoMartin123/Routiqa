"use client";

// ─── Campaign Studio — full-screen campaign composer ──────
// Four steps (Basics → Audience → Message → Launch) with a mission-control
// summary rail. Opens blank for a new campaign or pre-filled to EDIT an
// unsent one. Everything shown is real CRM data: audiences carry live member
// counts (including user-built CUSTOM audiences), templates strictly match
// the channel and can be created right here (emails open the Design Studio),
// and Launch states exactly what will happen.

import { useMemo, useState } from "react";
import {
  X, ArrowLeft, ArrowRight, Check, Rocket, Users, Mail, MessageSquare, Star, FilePen,
  RefreshCw, Phone, Megaphone, CalendarClock, FileText, Info, PenLine, Plus, Sparkles, AtSign, Workflow, Clock,
} from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import DesignSurface from "@/components/design-studio/BlockRenderer";
import DesignStudio from "@/components/design-studio/DesignStudio";
import TextTemplateModal from "@/components/marketing/TextTemplateModal";
import AudienceBuilder from "@/components/marketing/AudienceBuilder";
import { RuleComposer, BaseChips } from "@/components/marketing/AudienceComposer";
import TimePicker from "@/components/ui/TimePicker";
import { starterEmailDesign, plainTextFromDesign } from "@/lib/design-studio/model";
import {
  getTemplatesForType, createCampaign, reconfigureCampaign, getCampaign, resolveRecipients, getAudience,
  getSavedAudiences, getSavedAudience, audienceNameFor, getTemplates,
  createTemplate, customAudienceLabel,
  CAMPAIGN_TYPE_CONFIG, sequenceSchedule, fmtDue, stepHasTime,
  type CampaignType, type MarketingTemplate, type CustomAudience,
  type SequenceStep, type SequenceStepKind, type SequenceMembership,
} from "@/lib/marketing/data";
import { enabledCampaignTypes, enabledAudiences, getMarketingSettings } from "@/lib/marketing/settings";

const ROSE = "#e11d48";

export interface CampaignBuilderPreset { audienceKey?: string; type?: CampaignType; editId?: string }

const TYPE_ICON: Record<CampaignType, typeof Mail> = {
  email: Mail, sms: MessageSquare, review_request: Star, estimate_followup: FilePen,
  maintenance_renewal: RefreshCw, seasonal: Megaphone, call_reminder: Phone, sequence: Workflow,
};
const TYPE_DESC: Record<CampaignType, string> = {
  email: "One-time email blast to a segment",
  sms: "Short text message with merge fields",
  review_request: "Ask happy customers for a review",
  estimate_followup: "Nudge open estimates toward a yes",
  maintenance_renewal: "Renew expiring maintenance agreements",
  seasonal: "Seasonal promotion to a whole segment",
  call_reminder: "Creates a call task per person for your team",
  sequence: "Multi-step flow: email → wait → SMS → wait → call",
};
const STEP_KIND_META: Record<SequenceStepKind, { label: string; icon: typeof Mail; channel: "email" | "sms" | "task" }> = {
  email: { label: "Email", icon: Mail, channel: "email" },
  sms: { label: "SMS", icon: MessageSquare, channel: "sms" },
  task: { label: "Call task", icon: Phone, channel: "task" },
};
const newSeqStep = (first: boolean): SequenceStep => ({
  id: `seq-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
  kind: first ? "email" : "sms",
  waitDays: first ? 0 : 3,
});

type Step = "basics" | "audience" | "message" | "launch";
const STEPS: { key: Step; label: string; icon: typeof Mail }[] = [
  { key: "basics", label: "Basics", icon: Megaphone },
  { key: "audience", label: "Audience", icon: Users },
  { key: "message", label: "Message", icon: Mail },
  { key: "launch", label: "Launch", icon: Rocket },
];

export default function CampaignBuilder({ preset, onClose, onCreated }: {
  preset?: CampaignBuilderPreset;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const auds = enabledAudiences();
  const types = enabledCampaignTypes();
  const editing = preset?.editId ? getCampaign(preset.editId) : undefined;

  const [step, setStep] = useState<Step>("basics");
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<CampaignType | "">(editing?.type ?? preset?.type ?? (preset?.audienceKey ? getAudience(preset.audienceKey)?.defaultType : undefined) ?? "");
  const [audienceKey, setAudienceKey] = useState(editing?.audienceKey ?? preset?.audienceKey ?? "");
  const [custom, setCustom] = useState<CustomAudience>(editing?.customAudience ?? { base: "customers", rules: [] });
  const [templateId, setTemplateId] = useState(editing?.templateId ?? "");
  const [when, setWhen] = useState<"now" | "schedule" | "draft">(editing?.scheduledFor ? "schedule" : "draft");
  const [scheduledFor, setScheduledFor] = useState(editing?.scheduledFor ?? "");
  // Sequence chain (only for type === "sequence"); runtime fields stripped on edit.
  const [sequence, setSequence] = useState<SequenceStep[]>(
    editing?.sequence?.map(({ id, kind, templateId, waitDays, scheduleMode, onDate, timeOfDay, onlyIf }) =>
      ({ id, kind, templateId, waitDays, scheduleMode, onDate, timeOfDay, onlyIf })) ?? [newSeqStep(true)],
  );
  const [seqMembership, setSeqMembership] = useState<SequenceMembership>(editing?.sequenceMembership ?? "recheck");
  const [tick, setTick] = useState(0);   // re-read templates/audiences after creating one
  // Create-a-template overlays (email → Design Studio; sms/call → text modal),
  // and "save these rules as a reusable audience". forStep = which sequence
  // step asked for the new template (it attaches back there on save).
  const [creatingTpl, setCreatingTpl] = useState<"email" | "sms" | "call" | null>(null);
  const [creatingForStep, setCreatingForStep] = useState<string | null>(null);
  const [savingAudience, setSavingAudience] = useState(false);

  const channel = type ? CAMPAIGN_TYPE_CONFIG[type].channel : undefined;
  const audience = audienceKey ? getAudience(audienceKey) : undefined;
  const audienceName = audienceKey ? audienceNameFor(audienceKey, audienceKey === "custom" ? custom : undefined) : undefined;
  const rawCount = audience ? audience.members().length : undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick re-reads after saving an audience
  const recipients = useMemo(
    () => (audienceKey ? resolveRecipients(audienceKey, audienceKey === "custom" ? custom : undefined) : []),
    [audienceKey, custom, tick],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick re-reads after template creation
  const templates = useMemo(() => (type ? getTemplatesForType(type) : []), [type, tick]);
  const template = templates.find(t => t.id === templateId);
  const sender = getMarketingSettings().sender;

  const isSequence = type === "sequence";
  const done: Record<Step, boolean> = {
    basics: Boolean(name.trim() && type),
    audience: Boolean(audienceKey),
    // A sequence needs steps AND a possible schedule (no past dates, no step
    // landing before the one before it).
    message: !isSequence || (sequence.length > 0 && sequenceSchedule(sequence).every(x => !x.error)),
    launch: false,
  };
  const stepIdx = STEPS.findIndex(s => s.key === step);
  const reachable = (i: number) => STEPS.slice(0, i).every(s => done[s.key]);
  const next = () => { const n = STEPS[stepIdx + 1]; if (n && done[step]) setStep(n.key); };
  const back = () => { const p = STEPS[stepIdx - 1]; if (p) setStep(p.key); };

  function launch() {
    if (!name.trim() || !type || !audienceKey) return;
    const input = {
      name, type, audienceKey,
      // Snapshot the rules onto the campaign (ad-hoc OR saved) so deleting a
      // saved audience later never breaks a campaign that used it.
      customAudience: audienceKey === "custom" ? custom : getSavedAudience(audienceKey)?.custom,
      templateId: isSequence ? undefined : (templateId || undefined),
      sequence: isSequence ? sequence : undefined,
      sequenceMembership: isSequence ? seqMembership : undefined,
      sendNow: when === "now",
      scheduledFor: when === "schedule" ? (scheduledFor || undefined) : undefined,
    };
    const c = editing ? reconfigureCampaign(editing.id, input) : createCampaign(input);
    if (c) onCreated(c.id);
  }

  const launchLabel = when === "now"
    ? (isSequence ? `Start sequence — ${recipients.length} ${recipients.length === 1 ? "person" : "people"}`
      : channel === "task" ? `Run now — create ${recipients.length} call task${recipients.length === 1 ? "" : "s"}`
      : `Send now — reach ${recipients.length} ${recipients.length === 1 ? "person" : "people"}`)
    : when === "schedule" ? (editing ? "Save & schedule" : "Schedule campaign")
    : editing ? "Save changes" : "Save as draft";

  const smsLen = channel === "sms" && template ? template.body.length : 0;
  const smsSegments = smsLen === 0 ? 0 : smsLen <= 160 ? 1 : Math.ceil(smsLen / 153);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Header: title + stepper ── */}
      <header className="flex items-center gap-4 px-4 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium shrink-0" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Campaigns</button>
        <div className="h-5 w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />
        <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{name.trim() || (editing ? "Edit Campaign" : "New Campaign")}</p>

        <div className="flex-1 flex items-center justify-center gap-1 min-w-0">
          {STEPS.map((s, i) => {
            const active = s.key === step;
            const complete = done[s.key] && i < stepIdx;
            const clickable = reachable(i);
            return (
              <div key={s.key} className="flex items-center gap-1">
                {i > 0 && <div className="w-6 h-px" style={{ backgroundColor: complete || active ? ROSE : "var(--border)" }} />}
                <button onClick={() => clickable && setStep(s.key)} disabled={!clickable}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                  style={{ backgroundColor: active ? ROSE + "14" : "transparent", color: active ? ROSE : complete ? "var(--text-primary)" : "var(--text-muted)" }}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                    style={{ backgroundColor: complete ? ROSE : active ? ROSE + "22" : "var(--bg-input)", color: complete ? "#fff" : active ? ROSE : "var(--text-muted)" }}>
                    {complete ? <Check className="w-2.5 h-2.5" /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)] shrink-0" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ── Step content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto thin-scroll-y">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

            {step === "basics" && (
              <>
                <StepTitle title="What is this campaign?" sub="Name it and pick the kind of outreach — the channel follows the type." />
                <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Spring Tune-Up Promo"
                  className="w-full text-xl font-semibold bg-transparent outline-none px-4 py-3 rounded-xl"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                {(() => {
                  // Mirror the campaigns list: one-time sends and the multi-step
                  // sequence are different animals, so pick between them apart.
                  const typeCard = (t: CampaignType) => {
                    const tc = CAMPAIGN_TYPE_CONFIG[t]; const TI = TYPE_ICON[t];
                    const on = type === t;
                    return (
                      <button key={t} onClick={() => { setType(t); setTemplateId(""); }}
                        className="text-left rounded-xl p-4 transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${on ? ROSE : "var(--border)"}`, boxShadow: on ? `0 0 0 3px ${ROSE}22` : "var(--shadow-card)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: tc.color + "1f" }}>
                            <TI className="w-4 h-4" style={{ color: tc.color }} />
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t === "sequence" ? "multi-channel" : tc.channel}</span>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tc.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{TYPE_DESC[t]}</p>
                      </button>
                    );
                  };
                  // Only types wired to distinct behavior are pickable. The old
                  // flavored types (review request, estimate follow-up,
                  // maintenance renewal, seasonal, call reminder) were the same
                  // email blast with a different label — audience + template
                  // already express that, and call tasks live on as a one-step
                  // sequence. Review request returns when a real review link
                  // exists (Phase 6).
                  const ONE_TIME: CampaignType[] = ["email", "sms"];
                  const oneTime = types.filter(t => ONE_TIME.includes(t));
                  const hasSeq = types.includes("sequence");
                  return (
                    <>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>One-time send · launch once, done</p>
                        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                          {oneTime.map(typeCard)}
                        </div>
                      </div>
                      {hasSeq && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Sequence · multi-step flow over days</p>
                          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                            {typeCard("sequence")}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                <NextBar disabled={!done.basics} onNext={next} label="Choose the audience" />
              </>
            )}

            {step === "audience" && (
              <>
                <StepTitle title="Who should it reach?" sub="Pick a live segment — or build a custom one with your own rules." />
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                  {auds.map(a => {
                    const on = audienceKey === a.key;
                    const n = a.count();
                    return (
                      <button key={a.key} onClick={() => setAudienceKey(a.key)}
                        className="text-left rounded-xl p-4 transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${on ? ROSE : "var(--border)"}`, boxShadow: on ? `0 0 0 3px ${ROSE}22` : "var(--shadow-card)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                          <span className="text-xl font-bold tabular-nums shrink-0" style={{ color: on ? ROSE : "var(--text-primary)" }}>{n}</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{a.description}</p>
                      </button>
                    );
                  })}
                  {/* Saved audiences — the user's own segments */}
                  {getSavedAudiences().map(a => {
                    const on = audienceKey === a.id;
                    const n = resolveRecipients(a.id).length;
                    return (
                      <button key={a.id} onClick={() => setAudienceKey(a.id)}
                        className="text-left rounded-xl p-4 transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${on ? ROSE : "var(--border)"}`, boxShadow: on ? `0 0 0 3px ${ROSE}22` : "var(--shadow-card)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold flex items-center gap-1.5 min-w-0" style={{ color: "var(--text-primary)" }}>
                            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: ROSE }} /> <span className="truncate">{a.name}</span>
                          </p>
                          <span className="text-xl font-bold tabular-nums shrink-0" style={{ color: on ? ROSE : "var(--text-primary)" }}>{n}</span>
                        </div>
                        <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>{a.description ?? customAudienceLabel(a.custom)}</p>
                      </button>
                    );
                  })}
                  {/* Build-your-own */}
                  <button onClick={() => setAudienceKey("custom")}
                    className="text-left rounded-xl p-4 transition-all hover:-translate-y-0.5"
                    style={{ backgroundColor: "var(--bg-surface)", border: `1.5px ${audienceKey === "custom" ? `solid ${ROSE}` : "dashed var(--border)"}`, boxShadow: audienceKey === "custom" ? `0 0 0 3px ${ROSE}22` : "none" }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Sparkles className="w-3.5 h-3.5" style={{ color: ROSE }} /> Custom audience</p>
                      {audienceKey === "custom" && <span className="text-xl font-bold tabular-nums shrink-0" style={{ color: ROSE }}>{recipients.length}</span>}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Pick a record type and stack your own filters.</p>
                  </button>
                </div>

                {/* Custom audience composer */}
                {audienceKey === "custom" && (
                  <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${ROSE}44` }}>
                    <BaseChips custom={custom} onChange={setCustom} />
                    <RuleComposer custom={custom} onChange={setCustom} />
                    <button onClick={() => setSavingAudience(true)}
                      className="flex items-center gap-1.5 text-xs font-medium pt-1" style={{ color: ROSE }}>
                      <Sparkles className="w-3.5 h-3.5" /> Save as a reusable audience
                    </button>
                  </div>
                )}

                {audienceKey && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-baseline justify-between gap-2 mb-2.5">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Who this reaches right now</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {rawCount != null && rawCount !== recipients.length
                          ? `${rawCount} records → ${recipients.length} unique people (duplicates collapsed)`
                          : `${recipients.length} ${recipients.length === 1 ? "person" : "people"}`}
                      </p>
                    </div>
                    {recipients.length === 0 ? (
                      <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>Nobody matches right now{audienceKey === "custom" ? " — loosen the rules." : "."}</p>
                    ) : (
                      <div className="grid gap-x-4 gap-y-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                        {recipients.slice(0, 10).map(r => (
                          <div key={r.id} className="flex items-center gap-2 py-1 min-w-0">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: ROSE + "1a", color: ROSE }}>
                              {r.name.split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                            <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{r.name}</span>
                            {r.detail && <span className="text-[11px] truncate shrink-0" style={{ color: "var(--text-muted)" }}>{r.detail}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {recipients.length > 10 && <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>+ {recipients.length - 10} more</p>}
                  </div>
                )}
                <NextBar disabled={!done.audience} onNext={next} onBack={back} label="Pick the message" />
              </>
            )}

            {step === "message" && isSequence && (
              <>
                <StepTitle title="Build the flow" sub="A chain of touches over time — each step picks its channel, template, and how long to wait after the one before." />
                {/* Audience over time — re-check (default) means someone whose
                    record stops matching (estimate approved, agreement signed)
                    exits instead of getting a stale nudge. */}
                <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Audience over time</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {([
                      { v: "recheck" as const, label: "Re-check before every step", desc: "People whose records no longer match the audience exit the flow — no stale nudges. Recommended." },
                      { v: "frozen" as const, label: "Frozen at launch", desc: "Everyone in the launch snapshot gets every step, no matter what changes." },
                    ]).map(o => {
                      const on = seqMembership === o.v;
                      return (
                        <button key={o.v} onClick={() => setSeqMembership(o.v)} className="text-left rounded-lg p-2.5 transition-colors"
                          style={{ border: `1.5px solid ${on ? ROSE : "var(--border)"}`, backgroundColor: on ? ROSE + "0d" : "var(--bg-surface)" }}>
                          <p className="text-xs font-semibold" style={{ color: on ? ROSE : "var(--text-primary)" }}>{o.label}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{o.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <SequenceComposer steps={sequence} onChange={setSequence} tick={tick}
                  onCreateTemplate={(k, stepId) => { setCreatingForStep(stepId); setCreatingTpl(k === "email" ? "email" : k === "sms" ? "sms" : "call"); }} />
                <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <Info className="w-3.5 h-3.5 shrink-0" /> Step 1 fires at launch; later steps get due dates and are run from the campaign — there's no background scheduler yet.
                </p>
                <NextBar disabled={!done.message} onNext={next} onBack={back} label="Review & launch" />
              </>
            )}

            {step === "message" && !isSequence && (
              <>
                <StepTitle title={channel === "task" ? "What should the caller say?" : "What are you sending?"}
                  sub={channel === "task"
                    ? "Pick or write a call script — it's attached to every call task the campaign creates."
                    : `Only ${channel?.toUpperCase()} templates are offered here — the message always matches the channel.`} />
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
                  {/* Create-new — the fastest way in */}
                  <button onClick={() => setCreatingTpl(channel === "email" ? "email" : channel === "sms" ? "sms" : "call")}
                    className="text-left rounded-xl p-4 transition-all hover:-translate-y-0.5 flex flex-col items-start justify-center min-h-[120px]"
                    style={{ backgroundColor: "var(--bg-surface)", border: `1.5px dashed ${ROSE}66` }}>
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: ROSE + "14" }}>
                      <Plus className="w-4 h-4" style={{ color: ROSE }} />
                    </span>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {channel === "email" ? "Design a new email" : channel === "sms" ? "Write a new SMS" : "Write a new script"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {channel === "email" ? "Opens the Design Studio — it attaches here when you save." : "Opens the editor — it attaches here when you save."}
                    </p>
                  </button>
                  <button onClick={() => setTemplateId("")}
                    className="text-left rounded-xl p-4 transition-all hover:-translate-y-0.5 flex flex-col"
                    style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${templateId === "" ? ROSE : "var(--border)"}`, boxShadow: templateId === "" ? `0 0 0 3px ${ROSE}22` : "var(--shadow-card)" }}>
                    <PenLine className="w-4 h-4 mb-2" style={{ color: "var(--text-muted)" }} />
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No template</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {channel === "task" ? "Tasks carry just the campaign name." : "Send without prepared content — attach one later."}
                    </p>
                  </button>
                  {templates.map(t => <TemplateCard key={t.id} t={t} on={templateId === t.id} onPick={() => setTemplateId(t.id)} />)}
                </div>
                <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <Info className="w-3.5 h-3.5 shrink-0" /> Everything you create here also lands in Marketing → Templates for reuse.
                </p>
                <NextBar disabled={false} onNext={next} onBack={back} label="Review & launch" />
              </>
            )}

            {step === "launch" && (
              <>
                <StepTitle title="Review & launch" sub="One last look — this is exactly what will happen." />
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <ReviewRow label="Campaign" value={name.trim() || "—"} />
                  <ReviewRow label="Type" value={type ? `${CAMPAIGN_TYPE_CONFIG[type].label} · ${channel?.toUpperCase()}` : "—"} />
                  <ReviewRow label="Audience" value={audienceName ? `${audienceName} · ${recipients.length} ${recipients.length === 1 ? "person" : "people"}` : "—"} />
                  <ReviewRow label="Message" value={template ? template.name : "No template"} last />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {([
                    { k: "now" as const, label: channel === "task" ? "Run now" : "Send now", desc: "Recipients snapshot immediately", icon: Rocket },
                    { k: "schedule" as const, label: "Schedule", desc: "Pick a launch date", icon: CalendarClock },
                    { k: "draft" as const, label: editing ? "Keep as draft" : "Save as draft", desc: "Finish it later", icon: FileText },
                  ]).map(o => (
                    <button key={o.k} onClick={() => setWhen(o.k)}
                      className="text-left rounded-xl p-3.5 transition-all"
                      style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${when === o.k ? ROSE : "var(--border)"}`, boxShadow: when === o.k ? `0 0 0 3px ${ROSE}22` : "var(--shadow-card)" }}>
                      <o.icon className="w-4 h-4 mb-1.5" style={{ color: when === o.k ? ROSE : "var(--text-muted)" }} />
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{o.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{o.desc}</p>
                    </button>
                  ))}
                </div>
                {when === "schedule" && (
                  <div className="w-56"><DatePicker value={scheduledFor} onChange={setScheduledFor} placeholder="Pick a launch date" /></div>
                )}

                <div className="rounded-xl p-4 flex items-start gap-2.5" style={{ backgroundColor: ROSE + "0d", border: `1px solid ${ROSE}33` }}>
                  <Rocket className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ROSE }} />
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {isSequence
                      ? <>Launching freezes the audience (<b style={{ color: "var(--text-primary)" }}>{recipients.length} {recipients.length === 1 ? "person" : "people"}</b>), fires step 1 immediately, and puts due dates on the other {Math.max(sequence.length - 1, 0)} step{sequence.length - 1 === 1 ? "" : "s"} — you run those from the campaign when they come due.</>
                      : channel === "task"
                      ? <>Launching creates <b style={{ color: "var(--text-primary)" }}>{recipients.length} call task{recipients.length === 1 ? "" : "s"}</b> — one per person, with {template ? "your script attached" : "the campaign name"} — assigned to the team immediately.</>
                      : <>The recipient list snapshots at launch (<b style={{ color: "var(--text-primary)" }}>{recipients.length} {recipients.length === 1 ? "person" : "people"}</b>). Delivery is simulated in this workspace — opens and clicks light up once a real {channel === "sms" ? "SMS" : "email"} provider is connected.</>}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <BackArrow onClick={back} />
                  <button onClick={launch} disabled={!done.basics || !done.audience || (when === "schedule" && !scheduledFor)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:brightness-110 transition-all"
                    style={{ backgroundColor: ROSE, boxShadow: `0 8px 24px -8px ${ROSE}aa` }}>
                    <Rocket className="w-4 h-4" /> {launchLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Summary rail — mirrors the steps, top to bottom ── */}
        <aside className="w-[21rem] shrink-0 overflow-y-auto thin-scroll-y p-5 hidden lg:block" style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Campaign summary</p>

          <RailStep n={1} label="Basics" done={done.basics} active={step === "basics"} onJump={() => setStep("basics")} last={false}>
            {type ? (
              <div className="flex items-center gap-2 min-w-0">
                {(() => { const TI = TYPE_ICON[type]; return (
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: CAMPAIGN_TYPE_CONFIG[type].color + "1f" }}>
                    <TI className="w-3.5 h-3.5" style={{ color: CAMPAIGN_TYPE_CONFIG[type].color }} />
                  </span>
                ); })()}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{name.trim() || "Untitled campaign"}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{CAMPAIGN_TYPE_CONFIG[type].label} · {channel?.toUpperCase()}</p>
                </div>
              </div>
            ) : <RailEmpty text="Name it and pick a type" />}
          </RailStep>

          <RailStep n={2} label="Audience" done={done.audience} active={step === "audience"} onJump={() => reachable(1) && setStep("audience")} last={false}>
            {audienceKey ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{recipients.length}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>unique {recipients.length === 1 ? "person" : "people"}</span>
                </div>
                <p className="text-[11px] mt-1 truncate" style={{ color: "var(--text-secondary)" }}>{audienceName}</p>
                {rawCount != null && rawCount !== recipients.length && (
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{rawCount} matching records — duplicates collapsed</p>
                )}
                {recipients.length > 0 && (
                  <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                    {recipients.slice(0, 3).map(r => r.name).join(", ")}{recipients.length > 3 ? ` +${recipients.length - 3} more` : ""}
                  </p>
                )}
              </>
            ) : <RailEmpty text="Pick an audience" />}
          </RailStep>

          <RailStep n={3} label={isSequence ? "Flow" : "Message"} done={stepIdx > 2} active={step === "message"} onJump={() => reachable(2) && setStep("message")} last={false}>
            {isSequence ? (
              sequence.length === 0 ? <RailEmpty text="Add the first step" /> : (
                <ul className="space-y-1.5">
                  {sequence.map((s, i) => {
                    const KM = STEP_KIND_META[s.kind];
                    const tpl = s.templateId ? getTemplates().find(t => t.id === s.templateId) : undefined;
                    return (
                      <li key={s.id} className="flex items-center gap-1.5 text-[11px] min-w-0" style={{ color: "var(--text-secondary)" }}>
                        <KM.icon className="w-3 h-3 shrink-0" style={{ color: CAMPAIGN_TYPE_CONFIG.sequence.color }} />
                        <span className="truncate">{i > 0 ? `+${s.waitDays}d · ` : ""}{KM.label}{tpl ? ` — ${tpl.name}` : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : template ? (
              <>
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{template.name}</p>
                {template.subject && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>Subject: {template.subject}</p>}
                {channel === "sms" && (
                  <p className="text-[11px] mt-0.5" style={{ color: smsLen > 160 ? "#b45309" : "var(--text-muted)" }}>{smsLen} chars · {smsSegments} segment{smsSegments === 1 ? "" : "s"}</p>
                )}
                {template.design ? (
                  <div className="rounded-lg overflow-hidden pointer-events-none mt-2" style={{ height: 170, border: "1px solid var(--border)" }}>
                    <div style={{ transform: "scale(0.3)", transformOrigin: "top left", width: "334%" }}>
                      <DesignSurface blocks={template.design.blocks} global={template.design.global} />
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg p-2.5 mt-2 text-[11px] whitespace-pre-wrap" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)", maxHeight: 120, overflow: "hidden" }}>{template.body}</p>
                )}
              </>
            ) : stepIdx > 2 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No template — {channel === "task" ? "tasks carry the campaign name" : "sending without prepared content"}.</p>
            ) : <RailEmpty text="Pick or create a template" />}
          </RailStep>

          <RailStep n={4} label="Launch" done={false} active={step === "launch"} onJump={() => reachable(3) && setStep("launch")} last>
            {channel ? (
              <ul className="space-y-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {channel === "email" && (
                  <li className="flex items-start gap-1.5"><AtSign className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />From {sender.fromName} &lt;{sender.fromEmail}&gt;{sender.includeUnsubscribe ? " · unsubscribe footer on" : ""}</li>
                )}
                {channel === "sms" && (
                  <li className="flex items-start gap-1.5"><MessageSquare className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />Sender ID: {sender.smsSender}</li>
                )}
                {channel === "task" && (
                  <li className="flex items-start gap-1.5"><Phone className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />One call task per person, due the day it runs</li>
                )}
                <li className="flex items-start gap-1.5"><CalendarClock className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  {step !== "launch" ? "Timing is decided here at the end" : when === "now" ? "Launches immediately" : when === "schedule" ? (scheduledFor ? `Scheduled for ${scheduledFor}` : "Pick a launch date") : "Saved as a draft"}
                </li>
                <li className="flex items-start gap-1.5"><Users className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />Recipient list freezes at launch — it's live until then</li>
              </ul>
            ) : <RailEmpty text="Decided by the campaign type" />}
          </RailStep>
        </aside>
      </div>

      {/* ── Create-a-template overlays ── */}
      {creatingTpl === "email" && type && (
        <DesignStudio mode="email" backLabel="Campaign"
          initialName={`${name.trim() || "Campaign"} email`} initialDesign={starterEmailDesign()}
          onSave={out => {
            const t = createTemplate({ name: out.name, type: isSequence ? "email" : (type as CampaignType), subject: out.subject, body: plainTextFromDesign(out.design), design: out.design });
            if (creatingForStep) setSequence(sq => sq.map(s => (s.id === creatingForStep ? { ...s, templateId: t.id } : s)));
            else setTemplateId(t.id);
            setCreatingTpl(null); setCreatingForStep(null); setTick(x => x + 1);
          }}
          onClose={() => { setCreatingTpl(null); setCreatingForStep(null); }} />
      )}
      {(creatingTpl === "sms" || creatingTpl === "call") && (
        <TextTemplateModal kind={creatingTpl} template={null}
          onClose={() => { setCreatingTpl(null); setCreatingForStep(null); }}
          onSaved={t => {
            if (creatingForStep) setSequence(sq => sq.map(s => (s.id === creatingForStep ? { ...s, templateId: t.id } : s)));
            else setTemplateId(t.id);
            setCreatingTpl(null); setCreatingForStep(null); setTick(x => x + 1);
          }} />
      )}
      {savingAudience && (
        <AudienceBuilder audience={null} initialCustom={custom}
          onClose={() => setSavingAudience(false)}
          onSaved={a => { setAudienceKey(a.id); setSavingAudience(false); setTick(x => x + 1); }} />
      )}
    </div>
  );
}

// ─── Sequence chain composer ──────────────────────────────
// A vertical connected chain: each step picks its channel, template (strictly
// matching that channel), and the wait after the previous step.
function SequenceComposer({ steps, onChange, onCreateTemplate, tick }: {
  steps: SequenceStep[]; onChange: (s: SequenceStep[]) => void;
  onCreateTemplate: (kind: SequenceStepKind, stepId: string) => void; tick: number;
}) {
  void tick;   // re-render after a template is created elsewhere
  const patch = (id: string, p: Partial<SequenceStep>) => onChange(steps.map(s => (s.id === id ? { ...s, ...p } : s)));
  // Live schedule — where each step lands, and which setups are impossible
  // (a calendar date in the past, or before the previous step).
  const sched = sequenceSchedule(steps);
  return (
    <div>
      {steps.map((s, i) => {
        const KM = STEP_KIND_META[s.kind];
        const tpls = getTemplates().filter(t => t.channel === KM.channel);
        const mode = s.scheduleMode ?? "after";
        const st = sched[i];
        return (
          <div key={s.id}>
            {i > 0 && <div className="w-px h-3 mx-6" style={{ backgroundColor: "var(--border)" }} />}
            <div className="min-w-0">
              <div className="rounded-xl p-3.5 space-y-2.5" style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${st?.error ? "#dc262666" : "var(--border)"}`, boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ROSE + "14" }}>
                    <KM.icon className="w-3.5 h-3.5" style={{ color: ROSE }} />
                  </span>
                  <p className="text-xs font-bold shrink-0" style={{ color: "var(--text-primary)" }}>Step {i + 1}</p>
                  <div className="flex-1" />
                  {steps.length > 1 && (
                    <button onClick={() => onChange(steps.filter(x => x.id !== s.id))} title="Remove step" style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <UiSelect size="sm" value={s.kind} onChange={v => patch(s.id, { kind: v as SequenceStepKind, templateId: undefined })}
                  options={(Object.keys(STEP_KIND_META) as SequenceStepKind[]).map(k => ({ value: k, label: STEP_KIND_META[k].label }))} />

                {/* Timing — a sub-step of its own: relative wait or a calendar
                    date + time, with the landing date previewed live. */}
                {i > 0 && (
                  <div className="rounded-lg p-2.5 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>When</p>
                    </div>
                    <UiSelect size="sm" value={mode} onChange={v => patch(s.id, { scheduleMode: v as "after" | "on" })}
                      options={[{ value: "after", label: "After the previous step" }, { value: "on", label: "On a specific date" }]} />
                    <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: "var(--text-secondary)" }}>
                      {mode === "after" ? (
                        <>
                          <div className="w-24"><NumberStepper size="sm" min={1} value={String(s.waitDays)} onChange={v => patch(s.id, { waitDays: Math.max(1, Number(v) || 1) })} /></div>
                          day{s.waitDays === 1 ? "" : "s"} after step {i}
                          <span style={{ color: "var(--text-muted)" }}>· at</span>
                          <div className="w-32"><TimePicker size="sm" value={s.timeOfDay ?? ""} onChange={v => patch(s.id, { timeOfDay: v || undefined })} placeholder="Any time" /></div>
                        </>
                      ) : (
                        <>
                          <div className="w-40"><DatePicker size="sm" value={s.onDate ?? ""} onChange={v => patch(s.id, { onDate: v || undefined })} min={new Date().toISOString().slice(0, 10)} /></div>
                          <span style={{ color: "var(--text-muted)" }}>at</span>
                          <div className="w-32"><TimePicker size="sm" value={s.timeOfDay ?? "09:00"} onChange={v => patch(s.id, { timeOfDay: v || undefined })} /></div>
                        </>
                      )}
                    </div>
                    {st?.error
                      ? <p className="text-[11px] font-medium" style={{ color: "#dc2626" }}>{st.error}</p>
                      : st?.due && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Lands {fmtDue(st.due, stepHasTime(s))} if launched today.</p>}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <UiSelect size="sm" value={s.templateId ?? ""} onChange={v => patch(s.id, { templateId: v || undefined })}
                      options={[{ value: "", label: s.kind === "task" ? "No script — task carries the campaign name" : "No template" },
                        ...tpls.map(t => ({ value: t.id, label: t.name }))]} />
                  </div>
                  <button onClick={() => onCreateTemplate(s.kind, s.id)} title={s.kind === "email" ? "Design a new email" : "Write a new one"}
                    className="flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: ROSE }}>
                    <Plus className="w-3.5 h-3.5" /> New
                  </button>
                </div>
                {/* Per-step narrowing — this step only goes to recipients who
                    ALSO match these rules (checked against live CRM records
                    when the step fires; others are skipped, not exited). */}
                {s.onlyIf ? (
                  <div className="rounded-lg p-2.5 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>Only send this step to a subset</p>
                      <button onClick={() => patch(s.id, { onlyIf: undefined })} className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>Remove</button>
                    </div>
                    <BaseChips custom={s.onlyIf} onChange={c => patch(s.id, { onlyIf: c })} />
                    <RuleComposer custom={s.onlyIf} onChange={c => patch(s.id, { onlyIf: c })} firstWord="Who match"
                      emptyHint="No rules yet — add one, or this narrows nothing." />
                  </div>
                ) : (
                  <button onClick={() => patch(s.id, { onlyIf: { base: "customers", rules: [] } })}
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }}>
                    <Plus className="w-3 h-3" /> Only if… (send this step to a subset)
                  </button>
                )}
                {i === 0 && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Fires immediately when the sequence starts.</p>}
              </div>
            </div>
          </div>
        );
      })}
      {steps.length > 0 && <div className="w-px h-3 mx-6" style={{ backgroundColor: "var(--border)" }} />}
      <button onClick={() => onChange([...steps, newSeqStep(steps.length === 0)])}
        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ border: "1px dashed var(--border)", color: ROSE }}>
        <Plus className="w-3.5 h-3.5" /> Add step
      </button>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────
function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}
function BackArrow({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Back" aria-label="Back"
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
}
function NextBar({ disabled, onNext, onBack, label }: { disabled: boolean; onNext: () => void; onBack?: () => void; label: string }) {
  return (
    <div className={`flex items-center ${onBack ? "justify-between" : "justify-end"} pt-1`}>
      {onBack && <BackArrow onClick={onBack} />}
      <button onClick={onNext} disabled={disabled}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 hover:brightness-110"
        style={{ backgroundColor: ROSE }}>
        {label} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
function TemplateCard({ t, on, onPick }: { t: MarketingTemplate; on: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} className="text-left rounded-xl p-4 transition-all hover:-translate-y-0.5 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${on ? ROSE : "var(--border)"}`, boxShadow: on ? `0 0 0 3px ${ROSE}22` : "var(--shadow-card)" }}>
      <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{t.name}</p>
      {t.design ? (
        <div className="rounded-lg overflow-hidden pointer-events-none" style={{ height: 120, border: "1px solid var(--border)" }}>
          <div style={{ transform: "scale(0.34)", transformOrigin: "top left", width: "294%" }}>
            <DesignSurface blocks={t.design.blocks} global={t.design.global} />
          </div>
        </div>
      ) : (
        <p className="text-xs whitespace-pre-wrap line-clamp-4" style={{ color: "var(--text-muted)" }}>{t.body}</p>
      )}
    </button>
  );
}
function ReviewRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderBottom: last ? "none" : "1px solid var(--border-subtle)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm font-medium text-right truncate" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
// One rail section per wizard step: numbered marker + connector line down to
// the next, so the rail literally reads top-to-bottom in step order.
function RailStep({ n, label, done, active, last, onJump, children }: {
  n: number; label: string; done: boolean; active: boolean; last: boolean; onJump: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center shrink-0">
        <button onClick={onJump} title={`Go to ${label}`}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors"
          style={{
            backgroundColor: done ? ROSE : active ? ROSE + "22" : "var(--bg-input)",
            color: done ? "#fff" : active ? ROSE : "var(--text-muted)",
            border: active && !done ? `1.5px solid ${ROSE}` : "1.5px solid transparent",
          }}>
          {done ? <Check className="w-3 h-3" /> : n}
        </button>
        {!last && <span className="flex-1 w-px my-1" style={{ backgroundColor: done ? ROSE + "66" : "var(--border)" }} />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-4"}`}>
        <button onClick={onJump} className="text-[10px] font-semibold uppercase tracking-wider mb-1 block"
          style={{ color: active ? ROSE : "var(--text-muted)" }}>{label}</button>
        <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)", border: `1px solid ${active ? ROSE + "44" : "var(--border)"}` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
function RailEmpty({ text }: { text: string }) {
  return <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>;
}
