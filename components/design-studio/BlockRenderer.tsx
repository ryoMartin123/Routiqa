"use client";

// ─── Design Studio — block renderer ───────────────────────
// Pure presentation for a DesignDoc's block tree, shared by the studio canvas
// (which wraps every block in a selection frame) and static previews (template
// cards). `frame` wraps each rendered block — identity when omitted.

import { Fragment } from "react";
import { ImageIcon } from "lucide-react";
import type { DesignBlock, DesignGlobal } from "@/lib/design-studio/model";

export type BlockFrame = (block: DesignBlock, el: React.ReactNode) => React.ReactNode;

export function BlockList({ blocks, global, frame }: { blocks: DesignBlock[]; global: DesignGlobal; frame?: BlockFrame }) {
  return <>{blocks.map(b => {
    const el = <Block block={b} global={global} frame={frame} />;
    return <Fragment key={b.id}>{frame ? frame(b, el) : el}</Fragment>;
  })}</>;
}

function Block({ block, global, frame }: { block: DesignBlock; global: DesignGlobal; frame?: BlockFrame }) {
  const s = block.styles ?? {};
  const spacing: React.CSSProperties = { marginTop: s.marginTop, marginBottom: s.marginBottom };
  const text: React.CSSProperties = {
    ...spacing,
    color: s.color ?? global.textColor,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    textAlign: s.align,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  };

  switch (block.type) {
    case "section":
      return (
        <div style={{ ...spacing, backgroundColor: s.bg ?? "transparent", borderRadius: s.radius, padding: s.padding ?? 0 }}>
          <BlockList blocks={block.children ?? []} global={global} frame={frame} />
          {(block.children ?? []).length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: "#9ca3af" }}>Empty section — select it and insert blocks</p>
          )}
        </div>
      );
    case "columns":
      return (
        <div className="flex gap-4" style={{ ...spacing, backgroundColor: s.bg ?? "transparent", borderRadius: s.radius, padding: s.padding ?? 0 }}>
          {(block.cols ?? [[], []]).map((col, i) => (
            <div key={i} className="flex-1 min-w-0">
              <BlockList blocks={col} global={global} frame={frame} />
              {col.length === 0 && <p className="text-xs text-center py-4" style={{ color: "#9ca3af" }}>Empty column</p>}
            </div>
          ))}
        </div>
      );
    case "heading":
      return <p style={{ fontSize: 24, fontWeight: 700, ...text }}>{block.text}</p>;
    case "paragraph":
      return <p style={{ fontSize: 14, ...text }}>{block.text}</p>;
    case "list":
      return (
        <ul style={{ fontSize: 14, ...text, paddingLeft: 22, listStyle: "disc", whiteSpace: "normal" }}>
          {(block.text ?? "").split("\n").filter(l => l.trim()).map((l, i) => <li key={i}>{l.trim()}</li>)}
        </ul>
      );
    case "button":
      return (
        <div style={{ ...spacing, textAlign: s.align ?? "left" }}>
          <span className="inline-block" style={{
            backgroundColor: s.bg ?? global.accent, color: s.color ?? "#ffffff",
            fontSize: s.fontSize ?? 14, fontWeight: s.fontWeight ?? 600,
            padding: `${(s.padding ?? 12) * 0.75}px ${(s.padding ?? 12) * 1.6}px`,
            borderRadius: s.radius ?? 8,
          }}>{block.text || "Button"}</span>
        </div>
      );
    case "image":
      return (
        <div style={{ ...spacing, textAlign: s.align ?? "left" }}>
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied design asset, arbitrary origin
            <img src={block.src} alt={block.alt ?? ""} className="inline-block max-w-full"
              style={{ width: `${s.widthPct ?? 100}%`, borderRadius: s.radius }} />
          ) : (
            <div className="inline-flex items-center justify-center" style={{
              width: `${s.widthPct ?? 100}%`, height: 120, borderRadius: s.radius ?? 8,
              backgroundColor: "#eceff1", border: "1.5px dashed #cbd5e1",
            }}>
              <ImageIcon className="w-6 h-6" style={{ color: "#94a3b8" }} />
            </div>
          )}
        </div>
      );
    case "divider":
      return <div style={{ ...spacing, height: s.height ?? 1, backgroundColor: s.color ?? "#e5e7eb" }} />;
    case "spacer":
      return <div style={{ height: s.height ?? 24 }} />;
  }
}

// The full email / document surface: page background + centered content column.
// The bg padding frames the column the way an email client would.
export default function DesignSurface({ blocks, global, frame, className }: {
  blocks: DesignBlock[]; global: DesignGlobal; frame?: BlockFrame; className?: string;
}) {
  return (
    <div className={className} style={{ backgroundColor: global.bg, fontFamily: global.fontFamily, padding: "36px 28px" }}>
      {/* No column padding — sections own their spacing, so a branded header
          section can run full-bleed to the content edges. */}
      <div className="mx-auto my-0" style={{
        maxWidth: global.contentWidth, backgroundColor: global.contentBg,
        color: global.textColor, minHeight: 200,
      }}>
        <BlockList blocks={blocks} global={global} frame={frame} />
        {blocks.length === 0 && (
          <p className="text-sm text-center py-16" style={{ color: "#9ca3af" }}>Insert blocks from the left to start designing</p>
        )}
      </div>
    </div>
  );
}
