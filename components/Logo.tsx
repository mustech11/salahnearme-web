type Props = {
  className?: string;
};

export default function Logo({ className = "" }: Props) {
  return (
    <div
      className={`inline-flex shrink-0 items-center ${className}`}
      aria-label="SalahNearMe"
    >
      <img
        src="/logo-horizontal.png"
        alt="SalahNearMe"
        className="block h-auto w-[170px] object-contain sm:w-[220px]"
      />
    </div>
  );
}

