import type { ReactNode } from "react";

type MobileCardShellProps = {
  left: ReactNode;
  score: ReactNode;
  chips?: ReactNode;
  details?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function MobileCardShell({ left, score, chips, details, footer, className = "" }: MobileCardShellProps) {
  return (
    <div className={`grid gap-2 sm:hidden ${className}`} data-mobile-card-shell>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3" data-mobile-card-header>
        <div className="min-w-0">{left}</div>
        <div className="min-w-16 text-right" data-mobile-card-score>
          {score}
        </div>
      </div>
      {chips ? (
        <div className="flex min-w-0 flex-wrap gap-1.5" data-mobile-card-chips>
          {chips}
        </div>
      ) : null}
      {details ? (
        <div className="grid min-w-0 gap-1.5" data-mobile-card-details>
          {details}
        </div>
      ) : null}
      {footer ? <div data-mobile-card-footer>{footer}</div> : null}
    </div>
  );
}
