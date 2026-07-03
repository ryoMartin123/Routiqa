"use client";

// ─── Shared Boards ────────────────────────────────────────
// Team kanban: switch between boards, move cards across columns, add cards and
// columns. Lightweight (no drag lib) — cards move with hover arrows. Team blue.

import { useMemo, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, X, LayoutGrid, Trash2 } from "lucide-react";
import {
  getBoards, addCard, deleteCard, moveCard, addColumn, addBoard, LABELS,
  type Board, type BoardCard,
} from "@/lib/team-workspace/boards-data";

const ACCENT = "#2563eb";
const initials = (n: string) => n.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

export default function SharedBoards() {
  const [tick, setTick] = useState(0);
  const reload = () => setTick(t => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const boards = useMemo(() => getBoards(), [tick]);
  const [activeId, setActiveId] = useState<string>("");
  const board = boards.find(b => b.id === activeId) ?? boards[0];

  return (
    <div className="p-6 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Shared Boards</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Plan and track team work together — projects, ops, and initiatives.</p>
        </div>
      </div>

      {/* Board tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto thin-scroll-x shrink-0">
        {boards.map(b => {
          const on = b.id === board?.id;
          return (
            <button key={b.id} onClick={() => setActiveId(b.id)} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: on ? ACCENT : "var(--bg-surface)", color: on ? "#fff" : "var(--text-secondary)", border: `1px solid ${on ? "transparent" : "var(--border-subtle)"}` }}>
              <LayoutGrid className="w-3.5 h-3.5" />{b.name}
            </button>
          );
        })}
        <NewBoardButton onAdd={name => { const b = addBoard(name); reload(); setActiveId(b.id); }} />
      </div>

      {/* Columns */}
      {board && (
        <div className="flex-1 min-h-0 overflow-x-auto thin-scroll-x">
          <div className="flex gap-4 h-full pb-2" style={{ minWidth: "min-content" }}>
            {board.columns.map((col, ci) => (
              <div key={col.id} className="w-72 shrink-0 flex flex-col rounded-2xl" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between px-3.5 py-2.5 shrink-0">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{col.title}</span>
                  <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>{col.cards.length}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto thin-scroll-y px-2.5 space-y-2">
                  {col.cards.map(card => (
                    <Card key={card.id} card={card} canLeft={ci > 0} canRight={ci < board.columns.length - 1}
                      onMove={dir => { moveCard(board.id, card.id, dir); reload(); }}
                      onDelete={() => { deleteCard(board.id, card.id); reload(); }} />
                  ))}
                </div>
                <AddCard onAdd={title => { addCard(board.id, col.id, title); reload(); }} />
              </div>
            ))}
            {/* Add column */}
            <AddColumn onAdd={title => { addColumn(board.id, title); reload(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ card, canLeft, canRight, onMove, onDelete }: { card: BoardCard; canLeft: boolean; canRight: boolean; onMove: (dir: number) => void; onDelete: () => void }) {
  const labelColor = card.label ? LABELS[card.label] ?? "var(--text-muted)" : undefined;
  return (
    <div className="group rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {card.label && <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mb-1.5" style={{ backgroundColor: labelColor + "1a", color: labelColor }}>{card.label}</span>}
      <p className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>{card.title}</p>
      <div className="flex items-center justify-between mt-2">
        {card.assignee
          ? <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: ACCENT }}>{initials(card.assignee)}</span>
          : <span />}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button disabled={!canLeft} onClick={() => onMove(-1)} className="p-1 rounded disabled:opacity-20" title="Move left"><ChevronLeft className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>
          <button disabled={!canRight} onClick={() => onMove(1)} className="p-1 rounded disabled:opacity-20" title="Move right"><ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>
          <button onClick={onDelete} className="p-1 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" style={{ color: "#dc2626" }} /></button>
        </div>
      </div>
    </div>
  );
}

function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onAdd(val); setVal(""); } setOpen(false); };
  return (
    <div className="p-2.5 shrink-0">
      {open ? (
        <div>
          <textarea autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") setOpen(false); }}
            placeholder="Card title…" rows={2} className="w-full rounded-lg px-2.5 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <div className="flex gap-2 mt-1.5">
            <button onClick={submit} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: ACCENT }}>Add</button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg"><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--bg-surface)]" style={{ color: "var(--text-muted)" }}>
          <Plus className="w-4 h-4" /> Add card
        </button>
      )}
    </div>
  );
}

function AddColumn({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onAdd(val); setVal(""); } setOpen(false); };
  return (
    <div className="w-72 shrink-0">
      {open ? (
        <div className="rounded-2xl p-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
            placeholder="Column title…" className="w-full rounded-lg px-2.5 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <div className="flex gap-2 mt-1.5">
            <button onClick={submit} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: ACCENT }}>Add column</button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg"><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
          <Plus className="w-4 h-4" /> Add column
        </button>
      )}
    </div>
  );
}

function NewBoardButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onAdd(val); setVal(""); } setOpen(false); };
  return open ? (
    <div className="shrink-0 flex items-center gap-1.5">
      <input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Board name…" className="rounded-lg px-2.5 py-1.5 text-sm outline-none w-40" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      <button onClick={submit} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: ACCENT }}>Add</button>
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
      <Plus className="w-4 h-4" /> New board
    </button>
  );
}
