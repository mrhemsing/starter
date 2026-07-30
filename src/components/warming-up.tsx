"use client";

import { useEffect, useRef, type CSSProperties } from "react";

export type WarmingUpSlateState = "pre" | "live" | "post";

const STATUS_COPY: Record<WarmingUpSlateState, readonly string[]> = {
  pre: ["Reading tonight's probables", "Checking recent form", "Adjusting for park and opponent", "Setting the board"],
  live: ["Tracking live starts", "Scoring in progress", "Updating the board"],
  post: ["Scoring the latest starts", "Adjusting for park and opponent", "Setting the board"],
};

const PITCHES = [
  { path: "M 96 108 C 380 98, 700 96, 886 96", duration: 490, velocity: 95.8, name: "FOUR-SEAM", cell: 1 },
  { path: "M 96 108 C 400 96, 720 110, 906 158", duration: 640, velocity: 86.4, name: "SLIDER", cell: 8 },
  { path: "M 96 108 C 360 52, 700 78, 886 156", duration: 800, velocity: 78.9, name: "CURVEBALL", cell: 7 },
  { path: "M 96 108 C 390 102, 710 122, 866 160", duration: 680, velocity: 85.6, name: "CHANGEUP", cell: 6 },
] as const;

type WarmingUpProps =
  | { variant: "full"; slateState: WarmingUpSlateState; statusLines?: never }
  | { variant: "compact"; slateState?: never; statusLines?: readonly string[] };

const DEFAULT_COMPACT_STATUS = ["Setting the board", "Pulling the latest data"] as const;

export function WarmingUp({ variant, slateState, statusLines }: WarmingUpProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const statuses = variant === "full"
    ? STATUS_COPY[slateState] ?? STATUS_COPY.post
    : statusLines?.length ? statusLines : DEFAULT_COMPACT_STATUS;
  const statusesRef = useRef(statuses);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || root.dataset.warmingBooted === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("warming-hydrated");
    const statuses = statusesRef.current;
    const trail = root.querySelector<SVGPathElement>("[data-warming-trail]");
    const ball = root.querySelector<SVGGElement>("[data-warming-ball]");
    const spin = root.querySelector<SVGGElement>("[data-warming-spin]");
    const pop = root.querySelector<SVGCircleElement>("[data-warming-pop]");
    const radar = root.querySelector<HTMLElement>("[data-warming-radar]");
    const pitchName = root.querySelector<HTMLElement>("[data-warming-pitch-name]");
    const pitchCount = root.querySelector<HTMLElement>("[data-warming-pitch-count]");
    const status = root.querySelector<HTMLElement>("[data-warming-status]");
    const cells = Array.from(root.querySelectorAll<SVGRectElement>("[data-zone-cell]"));
    if (!trail || !ball || !spin || !pop || !radar || !pitchName || !pitchCount || !status) return;

    let disposed = false;
    let pitchIndex = 0;
    let statusIndex = 0;
    let frameId = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const statusTimer = window.setInterval(() => {
      statusIndex = (statusIndex + 1) % statuses.length;
      status.textContent = statuses[statusIndex];
    }, 2600);
    const schedule = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!disposed) callback();
      }, delay);
      timers.add(timer);
    };

    const throwPitch = () => {
      const pitch = PITCHES[pitchIndex % PITCHES.length];
      pitchIndex += 1;
      trail.setAttribute("d", pitch.path);
      const length = trail.getTotalLength();
      trail.style.strokeDasharray = `${length}`;
      trail.style.strokeDashoffset = `${length}`;
      trail.style.opacity = "0.35";
      trail.style.transition = "none";
      pitchName.textContent = pitch.name;
      pitchCount.textContent = `PITCH ${pitchIndex}`;
      cells.forEach((cell) => cell.removeAttribute("data-hit"));
      ball.style.opacity = "1";
      const startedAt = performance.now();
      const startingVelocity = pitch.velocity - 12;

      const animate = (now: number) => {
        if (disposed) return;
        const progress = Math.min(1, (now - startedAt) / pitch.duration);
        const point = trail.getPointAtLength(length * progress);
        ball.setAttribute("transform", `translate(${point.x},${point.y})`);
        spin.setAttribute("transform", `rotate(${progress * 900})`);
        trail.style.strokeDashoffset = `${length * (1 - progress)}`;
        radar.textContent = (startingVelocity + (pitch.velocity - startingVelocity) * Math.min(1, progress * 1.6)).toFixed(1);
        if (progress < 1) {
          frameId = requestAnimationFrame(animate);
          return;
        }
        radar.textContent = pitch.velocity.toFixed(1);
        cells[pitch.cell]?.setAttribute("data-hit", "true");
        ball.style.opacity = "0";
        pop.setAttribute("cx", `${point.x}`);
        pop.setAttribute("cy", `${point.y}`);
        pop.animate([{ opacity: 0.8, r: 5 }, { opacity: 0, r: 22 }], { duration: 420, easing: "ease-out" });
        schedule(() => {
          trail.style.transition = "opacity 400ms linear";
          trail.style.opacity = "0";
          schedule(throwPitch, 450);
        }, 700);
      };
      frameId = requestAnimationFrame(animate);
    };

    throwPitch();
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearInterval(statusTimer);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return (
    <div ref={rootRef} className="text-zinc-300" data-warming-up={variant}>
      <span className="sr-only" role="status">Loading the board</span>
      {variant === "full" ? <h1 className="section-title font-serif text-[2.4rem] font-black leading-none text-zinc-50 sm:text-6xl">Warming up</h1> : null}
      <p className="mt-3 h-[18px] font-mono text-xs tracking-[0.12em] text-zinc-500" data-warming-status-line>
        <span data-warming-status>{statuses[0]}</span>
        <span className="warming-cursor ml-1 inline-block h-3 w-[7px] translate-y-px bg-warming-gold-dim" aria-hidden="true" />
      </p>
      <Tunnel variant={variant} />
      {variant === "full" ? (
        <section className="mt-8 grid gap-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <WarmingRow key={index} index={index} />)}
        </section>
      ) : null}
      <script dangerouslySetInnerHTML={{ __html: warmingBootstrapScript(statuses) }} />
    </div>
  );
}

function Tunnel({ variant }: { variant: "full" | "compact" }) {
  const compact = variant === "compact";
  return (
    <section className={`${compact ? "mt-5 px-3 pb-1 pt-3 sm:px-4" : "mt-8 px-4 pb-2 pt-4 sm:px-6"} overflow-hidden rounded-md border border-white/10 bg-[#101014]`} aria-hidden="true" data-warming-tunnel data-warming-tunnel-variant={variant}>
      <div className="flex items-end justify-between px-1">
        <div className="flex items-baseline gap-2">
          <span suppressHydrationWarning className={`warming-motion font-mono font-black tabular-nums text-amber-300 ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`} data-warming-radar>83.8</span>
          <span className="font-mono text-[10px] tracking-[0.22em] text-zinc-500">MPH</span>
        </div>
        <div className="text-right font-mono">
          <span suppressHydrationWarning className="warming-motion text-xs tracking-[0.28em] text-warming-ivory" data-warming-pitch-name>FOUR-SEAM</span>
          <span suppressHydrationWarning className="warming-motion mt-1 block text-[10px] tracking-[0.22em] text-zinc-500" data-warming-pitch-count>PITCH 1</span>
          <span className="warming-reduced-label text-[10px] tracking-[0.2em] text-zinc-500">LOADING THE BOARD</span>
        </div>
      </div>
      <svg className={`block w-full ${compact ? "h-[138px]" : "h-auto"}`} preserveAspectRatio={compact ? "xMidYMid meet" : undefined} viewBox="0 0 1000 230" aria-hidden="true">
        <line x1="20" y1="200" x2="980" y2="200" stroke="currentColor" className="text-white/10" />
        <path d="M 40 200 Q 95 168 150 200 Z" className="fill-white/[0.03]" />
        <rect x="84" y="176" width="24" height="4" rx="1" className="fill-zinc-600" />
        <circle cx="96" cy="108" r="2.5" className="fill-zinc-700" />
        <path d="M 902 196 L 926 196 L 926 202 L 914 208 L 902 202 Z" className="fill-zinc-600" />
        <g fill="none" stroke="currentColor" className="text-zinc-700">
          <rect x="856" y="84" width="60" height="90" />
          <path d="M876 84V174M896 84V174M856 114H916M856 144H916" />
        </g>
        <g>{Array.from({ length: 9 }, (_, cell) => <rect key={cell} className="zone-cell fill-transparent data-[hit=true]:fill-amber-300/30" data-zone-cell={cell} x={856 + (cell % 3) * 20} y={84 + Math.floor(cell / 3) * 30} width="20" height="30" />)}</g>
        <path data-warming-trail d="" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-300" />
        <circle data-warming-pop cx="886" cy="129" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-300 opacity-0" />
        <g data-warming-ball className="warming-motion warming-ball opacity-0">
          <g data-warming-spin>
            <circle r="7" className="fill-warming-ivory" />
            <path d="M -4.5 -5 Q 0 -1.5 -4.5 5M 4.5 -5 Q 0 -1.5 4.5 5" fill="none" stroke="currentColor" strokeWidth="1.1" className="text-warming-gold-dim" />
          </g>
        </g>
      </svg>
    </section>
  );
}

function warmingBootstrapScript(statuses: readonly string[]) {
  return `(()=>{const r=document.currentScript?.parentElement;if(!r||r.dataset.warmingBooted==="true"||matchMedia("(prefers-reduced-motion: reduce)").matches)return;r.dataset.warmingBooted="true";const q=s=>r.querySelector(s),t=q("[data-warming-trail]"),b=q("[data-warming-ball]"),s=q("[data-warming-spin]"),o=q("[data-warming-pop]"),v=q("[data-warming-radar]"),n=q("[data-warming-pitch-name]"),c=q("[data-warming-pitch-count]"),u=q("[data-warming-status]"),z=[...r.querySelectorAll("[data-zone-cell]")],p=${JSON.stringify(PITCHES)},a=${JSON.stringify(statuses)};if(!t||!b||!s||!o||!v||!n||!c||!u)return;let x=0,y=0,f=0,d=false;const timers=new Set,after=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!d)fn()},ms);timers.add(id)},statusTimer=setInterval(()=>{y=(y+1)%a.length;u.textContent=a[y]},2600),throwPitch=()=>{const e=p[x%p.length];x++;t.setAttribute("d",e.path);const l=t.getTotalLength();t.style.strokeDasharray=l;t.style.strokeDashoffset=l;t.style.opacity=".35";t.style.transition="none";n.textContent=e.name;c.textContent="PITCH "+x;z.forEach(e=>e.removeAttribute("data-hit"));b.style.opacity="1";const start=performance.now(),low=e.velocity-12,step=now=>{if(d)return;const k=Math.min(1,(now-start)/e.duration),pt=t.getPointAtLength(l*k);b.setAttribute("transform","translate("+pt.x+","+pt.y+")");s.setAttribute("transform","rotate("+(k*900)+")");t.style.strokeDashoffset=l*(1-k);v.textContent=(low+(e.velocity-low)*Math.min(1,k*1.6)).toFixed(1);if(k<1){f=requestAnimationFrame(step);return}v.textContent=e.velocity.toFixed(1);z[e.cell]?.setAttribute("data-hit","true");b.style.opacity="0";o.setAttribute("cx",pt.x);o.setAttribute("cy",pt.y);o.animate([{opacity:.8,r:5},{opacity:0,r:22}],{duration:420,easing:"ease-out"});after(()=>{t.style.transition="opacity 400ms linear";t.style.opacity="0";after(throwPitch,450)},700)};f=requestAnimationFrame(step)};throwPitch();const stop=()=>{if(d)return;d=true;cancelAnimationFrame(f);clearInterval(statusTimer);timers.forEach(clearTimeout);observer.disconnect()},observer=new MutationObserver(()=>{if(!r.isConnected)stop()});observer.observe(document.documentElement,{childList:true,subtree:true})})();`;
}

function WarmingRow({ index }: { index: number }) {
  const shimmer = "warming-shimmer rounded bg-white/[0.06]";
  return (
    <div className="grid min-h-[88px] grid-cols-[34px_54px_minmax(0,1fr)_64px] items-center gap-3 rounded-md border border-white/10 bg-[#101014] px-4 py-3 sm:grid-cols-[34px_64px_minmax(0,1fr)_90px_70px] sm:gap-4" style={{ "--warming-delay": `${index * 150}ms` } as CSSProperties}>
      <span className={`${shimmer} h-[34px]`} />
      <span className={`${shimmer} h-16`} />
      <span><span className={`${shimmer} block h-3`} /><span className={`${shimmer} mt-2 block h-3 w-4/5`} /></span>
      <span className={`${shimmer} h-7`} />
      <span className={`${shimmer} hidden h-11 sm:block`} />
    </div>
  );
}
