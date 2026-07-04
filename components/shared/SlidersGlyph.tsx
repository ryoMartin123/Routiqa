// A sliders icon whose KNOBS slide along their tracks (rather than the whole icon
// rotating). Animates on hover of the nearest `.group` ancestor, and stays in the
// "moved" position while `active` (e.g. the menu/popover is open). currentColor.

export default function SlidersGlyph({ active = false, className = "w-3.5 h-3.5" }: { active?: boolean; className?: string }) {
  const knob = "absolute top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full transition-[left] duration-300 ease-out";
  return (
    <span className={`relative flex flex-col justify-center gap-1 ${className}`}>
      {/* top track — knob rests left, slides right */}
      <span className="relative h-[5px]">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1.5px] rounded-full" style={{ backgroundColor: "currentColor", opacity: 0.4 }} />
        <span className={`${knob} ${active ? "left-[60%]" : "left-[6%] group-hover:left-[60%]"}`} style={{ backgroundColor: "currentColor" }} />
      </span>
      {/* bottom track — knob rests right, slides left */}
      <span className="relative h-[5px]">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1.5px] rounded-full" style={{ backgroundColor: "currentColor", opacity: 0.4 }} />
        <span className={`${knob} ${active ? "left-[6%]" : "left-[60%] group-hover:left-[6%]"}`} style={{ backgroundColor: "currentColor" }} />
      </span>
    </span>
  );
}
