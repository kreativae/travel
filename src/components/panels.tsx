"use client";

import { fmtDayMonth, monthOfISO, MONTH_SHORT_PT } from "@/lib/dates";
import { brl, fmtDateTimePt, pct } from "@/lib/format";
import type { OfferWithDelta, PulsePoint } from "@/lib/providers/types";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DeltaBadge, Sigla } from "./primitives";

const tooltipStyle = {
  backgroundColor: "#0f141b",
  border: "1px solid #1c232d",
  borderRadius: 12,
  fontFamily: "IBM Plex Mono, monospace",
  fontSize: 12,
  color: "#e9eef4",
};

const moneyFormatter = ((value: unknown, name: unknown) => [
  brl(Number(value ?? 0)),
  name === "min" ? "menor tarifa (light)" : name === "bag" ? "menor com bagagem" : "média top-10",
]) as never;

const singleMoneyFormatter = ((value: unknown) => [brl(Number(value ?? 0)), "tarifa"]) as never;

/** Pulso de preço entre varreduras: mínimo geral × mínimo com bagagem × média top-10. */
export function PulseChart({ pulse, bag }: { pulse: PulsePoint[]; bag: string }) {
  const data = pulse.map((p) => ({
    name: `#${p.scanId}`,
    min: p.minPrice,
    bag: p.minBagPrice,
    avg: Math.round(p.avgTop10),
    at: p.at,
  }));
  if (!data.length) return null;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="gMint" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ddc97" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3ddc97" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gSkyl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#62c8f8" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#62c8f8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1c232d" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#8b98a7", fontSize: 10, fontFamily: "IBM Plex Mono" }}
            axisLine={{ stroke: "#1c232d" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#5b6673", fontSize: 10, fontFamily: "IBM Plex Mono" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
            domain={["dataMin - 250", "dataMax + 250"]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(_l, payload) => {
              const p = payload?.[0]?.payload as { at?: string } | undefined;
              return p?.at ? `varredura de ${fmtDateTimePt(new Date(p.at))}` : "";
            }}
            formatter={moneyFormatter}
          />
          <Area type="monotone" dataKey="avg" name="avg" stroke="#f5b14f" strokeOpacity={0.55} strokeWidth={1.4} fill="transparent" strokeDasharray="4 5" />
          {bag !== "without" && (
            <Area type="monotone" dataKey="bag" name="bag" stroke="#62c8f8" strokeWidth={1.8} fill="url(#gSkyl)" />
          )}
          {bag !== "with" && (
            <Area type="monotone" dataKey="min" name="min" stroke="#3ddc97" strokeWidth={2} fill="url(#gMint)" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Grade mês × duração com menor tarifa da combinação (escala de cor). */
export function Heatmap({
  offers,
  onPick,
  activeMonth,
  activeDays,
}: {
  offers: OfferWithDelta[];
  onPick: (month: number, days: number) => void;
  activeMonth: number | null;
  activeDays: number | null;
}) {
  const months = [4, 5, 6, 7, 8];
  const daysArr = [15, 16, 17, 18, 19, 20];
  const cell = new Map<string, { min: number; code: string; dep: string }>();
  for (const o of offers) {
    const m = monthOfISO(o.departDate);
    if (!months.includes(m)) continue;
    const key = `${m}|${o.tripDays}`;
    const cur = cell.get(key);
    if (!cur || o.price < cur.min) cell.set(key, { min: o.price, code: o.airlineCode, dep: o.departDate });
  }
  const values = [...cell.values()].map((c) => c.min);
  if (!values.length) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const color = (v: number) => {
    const t = hi === lo ? 0 : (v - lo) / (hi - lo); // 0 barato → 1 caro
    if (t < 0.33) {
      const k = t / 0.33;
      return `rgba(61,220,151,${0.32 - k * 0.18})`;
    }
    if (t < 0.66) {
      return "rgba(245,177,79,0.16)";
    }
    return `rgba(251,94,126,${0.1 + (t - 0.66) * 0.4})`;
  };
  return (
    <div className="overflow-x-auto thin-scroll">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[64px_repeat(6,1fr)] gap-1.5">
          <div />
          {daysArr.map((d) => (
            <div key={d} className="pb-1 text-center font-mono text-[10px] uppercase tracking-wider text-faint">
              {d} dias
            </div>
          ))}
          {months.map((m) => (
            <>
              <div key={`label-${m}`} className="flex items-center font-mono text-[11px] uppercase tracking-wider text-mist">
                {MONTH_SHORT_PT[m]} 27
              </div>
              {daysArr.map((d) => {
                const c = cell.get(`${m}|${d}`);
                if (!c) return <div key={`${m}-${d}`} className="h-14 rounded-lg border border-line/50 bg-panel/40" />;
                const active = activeMonth === m && activeDays === d;
                return (
                  <button
                    key={`${m}-${d}`}
                    onClick={() => onPick(m, d)}
                    title={`menor tarifa de ${MONTH_SHORT_PT[m]} com ${d} dias · partida ${fmtDayMonth(c.dep)} · ${c.code}`}
                    className={`h-14 rounded-lg border px-2 py-1 text-left transition-transform hover:scale-[1.04] ${
                      active ? "border-lime/60 ring-1 ring-lime/40" : "border-line"
                    }`}
                    style={{ backgroundColor: color(c.min) }}
                  >
                    <div className="font-mono text-[13px] font-semibold leading-tight text-snow">
                      {brl(c.min)}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-wide text-mist">
                      {fmtDayMonth(c.dep)} · {c.code}
                    </div>
                  </button>
                );
              })}
            </>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-faint">
          <span className="h-2 w-2 rounded-sm" style={{ background: "rgba(61,220,151,0.5)" }} /> mais barato
          <span className="h-2 w-2 rounded-sm" style={{ background: "rgba(245,177,79,0.5)" }} /> intermediário
          <span className="h-2 w-2 rounded-sm" style={{ background: "rgba(251,94,126,0.5)" }} /> mais caro
          <span className="ml-auto">clique numa célula para filtrar</span>
        </div>
      </div>
    </div>
  );
}

/** Maiores quedas e altas desde a varredura anterior. */
export function TopMovers({
  offers,
  onSelect,
}: {
  offers: OfferWithDelta[];
  onSelect: (o: OfferWithDelta) => void;
}) {
  const withDelta = offers.filter((o) => o.deltaPct !== null && !o.isNew);
  const drops = [...withDelta].filter((o) => (o.deltaPct ?? 0) < -0.15).sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0)).slice(0, 5);
  const rises = [...withDelta].filter((o) => (o.deltaPct ?? 0) > 0.15).sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0)).slice(0, 3);
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-mint">maiores quedas</div>
        <div className="space-y-1">
          {drops.length === 0 && <div className="text-xs text-faint">sem quedas relevantes nesta varredura</div>}
          {drops.map((o) => (
            <button
              key={o.id}
              onClick={() => onSelect(o)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-line hover:bg-panel2"
            >
              <Sigla code={o.airlineCode} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-snow">
                  {fmtDayMonth(o.departDate)} → {fmtDayMonth(o.returnDate)}
                  {!o.baggageIncluded && <span className="text-faint"> · light</span>}
                </div>
                <div className="font-mono text-[10px] text-mist">{brl(o.price)}</div>
              </div>
              <DeltaBadge deltaPct={o.deltaPct} size="sm" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-flare">maiores altas</div>
        <div className="space-y-1">
          {rises.length === 0 && <div className="text-xs text-faint">sem altas relevantes nesta varredura</div>}
          {rises.map((o) => (
            <button
              key={o.id}
              onClick={() => onSelect(o)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-line hover:bg-panel2"
            >
              <Sigla code={o.airlineCode} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-snow">
                  {fmtDayMonth(o.departDate)} → {fmtDayMonth(o.returnDate)}
                  {!o.baggageIncluded && <span className="text-faint"> · light</span>}
                </div>
                <div className="font-mono text-[10px] text-mist">{brl(o.price)}</div>
              </div>
              <DeltaBadge deltaPct={o.deltaPct} size="sm" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Gráfico de linha do histórico de uma combinação (drawer). */
export function RouteHistoryChart({
  points,
}: {
  points: { scanId: number; at: string; price: number; deltaPct: number | null }[];
}) {
  const data = points.map((p) => ({
    name: `#${p.scanId}`,
    price: p.price,
    at: p.at,
    deltaPct: p.deltaPct,
  }));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#1c232d" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#8b98a7", fontSize: 10, fontFamily: "IBM Plex Mono" }}
            axisLine={{ stroke: "#1c232d" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#5b6673", fontSize: 10, fontFamily: "IBM Plex Mono" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
            domain={["dataMin - 120", "dataMax + 120"]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(_l, payload) => {
              const p = payload?.[0]?.payload as { at?: string; deltaPct?: number | null } | undefined;
              if (!p?.at) return "";
              return `varredura de ${fmtDateTimePt(new Date(p.at))}${p.deltaPct != null ? ` · ${pct(p.deltaPct)}` : ""}`;
            }}
            formatter={singleMoneyFormatter}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#c9f24f"
            strokeWidth={2.2}
            dot={{ r: 3.5, fill: "#c9f24f", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#c9f24f" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
