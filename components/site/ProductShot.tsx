// ─── Framed real screenshots ──────────────────────────────
// The site's product visuals: actual app captures inside the shared browser /
// phone chrome. Server components — no client JS beyond next/image.

import Image from "next/image";
import { BrowserFrame, PhoneFrame } from "@/components/site/ui";
import { SHOTS, type ShotKey } from "@/components/site/screenshots";

export function BrowserShot({
  shot, priority = false, sizes = "(min-width: 1024px) 44rem, 100vw", className = "",
}: { shot: ShotKey; priority?: boolean; sizes?: string; className?: string }) {
  const s = SHOTS[shot];
  return (
    <BrowserFrame url={s.route} className={`site-lift ${className}`}>
      <Image src={s.src} alt={s.alt} width={s.width} height={s.height}
        sizes={sizes} priority={priority} className="w-full h-auto block" />
    </BrowserFrame>
  );
}

export function PhoneShot({
  shot, priority = false, width = 270, className = "",
}: { shot: ShotKey; priority?: boolean; width?: number; className?: string }) {
  const s = SHOTS[shot];
  return (
    <PhoneFrame className={`site-lift ${className}`}>
      <Image src={s.src} alt={s.alt} width={s.width} height={s.height}
        sizes={`${width}px`} priority={priority} style={{ width, height: "auto" }} className="block" />
    </PhoneFrame>
  );
}
