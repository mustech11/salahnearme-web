import Image from "next/image";
import Link from "next/link";

type Props = {
  className?: string;
  href?: string;
  priority?: boolean;
};

export default function Logo({
  className = "",
  href = "/",
  priority = false,
}: Props) {
  const image = (
    <Image
      src="/logo-horizontal.png"
      alt="SalahNearMe"
      width={440}
      height={120}
      priority={priority}
      sizes="(min-width: 640px) 220px, 170px"
      className="block h-auto w-[170px] object-contain sm:w-[220px]"
    />
  );

  return href ? (
    <Link
      href={href}
      aria-label="SalahNearMe home"
      className={`inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${className}`}
    >
      {image}
    </Link>
  ) : (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      {image}
    </span>
  );
}