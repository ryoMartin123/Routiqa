"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash2, Layers } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { getPhases, savePhases, applyTemplatePhases, newPhaseId, type ProjectPhase, type PhaseStatus } from "@/lib/projects/phases";
import { getProjectTemplates, getProjectStages } from "@/lib/projects/settings";
import { getProject, updateProject } from "@/lib/projects/data";

const NEXT_STATUS: Record<PhaseStatus, PhaseStatus> = {
  upcoming: "in_progress", in_progress: "done", done: "upcoming",
};

// Vertical milestone stepper for a project's Overview — a modern alternative to a
// flat progress bar. Each node is a phase; click the node to advance its state
// (upcoming → in progress → done). Doubles as the phase editor.
export default function ProjectPhases({ projectId, onChange }: {
  projectId: string;
  onChange?: () => void;
}) {
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [tplId, setTplId] = useState("");

  useEffect(() => { setPhases(getPhases(projectId)); }, [projectId]);

  function commit(next: ProjectPhase[]) {
    savePhases(projectId, next);
    setPhases(getPhases(projectId));
    // Auto-advance the project's stage to the first "done" stage once every
    // phase is complete (forward-only — reopening a phase won't move it back).
    if (next.length > 0 && next.every(p => p.status === "done")) {
      const proj = getProject(projectId);
      if (proj) {
        const stages = getProjectStages({ companyId: proj.companyId, locationId: proj.locationId });
        const doneStage = stages.find(s => s.category === "done" && s.active) ?? stages.find(s => s.category === "done");
        if (doneStage && proj.stage !== doneStage.key) updateProject(projectId, { stage: doneStage.key });
      }
    }
    onChange?.();
  }

  function cycle(id: string) {
    commit(phases.map(p => p.id === id ? { ...p, status: NEXT_STATUS[p.status] } : p));
  }
  function rename(id: string, name: string) {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, name } : p));   // local while typing
  }
  function rememberRename() { commit(phases); }
  function remove(id: string) { commit(phases.filter(p => p.id !== id)); }
  function addPhase() {
    const name = newName.trim(); if (!name) { setAdding(false); return; }
    commit([...phases, { id: newPhaseId(), projectId, name, status: "upcoming", order: phases.length + 1 }]);
    setNewName(""); setAdding(false);
  }

  const done = phases.filter(p => p.status === "done").length;
  const pct = phases.length ? Math.round((done / phases.length) * 100) : 0;

  const templates = getProjectTemplates();

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Project Phases</p>
          {phases.length > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
              {done}/{phases.length} · {pct}%
            </span>
          )}
        </div>
        {phases.length > 0 && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}>
            <Plus className="w-3.5 h-3.5" /> Add phase
          </button>
        )}
      </div>

      {phases.length === 0 ? (
        <div className="text-center py-6 space-y-3">
          <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
            <Layers className="w-5 h-5" style={{ color: "var(--accent-text)" }} />
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No phases yet. Start from a template or add your own.</p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-52"><UiSelect value={tplId} onChange={setTplId} placeholder="Apply a template…"
              options={templates.map(t => ({ value: t.id, label: t.name }))} /></div>
            <button onClick={() => { const t = templates.find(x => x.id === tplId); if (t) { applyTemplatePhases(projectId, t.phases); setPhases(getPhases(projectId)); onChange?.(); } }}
              disabled={!tplId}
              className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>Apply</button>
          </div>
          <button onClick={() => setAdding(true)} className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>+ Add a phase manually</button>
        </div>
      ) : (
        <div className="flex items-start overflow-x-auto thin-scroll-y pb-1 -mx-1 px-1">
          {phases.map((ph, i) => {
            const last = i === phases.length - 1;
            const node = ph.status === "done"
              ? { bg: "#10b981", border: "#10b981" }
              : ph.status === "in_progress"
              ? { bg: "#4f46e5", border: "#4f46e5" }
              : { bg: "var(--bg-surface)", border: "var(--border)" };
            return (
              <div key={ph.id} className="relative flex flex-col items-center group shrink-0" style={{ width: "8.5rem" }}>
                {/* connecting rail to the next node (sits behind, centered on the node row) */}
                {!last && <span className="absolute top-[13px] left-1/2 right-[-50%] h-0.5" style={{ backgroundColor: ph.status === "done" ? "#10b981" : "var(--border)" }} />}
                {/* node */}
                <button onClick={() => cycle(ph.id)} title="Click to advance status"
                  className="relative z-10 w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                  style={{ backgroundColor: node.bg, border: `2px solid ${node.border}` }}>
                  {ph.status === "done"
                    ? <Check className="w-3.5 h-3.5 text-white" />
                    : ph.status === "in_progress"
                    ? <span className="w-2 h-2 rounded-full bg-white" />
                    : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--text-muted)" }} />}
                </button>
                {/* content (centered under the node) */}
                <div className="mt-2 w-full px-1.5 text-center">
                  <div className="relative flex items-center justify-center">
                    <input value={ph.name}
                      onChange={e => rename(ph.id, e.target.value)} onBlur={rememberRename}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="w-full text-sm font-medium bg-transparent outline-none text-center"
                      style={{ color: ph.status === "done" ? "var(--text-muted)" : "var(--text-primary)", textDecoration: ph.status === "done" ? "line-through" : "none" }} />
                    <button onClick={() => remove(ph.id)} className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50" style={{ color: "#9ca3af" }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {ph.status === "done" ? "Done" : ph.status === "in_progress" ? "In progress" : "Upcoming"}
                    {ph.targetDate ? ` · ${ph.targetDate}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="flex items-center gap-2 mt-3">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addPhase(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
            placeholder="Phase name…" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <button onClick={addPhase} className="px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: "#4f46e5" }}>Add</button>
          <button onClick={() => { setAdding(false); setNewName(""); }} className="px-2 py-2 rounded-lg text-sm shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
