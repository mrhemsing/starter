// Recovered verbatim from 73bc18398917c6d9fc64d04f5065f3635b8b6860, src/app/page.tsx.
export function HomeBaseballBackground() {
  return <>
        <div className="absolute inset-0 bg-[#08080a]" />
        <div
          className="absolute inset-x-0 top-0 h-[520px] bg-no-repeat opacity-[0.44] saturate-[0.92] sm:h-[440px] lg:hidden"
          style={{
            backgroundImage: "url('/images/header-baseball-bg.jpg')",
            backgroundPosition: "right -54px top 82px",
            backgroundSize: "clamp(360px, 108vw, 520px) auto",
          }}
          aria-hidden="true"
          data-responsive-check="home-header-background-mobile"
        />
        <div
          className="absolute inset-x-0 top-0 hidden h-[380px] bg-no-repeat opacity-100 saturate-[0.92] lg:block"
          style={{
            backgroundImage: "url('/images/header-baseball-bg.jpg')",
            backgroundPosition: "76% 74%",
            backgroundSize: "min(720px, 115vw) auto",
          }}
          aria-hidden="true"
          data-responsive-check="home-header-background"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,10,0.98)_0%,rgba(8,8,10,0.82)_42%,rgba(8,8,10,0.42)_74%,rgba(8,8,10,0.58)_100%),linear-gradient(180deg,rgba(8,8,10,0.78)_0%,rgba(8,8,10,0.26)_44%,#08080a_100%)]" aria-hidden="true" />
  </>;
}
