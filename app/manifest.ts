import type { MetadataRoute } from "next";

// ─── PWA manifest (Routiqa) ───────────────────────────────
// Makes the field experience installable. The mobile shell lives at /mobile, so
// the installed app launches straight into the technician's Today screen.
// Icons are SVG placeholders for now — swap in 192/512 PNG (maskable) for stores.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Routiqa",
    short_name: "Routiqa",
    description: "Routiqa field app — your jobs, route, and updates from the field.",
    start_url: "/mobile/today",
    scope: "/mobile",
    display: "standalone",
    orientation: "portrait",
    background_color: "#171717",
    theme_color: "#0f8578",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
