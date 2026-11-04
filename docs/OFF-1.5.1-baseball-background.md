# OFF-1.5.1: original baseball background

## Source, not approximation

Recovered from `src/app/page.tsx` at June 30 commit [73bc18398917c6d9fc64d04f5065f3635b8b6860](https://github.com/mrhemsing/starter/commit/73bc18398917c6d9fc64d04f5065f3635b8b6860). The treatment was introduced by [c3278dc7e1240e369f329c3e5708d2e5a6495806](https://github.com/mrhemsing/starter/commit/c3278dc7e1240e369f329c3e5708d2e5a6495806). July 31 later replaced it with responsive wide assets; those are not the Jun 30 reference.

HomeBaseballBackground contains the June 30 background markup verbatim, modulo line endings. The original `public/images/header-baseball-bg.jpg` has the same SHA256 as the historical asset. The square thumbnail and its layout reservation are removed.

Recovered values:

- Mobile: 520px layer height (440px from sm), opacity 0.44, saturation 0.92, background position `right -54px top 82px`, size `clamp(360px, 108vw, 520px) auto`.
- Desktop from lg: 380px layer height, opacity 1, saturation 0.92, position `76% 74%`, size `min(720px, 115vw) auto`.
- Both use the original two black gradients with unchanged stops/alphas, normal blending, no-repeat, clipped section, and relative z-10 content above the layers.

The low apparent opacity comes from those gradients, not a new guessed 10-20% opacity. The only structural adaptation is placing the shared background behind the offseason nav/status/intro section. Below-header archive content retains its prior width and data.

## Position interpretation and owner reference

The supplied Jun 30 screenshot matches the historical mobile placement: the ball begins below the logo and extends through the right edge. It does not begin beyond the top viewport edge. Likewise the historical desktop background extends above its layer but not past the right viewport edge at 1440. The source-recovery and visual-reference requirements are honored exactly; a literal "past both edges at both widths" assertion would contradict the recovered source and supplied reference. We report that distinction rather than fabricate a pass or substitute new offsets.

## Machine checks

- `check-baseball-background.mjs` compares the complete recovered block with git and hashes the original asset. Negative assertion for the removed thumbnail.
- `verify-baseball-background-dom.mjs` verifies computed responsive sizing, anchoring, opacity, saturation, blend, asset URL, z-10 stacking, and nav/heading hit targets.
- Contrast is WCAG relative luminance against the actual composited background pixels over every text-run rectangle. A measurement-only screenshot hides the foreground without changing layout. Foreground CSS colors are converted by the browser canvas, including modern oklab colors and ancestor opacity. The minimum contrast across each rectangle must be at least 4.5:1 for normal text or 3:1 for large text. Navigation labels are included. Decorative control borders are not represented as text contrast.
- Delivered screenshots use the unmodified production DOM. Side-by-side HTML places the owner's unmodified Jun 30 screenshot alongside each production capture; reference phone-gallery chrome is retained and labeled.
- OFF-1.5's thumbnail/no-overlap assertion is explicitly superseded. Its cover/frame/frozen-content checks remain active. Static caching and frozen JSON are unchanged.
