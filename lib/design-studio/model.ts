// ─── Design Studio — shared block-document model ──────────
// One engine, two skins: marketing EMAILS (600px, merge fields) and DOCUMENTS
// (page width, saved into the file gallery). A design is a tree of blocks —
// sections stack blocks, columns split them side by side — rendered by
// BlockRenderer and edited in DesignStudio. Stored as JSON wherever the host
// keeps it (template.design, the doc-content store). Mock/local.

export type StudioMode = "email" | "document";

export type BlockType =
  | "section" | "columns" | "heading" | "paragraph" | "button"
  | "image" | "divider" | "spacer" | "list";

export interface BlockStyles {
  color?: string;
  bg?: string;
  fontSize?: number;
  fontWeight?: number;          // 400 / 600 / 700
  lineHeight?: number;          // multiplier
  align?: "left" | "center" | "right";
  padding?: number;             // uniform inner padding (section / columns / button)
  marginTop?: number;
  marginBottom?: number;
  radius?: number;              // section / button / image corners
  height?: number;              // spacer height / divider thickness
  widthPct?: number;            // image width as % of the content column
}

export interface DesignBlock {
  id: string;
  type: BlockType;
  text?: string;                // heading / paragraph / button label; list = one item per line
  href?: string;                // button link
  src?: string;                 // image url (or a gallery data-url)
  alt?: string;
  children?: DesignBlock[];     // section
  cols?: [DesignBlock[], DesignBlock[]];   // columns (two stacks)
  styles?: BlockStyles;
}

export interface DesignGlobal {
  fontFamily: string;
  bg: string;                   // page background behind the content column
  contentBg: string;            // the content column itself
  textColor: string;
  accent: string;               // default button / link color
  contentWidth: number;         // 600 email · 760 document
}

export interface DesignDoc {
  version: 1;
  mode: StudioMode;
  global: DesignGlobal;
  blocks: DesignBlock[];
}

export const FONT_STACKS: { value: string; label: string }[] = [
  { value: "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif", label: "Sans (system)" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Courier New', monospace", label: "Monospace" },
];

// Merge fields the seed templates already use — offered as tap-to-insert chips
// in email mode. Rendering keeps them literal; the (mock) send substitutes.
export const MERGE_FIELDS = [
  "{{first_name}}", "{{company}}", "{{job_title}}", "{{plan_name}}",
  "{{renewal_date}}", "{{expires}}", "{{review_link}}", "{{eta}}",
] as const;

export const newBlockId = (): string => `blk-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ─── Factories ────────────────────────────────────────────
export function newBlock(type: BlockType): DesignBlock {
  const id = newBlockId();
  switch (type) {
    case "section":   return { id, type, children: [], styles: { padding: 20, radius: 8 } };
    case "columns":   return { id, type, cols: [[], []], styles: { padding: 0 } };
    case "heading":   return { id, type, text: "Heading", styles: { fontSize: 26, fontWeight: 700 } };
    case "paragraph": return { id, type, text: "Write something…", styles: { fontSize: 14, lineHeight: 1.6 } };
    case "button":    return { id, type, text: "Call to action", href: "", styles: { align: "left", radius: 8, padding: 12, fontSize: 14, fontWeight: 600 } };
    case "image":     return { id, type, src: "", alt: "", styles: { widthPct: 100, radius: 8 } };
    case "divider":   return { id, type, styles: { height: 1, marginTop: 12, marginBottom: 12 } };
    case "spacer":    return { id, type, styles: { height: 24 } };
    case "list":      return { id, type, text: "First item\nSecond item", styles: { fontSize: 14, lineHeight: 1.7 } };
  }
}

export function emptyDesign(mode: StudioMode): DesignDoc {
  return {
    version: 1,
    mode,
    global: {
      fontFamily: FONT_STACKS[0].value,
      bg: mode === "email" ? "#f1f3f4" : "#e9ebee",
      contentBg: "#ffffff",
      textColor: "#1f2937",
      accent: "#0f8578",
      contentWidth: mode === "email" ? 600 : 760,
    },
    blocks: [],
  };
}

// A branded first canvas for a brand-new email — Routiqa-style teal header
// with the company name, hero + body, CTA, and a compliant footer. Every
// piece is a normal block, so "start branded, then make it yours."
export function starterEmailDesign(): DesignDoc {
  const doc = emptyDesign("email");
  const accent = doc.global.accent;

  const header = { ...newBlock("section"), styles: { bg: accent, padding: 18, radius: 0 } as BlockStyles };
  header.children = [
    { ...newBlock("heading"), text: "{{company}}", styles: { color: "#ffffff", fontSize: 20, fontWeight: 700, align: "center" } },
  ];

  const hero = { ...newBlock("section"), styles: { padding: 24 } as BlockStyles };
  hero.children = [
    { ...newBlock("heading"), text: "Hi {{first_name}},", styles: { fontSize: 26, fontWeight: 700 } },
    { ...newBlock("paragraph"), text: "Write your message here. Use merge fields like {{company}} and {{job_title}} to personalize it for every customer.", styles: { fontSize: 14, lineHeight: 1.6 } },
    { ...newBlock("spacer"), styles: { height: 12 } },
    { ...newBlock("button"), text: "Book your visit", styles: { align: "center", radius: 8, padding: 12, fontSize: 14, fontWeight: 600 } },
  ];

  const footer = { ...newBlock("section"), styles: { padding: 16 } as BlockStyles };
  footer.children = [
    { ...newBlock("divider"), styles: { height: 1, marginBottom: 14 } },
    { ...newBlock("paragraph"), text: "{{company}} · Proudly serving your area\nQuestions? Just reply to this email. Reply STOP to opt out.", styles: { fontSize: 11, lineHeight: 1.6, align: "center", color: "#9ca3af" } },
  ];

  doc.blocks = [header, hero, footer];
  return doc;
}

// Lift an existing plain-text template body into blocks (one paragraph per
// blank-line break) so opening the studio never starts from nothing.
export function designFromText(mode: StudioMode, text: string): DesignDoc {
  const doc = emptyDesign(mode);
  const paras = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const section = newBlock("section");
  section.children = paras.map(p => ({ ...newBlock("paragraph"), text: p }));
  doc.blocks = [section];
  return doc;
}

// Derived plain text — the legacy `body` fallback (SMS preview, list cards).
export function plainTextFromDesign(doc: DesignDoc): string {
  const out: string[] = [];
  const walk = (blocks: DesignBlock[]) => {
    for (const b of blocks) {
      if (b.text?.trim()) out.push(b.type === "list" ? b.text.split("\n").map(l => `• ${l.trim()}`).join("\n") : b.text.trim());
      if (b.children) walk(b.children);
      if (b.cols) { walk(b.cols[0]); walk(b.cols[1]); }
    }
  };
  walk(doc.blocks);
  return out.join("\n\n");
}

// ─── Tree operations (immutable) ──────────────────────────
// Every nested list (root, section children, each column) is transformed by
// the same list function — one mechanism for remove / move / duplicate.
function mapLists(blocks: DesignBlock[], fn: (list: DesignBlock[]) => DesignBlock[]): DesignBlock[] {
  return fn(blocks).map(b => ({
    ...b,
    children: b.children ? mapLists(b.children, fn) : undefined,
    cols: b.cols ? [mapLists(b.cols[0], fn), mapLists(b.cols[1], fn)] as [DesignBlock[], DesignBlock[]] : undefined,
  }));
}

export function findBlock(blocks: DesignBlock[], id: string): DesignBlock | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const hit = (b.children && findBlock(b.children, id))
      || (b.cols && (findBlock(b.cols[0], id) || findBlock(b.cols[1], id)));
    if (hit) return hit;
  }
  return null;
}

export function patchBlock(blocks: DesignBlock[], id: string, patch: Partial<DesignBlock>): DesignBlock[] {
  return blocks.map(b => {
    if (b.id === id) return { ...b, ...patch };
    return {
      ...b,
      children: b.children ? patchBlock(b.children, id, patch) : undefined,
      cols: b.cols ? [patchBlock(b.cols[0], id, patch), patchBlock(b.cols[1], id, patch)] as [DesignBlock[], DesignBlock[]] : undefined,
    };
  });
}

export function patchStyles(blocks: DesignBlock[], id: string, styles: Partial<BlockStyles>): DesignBlock[] {
  const cur = findBlock(blocks, id);
  return cur ? patchBlock(blocks, id, { styles: { ...cur.styles, ...styles } }) : blocks;
}

export function removeBlock(blocks: DesignBlock[], id: string): DesignBlock[] {
  return mapLists(blocks, list => list.filter(b => b.id !== id));
}

export function moveBlock(blocks: DesignBlock[], id: string, dir: -1 | 1): DesignBlock[] {
  return mapLists(blocks, list => {
    const i = list.findIndex(b => b.id === id);
    if (i < 0) return list;
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}

// Deep-copy with fresh ids so a duplicate is fully independent.
function cloneWithNewIds(b: DesignBlock): DesignBlock {
  return {
    ...b,
    id: newBlockId(),
    children: b.children?.map(cloneWithNewIds),
    cols: b.cols ? [b.cols[0].map(cloneWithNewIds), b.cols[1].map(cloneWithNewIds)] as [DesignBlock[], DesignBlock[]] : undefined,
  };
}

export function duplicateBlock(blocks: DesignBlock[], id: string): { blocks: DesignBlock[]; newId: string | null } {
  let newId: string | null = null;
  const next = mapLists(blocks, list => {
    const i = list.findIndex(b => b.id === id);
    if (i < 0 || newId) return list;
    const copy = cloneWithNewIds(list[i]);
    newId = copy.id;
    return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
  });
  return { blocks: next, newId };
}

// ─── Drag & drop ──────────────────────────────────────────
// Move a block next to (before/after) or into (inside) another block.
// Dropping a block into its own subtree is a no-op — a section can't live
// inside itself.
export type DropPos = "before" | "after" | "inside";

function insertNear(blocks: DesignBlock[], targetId: string, block: DesignBlock, pos: "before" | "after"): DesignBlock[] {
  let placed = false;
  const out = mapLists(blocks, list => {
    const i = list.findIndex(b => b.id === targetId);
    if (i < 0 || placed) return list;
    placed = true;
    const j = pos === "before" ? i : i + 1;
    return [...list.slice(0, j), block, ...list.slice(j)];
  });
  return placed ? out : [...blocks, block];
}

export function moveBlockTo(blocks: DesignBlock[], id: string, targetId: string, pos: DropPos): DesignBlock[] {
  if (id === targetId) return blocks;
  const dragged = findBlock(blocks, id);
  if (!dragged || findBlock([dragged], targetId)) return blocks;
  const without = removeBlock(blocks, id);
  // "inside" reuses insertBlock's container logic (section children / shorter column).
  return pos === "inside" ? insertBlock(without, dragged, targetId) : insertNear(without, targetId, dragged, pos);
}

// Move a block to the very end of the root (dropping on empty canvas).
export function moveBlockToEnd(blocks: DesignBlock[], id: string): DesignBlock[] {
  const dragged = findBlock(blocks, id);
  if (!dragged) return blocks;
  return [...removeBlock(blocks, id), dragged];
}

// Place a NEW block relative to a target — palette drags use the same drop
// positions as block moves (before / after / inside a container).
export function insertBlockAt(blocks: DesignBlock[], block: DesignBlock, targetId: string, pos: DropPos): DesignBlock[] {
  return pos === "inside" ? insertBlock(blocks, block, targetId) : insertNear(blocks, targetId, block, pos);
}

// Insert a new block: into the selected container (section / a columns block's
// first open column), after the selected leaf, or at the end of the root.
export function insertBlock(blocks: DesignBlock[], block: DesignBlock, selectedId: string | null): DesignBlock[] {
  if (selectedId) {
    const sel = findBlock(blocks, selectedId);
    if (sel?.type === "section" && block.type !== "section") {
      return patchBlock(blocks, selectedId, { children: [...(sel.children ?? []), block] });
    }
    if (sel?.type === "columns" && block.type !== "section" && block.type !== "columns" && sel.cols) {
      const target = sel.cols[0].length <= sel.cols[1].length ? 0 : 1;
      const cols = [...sel.cols] as [DesignBlock[], DesignBlock[]];
      cols[target] = [...cols[target], block];
      return patchBlock(blocks, selectedId, { cols });
    }
    if (sel) {
      let placed = false;
      const next = mapLists(blocks, list => {
        const i = list.findIndex(b => b.id === selectedId);
        if (i < 0 || placed) return list;
        placed = true;
        return [...list.slice(0, i + 1), block, ...list.slice(i + 1)];
      });
      if (placed) return next;
    }
  }
  return [...blocks, block];
}
