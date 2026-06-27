import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  priority?: boolean;
};

export default function HajjImageFrame({ src, alt, priority = false }: Props) {
  return (
    <div className="relative rounded-[2rem] border border-yellow-500/30 bg-black p-3 shadow-[0_0_35px_rgba(212,175,55,0.18)]">
      <div className="pointer-events-none absolute inset-2 rounded-[1.7rem] border border-yellow-400/40" />
      <div className="pointer-events-none absolute left-5 top-5 h-10 w-10 border-l-2 border-t-2 border-yellow-400" />
      <div className="pointer-events-none absolute right-5 top-5 h-10 w-10 border-r-2 border-t-2 border-yellow-400" />
      <div className="pointer-events-none absolute bottom-5 left-5 h-10 w-10 border-b-2 border-l-2 border-yellow-400" />
      <div className="pointer-events-none absolute bottom-5 right-5 h-10 w-10 border-b-2 border-r-2 border-yellow-400" />

      <Image
        src={src}
        alt={alt}
        width={1200}
        height={675}
        priority={priority}
        className="relative h-auto w-full rounded-[1.35rem]"
      />
    </div>
  );
}

