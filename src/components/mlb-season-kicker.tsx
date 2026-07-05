export function MlbSeasonKicker({ season }: { season?: string }) {
  return (
    <p className="site-logo-season-kicker">
      <span>{season ? `${season} ` : ""}</span>
      <span className="site-logo-mlb-lockup">
        <MlbLogoMark />
        <span>MLB</span>
      </span>
      <span> Season</span>
    </p>
  );
}

function MlbLogoMark() {
  return (
    <svg className="site-logo-mlb-mark" viewBox="0 0 36 24" aria-hidden="true" focusable="false">
      <rect width="36" height="24" rx="3" fill="#0B3B75" />
      <path d="M18 0h15a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H18z" fill="#C8102E" />
      <path
        d="M18.4 5.2c2.8 0 5.1 1.5 5.1 3.4 0 1.2-.9 2.3-2.2 2.9l1.7 5.1h-2.8l-1.3-4.3h-2.5l-.8 4.3h-2.7l1.1-6.2c-1-.6-1.6-1.4-1.6-2.5 0-1.5 1.2-2.7 3.1-3.2l-.4 2.3c-.3.2-.5.5-.5.9 0 .9 1 1.5 2.4 1.5 1.8 0 3.3-.8 3.3-1.9 0-.7-.6-1.2-1.6-1.5z"
        fill="#F8FAFC"
      />
      <circle cx="26.8" cy="8.5" r="1.35" fill="#F8FAFC" />
    </svg>
  );
}
