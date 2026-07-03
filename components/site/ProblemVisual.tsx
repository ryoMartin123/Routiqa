"use client";

// ─── Problem visual: the group-chat "system" ──────────────
// The most honest picture of disconnected tools isn't a diagram — it's the
// office group chat that glues them together. A choreographed thread plays out
// a job falling through the cracks in real time: nobody owns the call, the
// address is buried in an inbox, the customer is on day three, an invoice was
// never sent. Red cost tags pin the business damage to each message. Loops.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Hash, Send } from "lucide-react";

interface Beat {
  t: number;                    // ms into the loop when this appears
  from: string;                 // initials
  name: string;
  color: string;
  text: string;
  me?: boolean;                 // right-aligned (the owner)
  tag?: string;                 // red damage tag, appears shortly after
}

const BEATS: Beat[] = [
  { t: 400,   from: "KB", name: "Kylie · dispatch", color: "#0891b2", text: "Who's got the no-cool on Walton Way today?", tag: "Never made it onto the board" },
  { t: 2300,  from: "LR", name: "Luis", color: "#10b981", text: "not me — I'm on the Riverside install all day" },
  { t: 4100,  from: "TH", name: "Tucker", color: "#4f46e5", text: "first I'm hearing of it… address?", tag: "Address is buried in someone's inbox" },
  { t: 6300,  from: "KB", name: "Kylie · dispatch", color: "#0891b2", text: "hang on, digging through email 🙃" },
  { t: 8200,  from: "RM", name: "You", color: "#4f46e5", me: true, text: "Customer just called again. Third day waiting.", tag: "Customer about to walk" },
  { t: 10400, from: "NA", name: "Nicole · office", color: "#f59e0b", text: "also — did the Hayes install ever get invoiced?", tag: "$3,400 sitting uninvoiced" },
];

const TYPING_AT = 12300;   // typing dots that never resolve
const SEEN_AT = 14100;     // "Seen · no answer"
const HOLD_UNTIL = 16800;  // fade + restart
const LOOP = 17600;

export default function ProblemVisual() {
  const [now, setNow] = useState(0);
  const [reduced, setReduced] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setReduced(true); return; }
    const start = performance.now();
    const loop = (t: number) => {
      setNow((t - start) % LOOP);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // Reduced motion (or SSR): the full thread, static.
  const at = reduced ? LOOP : now;
  const fading = !reduced && at > HOLD_UNTIL;
  const visible = BEATS.filter(b => b.t <= at);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-glow)" }}>
      {/* chat chrome */}
      <div className="flex items-center gap-2.5 px-4 h-11" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--bg-input)" }}>
          <Hash className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight" style={{ color: "var(--text-primary)" }}>office</p>
          <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>9 members · the "system"</p>
        </div>
        <span className="ml-auto flex -space-x-1.5">
          {["#0891b2", "#10b981", "#4f46e5", "#f59e0b"].map(c => (
            <span key={c} className="w-5 h-5 rounded-full border-2" style={{ backgroundColor: c, borderColor: "var(--bg-surface-2)" }} />
          ))}
        </span>
      </div>

      {/* thread */}
      <div className="relative h-[340px] px-4 py-3 overflow-hidden transition-opacity duration-500" style={{ opacity: fading ? 0 : 1 }}>
        <div className="absolute inset-x-4 bottom-3 flex flex-col justify-end gap-2.5">
          {visible.map(b => (
            <div key={b.t} className={`site-build-in flex ${b.me ? "justify-end" : ""}`}>
              <div className={`flex items-end gap-2 max-w-[85%] ${b.me ? "flex-row-reverse" : ""}`}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: b.color }}>{b.from}</span>
                <div className={`min-w-0 ${b.me ? "text-right" : ""}`}>
                  <p className="text-[9px] mb-0.5 px-1" style={{ color: "var(--text-muted)" }}>{b.name}</p>
                  <div className={`inline-block px-3 py-2 text-[13px] leading-snug rounded-2xl ${b.me ? "rounded-br-sm" : "rounded-bl-sm"}`}
                    style={b.me
                      ? { backgroundColor: "#4f46e5", color: "#fff" }
                      : { backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}>
                    {b.text}
                  </div>
                  {b.tag && at >= b.t + 900 && (
                    <div className={`site-build-in mt-1 flex ${b.me ? "justify-end" : ""}`}>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold" style={{ backgroundColor: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5" }}>
                        <AlertTriangle className="w-2.5 h-2.5" /> {b.tag}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* the question nobody answers */}
          {at >= TYPING_AT && at < SEEN_AT && (
            <div className="site-build-in flex items-end gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: "#0891b2" }}>KB</span>
              <div className="inline-flex items-center gap-1 px-3 py-2.5 rounded-2xl rounded-bl-sm" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                {[0, 1, 2].map(i => <span key={i} className="site-blink w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--text-muted)", animationDelay: `${i * 0.18}s` }} />)}
              </div>
            </div>
          )}
          {at >= SEEN_AT && (
            <p className="site-build-in text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
              &ldquo;did the Hayes install ever get invoiced?&rdquo; · Seen — no answer
            </p>
          )}
        </div>
      </div>

      {/* composer + punchline */}
      <div className="px-4 pb-3.5">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
          <span className="text-[12px] flex-1" style={{ color: "var(--text-muted)" }}>Message #office…</span>
          <Send className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        </div>
        <p className="mt-2.5 text-xs text-center" style={{ color: "var(--text-muted)" }}>
          Nine tools — and the business still runs on a group chat.
        </p>
      </div>
    </div>
  );
}
