import Image from "next/image";

type Props = {
  className?: string;
  priority?: boolean;
};

export default function Logo({
  className = "",
  priority = false,
}: Props) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-flex shrink-0 items-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Image
        src="/logo-horizontal.png"
        alt="SalahNearMe"
        width={440}
        height={120}
        priority={priority}
        sizes="(max-width: 640px) 170px, 220px"
        className="block h-auto w-[170px] object-contain sm:w-[220px]"
      />
    </span>
  );
}