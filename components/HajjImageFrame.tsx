import Image from "next/image";

type Props = { src: string; alt: string; priority?: boolean };

function isSafeSource(value: string): boolean {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

export default function HajjImageFrame({
  src,
  alt,
  priority = false,
}: Props) {
  const cleanSrc = src.trim();
  const cleanAlt = alt.trim() || "Pilgrimage guide illustration";

  if (!cleanSrc || !isSafeSource(cleanSrc)) {
    return (
      <div className="grid aspect-video place-items-center rounded-[2rem] border border-yellow-500/20 bg-black/50 p-6 text-sm text-white/45">
        Guide image unavailable.
      </div>
    );
  }

  return (
    <figure className="relative overflow-hidden rounded-[2rem] border border-yellow-500/30 bg-black p-3 shadow-[0_0_35px_rgba(212,175,55,0.18)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-2 z-10 rounded-[1.7rem] border border-yellow-400/40" />
      <div aria-hidden="true" className="pointer-events-none absolute left-5 top-5 z-10 size-10 border-l-2 border-t-2 border-yellow-400" />
      <div aria-hidden="true" className="pointer-events-none absolute right-5 top-5 z-10 size-10 border-r-2 border-t-2 border-yellow-400" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-5 left-5 z-10 size-10 border-b-2 border-l-2 border-yellow-400" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-5 right-5 z-10 size-10 border-b-2 border-r-2 border-yellow-400" />

      <Image
        src={cleanSrc}
        alt={cleanAlt}
        width={1200}
        height={675}
        priority={priority}
        sizes="(min-width: 1280px) 1100px, (min-width: 768px) 90vw, 100vw"
        className="relative h-auto w-full rounded-[1.35rem] object-cover"
      />
    </figure>
  );
}