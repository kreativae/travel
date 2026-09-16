"use client";

import { brl, pct } from "@/lib/format";
import { Radar, TrendingDown, TrendingUp, Minus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Anima um número até o valor alvo (count-up suave). */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(from + (target - from) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const v = useCountUp(value);
  return <span className={className}>{brl(Math.round(v))}</span>;
}

/** Badge de variação: queda (verde, bom) / alta (rosa) / estável / NOVO. */
export function DeltaBadge({
  deltaPct,
  isNew,
  size = "md",
}: {
  deltaPct: number | null;
  isNew?: boolean;
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center gap-1 rounded-md border font-mono font-medium tabular-nums " +
    (size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs");
  if (isNew) {
    return (
      <span className={`${base} border-skyl/30 bg-skyl/10 text-skyl`}>
        <Sparkles size={size === "sm" ? 10 : 12} strokeWidth={2.5} /> NOVO
      </span>
    );
  }
  if (deltaPct === null) {
    return <span className={`${base} border-line bg-panel2 text-faint`}>—</span>;
  }
  if (Math.abs(deltaPct) < 0.15) {
    return (
      <span className={`${base} border-line bg-panel2 text-mist`}>
        <Minus size={size === "sm" ? 10 : 12} strokeWidth={2.5} /> estável
      </span>
    );
  }
  if (deltaPct < 0) {
    return (
      <span className={`${base} border-mint/30 bg-mint/10 text-mint`}>
        <TrendingDown size={size === "sm" ? 10 : 12} strokeWidth={2.5} /> {pct(deltaPct)}
      </span>
    );
  }
  return (
    <span className={`${base} border-flare/30 bg-flare/10 text-flare`}>
      <TrendingUp size={size === "sm" ? 10 : 12} strokeWidth={2.5} /> {pct(deltaPct)}
    </span>
  );
}

export function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
        active
          ? "border-lime/50 bg-lime/15 text-lime"
          : "border-line bg-panel2 text-mist hover:border-mist/40 hover:text-snow"
      }`}
    >
      {children}
    </button>
  );
}

export function ScanButton({
  scanning,
  onClick,
  small = false,
}: {
  scanning: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={scanning}
      className={`group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl border border-lime/40 bg-lime/10 font-semibold text-lime transition-all hover:bg-lime/20 hover:shadow-[0_0_28px_rgba(201,242,79,0.25)] disabled:cursor-wait ${
        small ? "px-3.5 py-2 text-xs" : "px-5 py-3 text-sm"
      }`}
    >
      {scanning ? (
        <span className="relative grid h-4 w-4 place-items-center">
          <span className="radar-sweep absolute inset-0 rounded-full" />
          <span className="absolute inset-0 rounded-full border border-lime/40" />
        </span>
      ) : (
        <Radar size={small ? 14 : 16} strokeWidth={2.2} className="transition-transform duration-300 group-hover:rotate-90" />
      )}
      {scanning ? "VARRENDO…" : "NOVA VARREDURA"}
    </button>
  );
}

const PROVIDER_META: Record<string, { label: string; tip: string; real: boolean }> = {
  travelpayouts: {
    label: "TRAVELPAYOUTS · TARIFAS REAIS (CACHE 48h)",
    tip: "Preços reais encontrados por usuários Aviasales nas últimas ~48h — cache, não cotação reservável.",
    real: true,
  },
  amadeus: {
    label: "AMADEUS ENTERPRISE · TEMPO REAL",
    tip: "Tarifas reais de disponibilidade via Amadeus Enterprise API.",
    real: true,
  },
  market: {
    label: "MERCADO CALIBRADO · KAYAK/DECOLAR/SKYSCANNER",
    tip: "Motor calibrado com dados públicos reais da rota. Configure TRAVELPAYOUTS_TOKEN (grátis) para tarifas reais cacheadas.",
    real: false,
  },
};

export function ProviderChip({ provider, note }: { provider: string; note?: string | null }) {
  const meta = PROVIDER_META[provider] ?? PROVIDER_META.market;
  return (
    <div
      title={note ?? meta.tip}
      className={`inline-flex cursor-help items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-wider ${
        meta.real
          ? "border-mint/40 bg-mint/10 text-mint"
          : "border-amber/40 bg-amber/10 text-amber"
      }`}
    >
      <span className={`blink h-1.5 w-1.5 rounded-full ${meta.real ? "bg-mint" : "bg-amber"}`} />
      {meta.label}
    </div>
  );
}

export function Sigla({ code }: { code: string }) {
  const tones: Record<string, string> = {
    LA: "bg-[#d22630]/15 text-[#ff7b84] border-[#d22630]/30",
    BA: "bg-[#075aaa]/15 text-[#7db3f2] border-[#075aaa]/40",
    TP: "bg-[#00665a]/15 text-[#4fd1b5] border-[#00665a]/40",
    UX: "bg-[#0039a6]/15 text-[#7aa5f5] border-[#0039a6]/40",
    AZ: "bg-[#00674e]/15 text-[#5dd6ae] border-[#00674e]/40",
    IB: "bg-[#d71920]/15 text-[#ff8b90] border-[#d71920]/30",
    AF: "bg-[#002157]/20 text-[#8db3ff] border-[#002157]/50",
    KL: "bg-[#00a1de]/15 text-[#71dcf9] border-[#00a1de]/30",
    LH: "bg-[#f9b000]/15 text-[#ffd47a] border-[#f9b000]/30",
    LX: "bg-[#d42a1e]/15 text-[#ff9a92] border-[#d42a1e]/30",
    ET: "bg-[#0b7a3b]/15 text-[#6fe3a1] border-[#0b7a3b]/40",
    AT: "bg-[#c1272d]/15 text-[#ff9d9d] border-[#c1272d]/30",
    TK: "bg-[#e81932]/15 text-[#ff8496] border-[#e81932]/30",
    UA: "bg-[#005daa]/15 text-[#86c3ff] border-[#005daa]/40",
    AC: "bg-[#d82f2e]/15 text-[#ff9e9d] border-[#d82f2e]/30",
  };
  return (
    <span
      className={`inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-[10px] font-bold ${
        tones[code] ?? "border-line bg-panel2 text-mist"
      }`}
    >
      {code}
    </span>
  );
}

export function Kpi({
  label,
  children,
  sub,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "lime" | "mint" | "skyl" | "amber";
}) {
  const ring =
    accent === "mint"
      ? "hover:border-mint/40"
      : accent === "skyl"
        ? "hover:border-skyl/40"
        : accent === "amber"
          ? "hover:border-amber/40"
          : "hover:border-lime/40";
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur transition-colors ${ring}`}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-1.5 font-mono text-[clamp(1.35rem,2.6vw,1.9rem)] font-semibold leading-none text-snow">
        {children}
      </div>
      {sub && <div className="mt-2 text-xs text-mist">{sub}</div>}
    </div>
  );
}
