"use client";

import { useState } from "react";
import { X } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import { updateProject, type Project, type ProjectPriority } from "@/lib/projects/data";
import { getProjectTypes, getProjectStages } from "@/lib/projects/settings";
import { getMapTemplates, templateForType } from "@/lib/projects/map-templates";
import { getBoardCandidates } from "@/lib/users/data";

const PRIORITIES: ProjectPriority[] = ["low", "normal", "high", "urgent"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function initialsOf(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
// Project dates are stored as friendly strings ("Jun 18, 2026"); the DatePicker
// works in ISO, so convert at the boundary.
function toISO(display?: string): string {
  if (!display) return "";
  const d = new Date(display);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toDisplay(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } as const;

export default function EditProjectModal({ project, onClose, onSaved }: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scope  = { companyId: project.companyId, locationId: project.locationId };
  const types  = getProjectTypes(scope).filter(t => t.active);
  const stages = getProjectStages(scope).filter(s => s.active);
  const roster = getBoardCandidates(project.companyId, project.locationId).map(u => u.fullName);

  const [name, setName]         = useState(project.name);
  const [type, setType]         = useState<string>(project.type);
  const [stage, setStage]       = useState(project.stage ?? stages[0]?.key ?? "");
  const [priority, setPriority] = useState<ProjectPriority>(project.priority);
  const [mapTemplateId, setMapTemplateId] = useState(project.mapTemplateId ?? "");
  const mapTemplates = getMapTemplates();
  const [estVal, setEstVal]     = useState(project.estimatedValue ?? "");
  const [startDate, setStartDate]   = useState(toISO(project.startDate));
  const [targetDate, setTargetDate] = useState(toISO(project.targetDate));
  const [tech, setTech]         = useState(project.assignedTo ?? "");
  const [description, setDescription] = useState(project.description ?? "");

  function save() {
    if (!name.trim()) return;
    updateProject(project.id, {
      name: name.trim(),
      type: type as Project["type"],
      stage,
      priority,
      mapTemplateId: mapTemplateId || undefined,
      estimatedValue: estVal.trim() || undefined,
      startDate: toDisplay(startDate) || undefined,
      targetDate: toDisplay(targetDate) || undefined,
      assignedTo: tech,
      assignedToInitials: tech ? initialsOf(tech) : "",
      description: description.trim(),
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Edit Project</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Project Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
              <UiSelect value={type} onChange={setType} options={types.map(t => ({ value: t.key, label: t.label }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Stage</label>
              <UiSelect value={stage} onChange={setStage} options={stages.map(s => ({ value: s.key, label: s.name }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
              <UiSelect value={priority} onChange={v => setPriority(v as ProjectPriority)} options={PRIORITIES.map(p => ({ value: p, label: cap(p) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Estimated Value</label>
              <input value={estVal} onChange={e => setEstVal(e.target.value)} placeholder="e.g. $24,000" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Workflow Map</label>
            <UiSelect value={mapTemplateId} onChange={setMapTemplateId} options={[
              { value: "", label: `Auto — by type (${templateForType(type as Project["type"]).name})` },
              ...mapTemplates.map(t => ({ value: t.id, label: t.name })),
            ]} />
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>Changing the map re-derives this project&apos;s workflow from the new template.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Start Date</label>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Pick a date" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Target Date</label>
              <DatePicker value={targetDate} onChange={setTargetDate} placeholder="Pick a date" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Assigned To</label>
            <UiSelect value={tech} onChange={setTech} options={[{ value: "", label: "Unassigned" }, ...roster.map(r => ({ value: r, label: r }))]} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className={`${inputCls} resize-none`} style={inputStyle} />
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#0f8578" }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
