"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, EyeOff, Eye, X, Trash2, GripVertical } from "lucide-react";
import { pingSaved } from "@/components/shared/SavedPill";
import {
  getFields, saveFields, generateId, labelToKey,
} from "@/lib/custom-fields/data";
import {
  RECORD_TYPE_LABELS, FIELD_TYPE_LABELS, FIELD_TYPE_BADGE, OPTION_FIELD_TYPES,
  type CustomField, type RecordType, type FieldType,
} from "@/lib/custom-fields/types";
import UiSelect from "@/components/ui/Select";

const RECORD_TYPES = Object.keys(RECORD_TYPE_LABELS) as RecordType[];
const FIELD_TYPES  = Object.keys(FIELD_TYPE_LABELS)  as FieldType[];

// ─── Blank form state ─────────────────────────────────────
const EMPTY_FORM: Omit<CustomField, "id" | "createdAt"> = {
  recordType: "customers",
  label:      "",
  key:        "",
  fieldType:  "text",
  required:   false,
  visible:    true,
  options:    [],
  sortOrder:  0,
};

// ─── Small toggle ─────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)" }}
      role="switch" aria-checked={on}
    >
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

// ─── Section ──────────────────────────────────────────────
export default function CustomFieldsSection() {
  const [fields,      setFields]      = useState<CustomField[]>(() => getFields());
  const [activeType,  setActiveType]  = useState<RecordType>("customers");
  const [showForm,    setShowForm]    = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [form,        setForm]        = useState<Omit<CustomField, "id" | "createdAt">>({ ...EMPTY_FORM });
  const [optionInput, setOptionInput] = useState("");

  // Reload from store when component mounts
  useEffect(() => { setFields(getFields()); }, []);

  const typeFields = fields
    .filter(f => f.recordType === activeType)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // ── Form helpers ───────────────────────────────────────
  function openAdd() {
    const nextOrder = typeFields.length > 0
      ? Math.max(...typeFields.map(f => f.sortOrder)) + 1
      : 1;
    setForm({ ...EMPTY_FORM, recordType: activeType, sortOrder: nextOrder });
    setOptionInput("");
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(field: CustomField) {
    setForm({
      recordType: field.recordType,
      label:      field.label,
      key:        field.key,
      fieldType:  field.fieldType,
      required:   field.required,
      visible:    field.visible,
      options:    field.options ?? [],
      sortOrder:  field.sortOrder,
    });
    setOptionInput("");
    setEditingId(field.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setOptionInput("");
  }

  function setFormField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleLabelChange(label: string) {
    setForm(f => ({
      ...f, label,
      key: editingId ? f.key : labelToKey(label),
    }));
  }

  function addOption() {
    const trimmed = optionInput.trim();
    if (!trimmed || form.options?.includes(trimmed)) return;
    setForm(f => ({ ...f, options: [...(f.options ?? []), trimmed] }));
    setOptionInput("");
  }

  function removeOption(opt: string) {
    setForm(f => ({ ...f, options: f.options?.filter(o => o !== opt) }));
  }

  // ── CRUD ───────────────────────────────────────────────
  function handleSaveField() {
    if (!form.label.trim() || !form.key.trim()) return;

    let updated: CustomField[];
    if (editingId) {
      updated = fields.map(f =>
        f.id === editingId ? { ...f, ...form } : f
      );
    } else {
      const newField: CustomField = {
        ...form,
        id:        generateId(),
        createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        options:   OPTION_FIELD_TYPES.includes(form.fieldType) ? (form.options ?? []) : undefined,
      };
      updated = [...fields, newField];
    }
    setFields(updated);
    saveFields(updated); pingSaved();
    closeForm();
  }

  function toggleVisible(id: string) {
    const updated = fields.map(f =>
      f.id === id ? { ...f, visible: !f.visible } : f
    );
    setFields(updated);
    saveFields(updated); pingSaved();
  }

  function toggleRequired(id: string) {
    const updated = fields.map(f =>
      f.id === id ? { ...f, required: !f.required } : f
    );
    setFields(updated);
    saveFields(updated); pingSaved();
  }

  function disableField(id: string) {
    const updated = fields.map(f =>
      f.id === id ? { ...f, visible: false } : f
    );
    setFields(updated);
    saveFields(updated); pingSaved();
  }

  function deleteField(id: string) {
    const updated = fields.filter(f => f.id !== id);
    setFields(updated);
    saveFields(updated); pingSaved();
  }

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Custom Fields</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Add organization-specific fields to any record type. Fields will appear on detail pages and forms.
          </p>
        </div>
      </div>

      {/* Record type tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {RECORD_TYPES.map(rt => {
          const count  = fields.filter(f => f.recordType === rt).length;
          const active = activeType === rt;
          return (
            <button key={rt} onClick={() => { setActiveType(rt); closeForm(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0"
              style={{
                backgroundColor: active ? "#4f46e5" : "var(--bg-surface-2)",
                color:            active ? "#fff"    : "var(--text-secondary)",
                border:           active ? "none"    : "1px solid var(--border)",
              }}>
              {RECORD_TYPE_LABELS[rt]}
              {count > 0 && (
                <span className="text-[9px] font-bold px-1 py-0.5 rounded-full"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.25)" : "var(--bg-input)", color: active ? "#fff" : "var(--text-muted)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-4"
          style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>
              {editingId ? "Edit Field" : "New Field"} — {RECORD_TYPE_LABELS[activeType]}
            </p>
            <button onClick={closeForm} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Label */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Field Label <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={form.label}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="e.g. Preferred Contact Time"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Key */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Field Key <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={form.key}
                onChange={e => setFormField("key", labelToKey(e.target.value))}
                placeholder="preferred_contact_time"
                className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Auto-generated. Used as the database column name.</p>
            </div>

            {/* Field type */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Field Type</label>
              <UiSelect
                value={form.fieldType}
                onChange={v => setFormField("fieldType", v as FieldType)}
                options={FIELD_TYPES.map(ft => ({ value: ft, label: FIELD_TYPE_LABELS[ft] }))}
              />
            </div>

            {/* Sort order */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Sort Order</label>
              <input
                type="number" min={1}
                value={form.sortOrder}
                onChange={e => setFormField("sortOrder", parseInt(e.target.value) || 1)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          {/* Options — only for dropdown / multi_select */}
          {OPTION_FIELD_TYPES.includes(form.fieldType) && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Options</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(form.options ?? []).map(opt => (
                  <span key={opt} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                    style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>
                    {opt}
                    <button onClick={() => removeOption(opt)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                  placeholder="Type an option and press Enter…"
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
                <button onClick={addOption}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Toggle on={form.required} onChange={v => setFormField("required", v)} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Toggle on={form.visible} onChange={v => setFormField("visible", v)} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Visible by default</span>
            </label>
          </div>

          {/* Form actions */}
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <button onClick={closeForm}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button onClick={handleSaveField} disabled={!form.label.trim() || !form.key.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: "#4f46e5" }}>
              {editingId ? "Update Field" : "Add Field"}
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>

        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {RECORD_TYPE_LABELS[activeType]} Fields
            {typeFields.length > 0 && (
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                {typeFields.length}
              </span>
            )}
          </p>
          {!showForm && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>
          )}
        </div>

        {/* Column headers */}
        <div className="grid px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            gridTemplateColumns: "2fr 1.5fr 1.2fr 0.8fr 0.8fr 0.8fr auto",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border)",
          }}>
          <span>Label</span>
          <span>Key</span>
          <span>Type</span>
          <span className="text-center">Required</span>
          <span className="text-center">Visible</span>
          <span>Added</span>
          <span />
        </div>

        {/* Rows */}
        {typeFields.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              No custom fields for {RECORD_TYPE_LABELS[activeType]} yet
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Click &quot;Add Field&quot; to create the first one.
            </p>
          </div>
        ) : (
          typeFields.map((field, i) => {
            const badge = FIELD_TYPE_BADGE[field.fieldType];
            const isLast = i === typeFields.length - 1;
            const dimmed = !field.visible;

            return (
              <div key={field.id}
                className="grid px-5 py-3 items-center transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{
                  gridTemplateColumns: "2fr 1.5fr 1.2fr 0.8fr 0.8fr 0.8fr auto",
                  borderBottom: isLast ? "none" : "1px solid var(--border)",
                  opacity: dimmed ? 0.5 : 1,
                }}>

                {/* Label */}
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 shrink-0 opacity-30" style={{ color: "var(--text-muted)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{field.label}</p>
                    {field.options && field.options.length > 0 && (
                      <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                        {field.options.slice(0, 3).join(", ")}{field.options.length > 3 ? ` +${field.options.length - 3}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Key */}
                <span className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
                  {field.key}
                </span>

                {/* Type badge */}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit"
                  style={{ backgroundColor: badge.bg, color: badge.color }}>
                  {FIELD_TYPE_LABELS[field.fieldType]}
                </span>

                {/* Required toggle */}
                <div className="flex justify-center">
                  <Toggle on={field.required} onChange={() => toggleRequired(field.id)} />
                </div>

                {/* Visible toggle */}
                <div className="flex justify-center">
                  <Toggle on={field.visible} onChange={() => toggleVisible(field.id)} />
                </div>

                {/* Created */}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{field.createdAt}</span>

                {/* Actions */}
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => openEdit(field)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-input)]"
                    title="Edit field" style={{ color: "var(--text-muted)" }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleVisible(field.id)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-input)]"
                    title={field.visible ? "Hide field" : "Show field"}
                    style={{ color: "var(--text-muted)" }}>
                    {field.visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => deleteField(field.id)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                    title="Delete field" style={{ color: "#d1d5db" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Custom fields will appear on {RECORD_TYPE_LABELS[activeType].toLowerCase()} detail pages and create/edit forms.
        Field keys are permanent once created — renaming the label does not change the key.
      </p>
    </div>
  );
}
