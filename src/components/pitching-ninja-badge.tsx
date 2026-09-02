import Image from "next/image";

export function PitchingNinjaBadge() {
  return (
    <a
      href="https://www.instagram.com/pitchingninja"
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-14 w-28 items-center overflow-hidden bg-black transition-opacity duration-150 hover:opacity-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      aria-label="Pitching Ninja on Instagram"
    >
      <Image
        src="/images/pitching-ninja-desktop.png"
        alt=""
        width={1536}
        height={1024}
        unoptimized
        className="h-full w-full object-contain"
      />
    </a>
  );
}
