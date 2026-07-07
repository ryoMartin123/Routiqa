"use client";

// Notes: internal notes about the agreement. Local state for now (the data model
// only carries a single `notes` string, used to seed the first note).

import { useState } from "react";
import { Pin, PinOff, Plus, StickyNote } from "lucide-react";
import { type CustomerAgreement } from "@/lib/agreements/data";
import { Card, SectionLabel } from "./shared";

interface Note { id: string; text: string; by: string; at: string; pinned: boolean; }

function now(): string {
  return new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function NotesTab({ agreement }: { agreement: CustomerAgreement }) {
  const [notes, setNotes] = useState<Note[]>(() =>
    agreement.notes?.trim() ? [{ id: "seed", text: agreement.notes, by: "System", at: agreement.startDate, pinned: true }] : [],
  );
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim(); if (!t) return;
    setNotes(p => [{ id: `n-${Date.now()}`, text: t, by: "You", at: now(), pinned: false }, ...p]);
    setDraft("");
  }
  function togglePin(id: string) { setNotes(p => p.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n)); }

  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-4">
        <SectionLabel>Add Note</SectionLabel>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="Renewal note, access note, customer preference…"
          className="w-full mt-2 rounded-lg px-3 py-2 text-sm outline-none resize-none thin-scroll-y"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        <div className="flex justify-end mt-2">
          <button onClick={add} disabled={!draft.trim()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 cursor-pointer transition hover:brightness-110 disabled:cursor-not-allowed" style={{ backgroundColor: "#0f8578" }}>
            <Plus className="w-3.5 h-3.5" /> Add Note
          </button>
        </div>
      </Card>

      {sorted.length === 0 ? (
        <Card className="p-10 text-center">
          <StickyNote className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No notes yet.</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {sorted.map(n => (
            <Card key={n.id} className="p-4" style={n.pinned ? { borderColor: "#b9dfd8" } : undefined}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{n.text}</p>
                <button onClick={() => togglePin(n.id)} title={n.pinned ? "Unpin" : "Pin"}
                  className="p-1 rounded-lg shrink-0 cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: n.pinned ? "#0f8578" : "var(--text-muted)" }}>
                  {n.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>{n.by} · {n.at}{n.pinned ? " · Pinned" : ""}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
