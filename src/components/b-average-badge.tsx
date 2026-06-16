type BAverageBadgeProps = {
  href?: string;
  children?: React.ReactNode;
};

export function BAverageBadge({
  href = "https://b-average.com",
  children = "B AVERAGE",
}: BAverageBadgeProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-block bg-black px-[6px] py-1 pr-[5px] font-sans text-[11px] font-semibold uppercase leading-none tracking-[2.16px] text-white no-underline transition-colors duration-150 hover:bg-white hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      aria-label="B Average"
      data-responsive-check="b-average-badge"
    >
      {children}
    </a>
  );
}
