import type React from "react";

type PageContextStripProps = {
  primary?: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  className?: string;
  primaryClassName?: string;
  metaClassName?: string;
  "data-responsive-check"?: string;
};

export function PageContextStrip({
  primary,
  meta,
  leading,
  className = "",
  primaryClassName = "",
  metaClassName = "",
  "data-responsive-check": responsiveCheck,
}: PageContextStripProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${className}`}
      data-responsive-check={responsiveCheck}
    >
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        {primary ? (
          <span className={`min-w-0 text-zinc-100 ${primaryClassName}`} data-context-primary>
            {primary}
          </span>
        ) : null}
      </div>
      {meta ? (
        <span className={`shrink-0 text-zinc-400 ${metaClassName}`} data-context-meta>
          {meta}
        </span>
      ) : null}
    </div>
  );
}
