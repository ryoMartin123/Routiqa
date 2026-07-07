"use client";

// ─── Welcome launcher ─────────────────────────────────────
// The premium entry screen. An Apple-"Hello"-style greeting eases in, then the
// prompt and app cards rise in a gentle stagger. Cards are filtered to the
// acting user's app access — every user sees My Portal; the rest appear only
// when granted. Selecting a card enters that app.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { appAccessForUser } from "@/lib/platform/access";
import { PLATFORM_APPS } from "@/lib/platform/apps";

// Per-letter cadence for the greeting; the prompt and cards follow on from it.
const LETTER_STEP = 0.045;

export default function WelcomeLauncher() {
  const { actingUser } = usePermissionContext();
  const access = appAccessForUser(actingUser);
  const apps = PLATFORM_APPS.filter((a) => access[a.id]);
  const firstName = actingUser.fullName.split(/\s+/)[0];

  // Greeting animates one letter at a time; everything after it is timed to land
  // once the name has finished resolving.
  const greeting = `Welcome, ${firstName}.`;
  const promptDelay = greeting.length * LETTER_STEP + 0.35;
  const cardBase = promptDelay + 0.35;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-16"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(35,156,141,0.18), transparent 60%), var(--bg-page)",
      }}
    >
      <div className="w-full max-w-4xl">
        {/* Greeting */}
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
            aria-label={greeting}
          >
            {greeting.split("").map((ch, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="platform-letter"
                style={{ animationDelay: `${i * LETTER_STEP}s` }}
              >
                {ch === " " ? " " : ch}
              </span>
            ))}
          </h1>
          <p
            className="platform-fade text-lg sm:text-xl mt-4"
            style={{ color: "var(--text-muted)", animationDelay: `${promptDelay}s` }}
          >
            Where would you like to work today?
          </p>
        </div>

        {/* App cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app, i) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.id}
                href={app.href}
                className="platform-rise group rounded-2xl p-5 flex flex-col transition-all duration-200 hover:-translate-y-1"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  animationDelay: `${1.2 + i * 0.08}s`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = app.accent + "88";
                  e.currentTarget.style.boxShadow = `0 16px 40px ${app.accent}22`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: app.accent + "22" }}
                  >
                    <Icon className="w-6 h-6" style={{ color: app.accent }} />
                  </span>
                  <ArrowRight
                    className="w-5 h-5 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                    style={{ color: app.accent }}
                  />
                </div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  {app.name}
                </h2>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {app.description}
                </p>
              </Link>
            );
          })}
        </div>

        {apps.length === 1 && (
          <p className="platform-rise text-center text-sm mt-8" style={{ color: "var(--text-muted)", animationDelay: "1.4s" }}>
            You have access to My Portal. Need another app? Ask an administrator.
          </p>
        )}
      </div>
    </div>
  );
}
