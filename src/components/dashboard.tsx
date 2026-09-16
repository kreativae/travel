"use client";

import { monthOfISO, MONTH_SHORT_PT } from "@/lib/dates";
import { brl, pct, timeAgoPt } from "@/lib/format";
import type { OfferWithDelta, PulsePoint, ScanSummary } from "@/lib/providers/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowDownUp,
  Backpack,
  CalendarRange,
  Filter,
  Gauge,
  Luggage,
  Radar,
  Route,
  Timer,
  TrendingDown,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DealsTable, { EmptyRow } from "./deals-table";
import OfferDrawer from "./drawer";
import { Heatmap, PulseChart, TopMovers } from "./panels";
import {
  AnimatedPrice,
  Chip,
  DeltaBadge,
  Kpi,
  ProviderChip,
  ScanButton,
  Sigla,
} from "./primitives";

interface DashboardResponse {
  empty: boolean;
  scans: ScanSummary[];
  latest: ScanSummary | null;
  offers: OfferWithDelta[];
  pulse: PulsePoint[];
  integrations: { travelpayouts: boolean };
}

type BagFilter = "all" | "with" | "without";
type StopsFilter = "all" | "direct" | "onestop";
type SortKey = "price" | "drop" | "duration";

const MONTH_LABELS: Record<number, string> = {
  4: "abril",
  5: "maio",
  6: "junho",
  7: "julho",
  8: "agosto",
};

/** Arco GRU → LON em SVG com avião animado. */
function RouteArc() {
  return (
    <svg viewBox="0 0 600 220" className="h-full w-full" fill="none" aria-hidden>
      <path d="M44 176 Q300 -6 556 96" stroke="#1c232d" strokeWidth="1.5" />
      <path d="M44 176 Q300 -6 556 96" stroke="#c9f24f" strokeWidth="1.5" strokeOpacity="0.55" className="arc-animated" />
      <circle cx="44" cy="176" r="5" fill="#c9f24f" />
      <circle cx="44" cy="176" r="10" stroke="#c9f24f" strokeOpacity="0.35" />
      <circle cx="556" cy="96" r="5" fill="#62c8f8" />
      <circle cx="556" cy="96" r="10" stroke="#62c8f8" strokeOpacity="0.35" />
      <circle r="5" fill="#e9eef4" className="plane-dot" />
      <text x="44" y="204" fill="#8b98a7" fontSize="13" fontFamily="IBM Plex Mono, monospace" textAnchor="start">
        GRU · São Paulo
      </text>
      <text x="556" y="82" fill="#8b98a7" fontSize="13" fontFamily="IBM Plex Mono, monospace" textAnchor="end">
        Londres · LON
      </text>
    </svg>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OfferWithDelta | null>(null);

  const [month, setMonth] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [bag, setBag] = useState<BagFilter>("all");
  const [stops, setStops] = useState<StopsFilter>("all");
  const [sort, setSort] = useState<SortKey>("price");
  const [limit, setLimit] = useState(60);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard", { cache: "no-store" });
      const j = (await r.json()) as DashboardResponse;
      setData(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setLimit(60);
    const minDelay = new Promise((r) => setTimeout(r, 2600));
    try {
      const res = await fetch("/api/scans", { method: "POST" });
      if (res.status === 429) {
        // varredura muito recente — apenas recarrega
      } else if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      await minDelay;
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await minDelay;
      setScanning(false);
    }
  }, [scanning, load]);

  const offers = useMemo(() => data?.offers ?? [], [data]);

  const filtered = useMemo(() => {
    let list = offers;
    if (month !== null) list = list.filter((o) => monthOfISO(o.departDate) === month);
    if (days !== null) list = list.filter((o) => o.tripDays === days);
    if (bag === "with") list = list.filter((o) => o.baggageIncluded);
    if (bag === "without") list = list.filter((o) => !o.baggageIncluded);
    if (stops === "direct") list = list.filter((o) => o.stopsOut === 0 && o.stopsBack === 0);
    if (stops === "onestop") list = list.filter((o) => o.stopsOut === 1 && o.stopsBack === 1);
    const sorted = [...list];
    if (sort === "price") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "duration")
      sorted.sort(
        (a, b) => a.durationOutMin + a.durationBackMin - (b.durationOutMin + b.durationBackMin)
      );
    else
      sorted.sort((a, b) => {
        if (a.deltaPct === null && b.deltaPct === null) return a.price - b.price;
        if (a.deltaPct === null) return 1;
        if (b.deltaPct === null) return -1;
        return a.deltaPct - b.deltaPct;
      });
    return sorted;
  }, [offers, month, days, bag, stops, sort]);

  const bagFiltered = useMemo(() => {
    if (bag === "with") return offers.filter((o) => o.baggageIncluded);
    if (bag === "without") return offers.filter((o) => !o.baggageIncluded);
    return offers;
  }, [offers, bag]);

  const stats = useMemo(() => {
    const light = offers.filter((o) => !o.baggageIncluded);
    const withBag = offers.filter((o) => o.baggageIncluded);
    const minLight = light[0] ?? null;
    const minBag = withBag.length ? withBag.reduce((a, b) => (a.price <= b.price ? a : b)) : null;
    const deltas = offers.map((o) => o.deltaPct).filter((d): d is number => d !== null);
    const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const drops = offers.filter((o) => o.deltaPct !== null && o.deltaPct < -0.15).length;
    const rises = offers.filter((o) => o.deltaPct !== null && o.deltaPct > 0.15).length;
    const news = offers.filter((o) => o.isNew).length;
    return { minLight, minBag, avgDelta, drops, rises, news };
  }, [offers]);

  const latest = data?.latest ?? null;
  const hasActiveFilters = month !== null || days !== null || bag !== "all" || stops !== "all";

  return (
    <div className="relative min-h-screen">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" />

      {/* ------------------------------ HEADER ------------------------------ */}
      <header className="relative z-10 border-b border-line/70 bg-ink/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-lime/40 bg-lime/10">
              <Radar size={15} className="text-lime" />
            </span>
            <div className="leading-tight">
              <div className="font-mono text-[11px] font-bold tracking-[0.22em] text-snow">
                RADAR GRU → LON
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                varredura tarifária · 2027
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {latest && (
              <>
              <ProviderChip provider={latest.provider} note={latest.note} />
              <span className="hidden font-mono text-[10px] uppercase tracking-wider text-faint md:inline">
                última varredura #{latest.id} · {timeAgoPt(new Date(latest.finishedAt))}
              </span>
              </>
            )}
            <ScanButton scanning={scanning} onClick={runScan} small />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-24">
        {loading ? (
          <div className="grid min-h-[60vh] place-items-center">
            <div className="flex flex-col items-center gap-4">
              <span className="relative grid h-16 w-16 place-items-center">
                <span className="radar-sweep absolute inset-0 rounded-full" />
                <span className="absolute inset-0 rounded-full border border-lime/30" />
              </span>
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-mist">
                sintonizando varreduras…
              </div>
            </div>
          </div>
        ) : error && !data ? (
          <div className="grid min-h-[60vh] place-items-center">
            <div className="max-w-md rounded-2xl border border-flare/40 bg-flare/10 p-6 text-center">
              <div className="font-mono text-xs uppercase tracking-widest text-flare">
                falha ao carregar
              </div>
              <p className="mt-2 text-sm text-mist">{error}</p>
            </div>
          </div>
        ) : data?.empty ? (
          /* --------------------------- PRIMEIRA VARREDURA --------------------------- */
          <div className="grid min-h-[70vh] place-items-center py-16">
            <div className="max-w-2xl text-center">
              <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-lime">
                sistema de varredura tarifária
              </div>
              <h1 className="mt-4 text-[clamp(2.2rem,6vw,4rem)] font-bold leading-[1.02] tracking-tight text-snow">
                São Paulo → Londres,
                <br />
                <span className="text-lime">abr – ago 2027</span>
              </h1>
              <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-mist">
                822 combinações de viagem (partidas abr–ago × 15–20 dias) × 15 companhias,
                com e sem bagagem despachada. Cada varredura é gravada — o histórico mostra
                a evolução real de preço de uma varredura para outra, em R$ e em %.
              </p>
              <div className="mt-8 flex justify-center">
                <ScanButton scanning={scanning} onClick={runScan} />
              </div>
              <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                execute a primeira varredura para ativar o radar
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ------------------------------ HERO ------------------------------ */}
            <section className="grid gap-6 pb-8 pt-10 lg:grid-cols-[1.15fr_1fr] lg:items-end">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist"
                >
                  <span className="rounded border border-line bg-panel px-2 py-1">
                    <Route size={11} className="mr-1 inline" /> 1 passageiro · econômica
                  </span>
                  <span className="rounded border border-line bg-panel px-2 py-1">
                    <CalendarRange size={11} className="mr-1 inline" /> abr – ago 2027
                  </span>
                  <span className="rounded border border-line bg-panel px-2 py-1">
                    <Timer size={11} className="mr-1 inline" /> 15 – 20 dias
                  </span>
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="mt-4 text-[clamp(2.1rem,5.4vw,3.9rem)] font-bold leading-[1.0] tracking-tight text-snow"
                >
                  Caça-tarifas <span className="text-lime">GRU → LON</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.12 }}
                  className="mt-3 max-w-xl text-sm leading-relaxed text-mist"
                >
                  {latest?.combosChecked ?? 822} combinações monitoradas · {offers.length} ofertas
                  na varredura #{latest?.id}. Verde = queda, rosa = alta, azul = estreia no radar.
                </motion.p>
                {latest?.provider === "market" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 inline-flex max-w-xl items-start gap-2 rounded-xl border border-amber/30 bg-amber/5 px-3 py-2 text-[11px] leading-relaxed text-amber/90"
                  >
                    <Activity size={13} className="mt-0.5 shrink-0" />
                    <span>
                      Fonte: motor de mercado calibrado com dados públicos reais da rota
                      (KAYAK, Decolar, Skyscanner — tarifas típicas R$ 4.399–6.133, julho em alta).
                      Para tarifas REAIS cacheadas (grátis, self-service), cadastre-se em{" "}
                      <span className="font-mono text-amber">travelpayouts.com</span> e configure{" "}
                      <code className="font-mono text-amber">TRAVELPAYOUTS_TOKEN</code> — a próxima
                      varredura já usa dados reais automaticamente. (Amadeus self-service foi
                      descontinuado em jul/2026 — hoje só via contrato Enterprise.)
                    </span>
                  </motion.div>
                )}
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="hidden h-[190px] lg:block"
              >
                <RouteArc />
              </motion.div>
            </section>

            {/* ------------------------------ KPIS ------------------------------ */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="menor tarifa sem bagagem"
                accent="mint"
                sub={
                  stats.minLight && (
                    <span className="flex items-center gap-1.5">
                      <Sigla code={stats.minLight.airlineCode} />
                      <span className="truncate">
                        {stats.minLight.airline} · {stats.minLight.tripDays}d
                      </span>
                      <DeltaBadge deltaPct={stats.minLight.deltaPct} isNew={stats.minLight.isNew} size="sm" />
                    </span>
                  )
                }
              >
                {stats.minLight ? <AnimatedPrice value={stats.minLight.price} /> : "—"}
              </Kpi>
              <Kpi
                label="menor tarifa com bagagem"
                accent="skyl"
                sub={
                  stats.minBag && (
                    <span className="flex items-center gap-1.5">
                      <Sigla code={stats.minBag.airlineCode} />
                      <span className="truncate">
                        {stats.minBag.airline} · {stats.minBag.tripDays}d
                      </span>
                      <DeltaBadge deltaPct={stats.minBag.deltaPct} isNew={stats.minBag.isNew} size="sm" />
                    </span>
                  )
                }
              >
                {stats.minBag ? <AnimatedPrice value={stats.minBag.price} /> : "—"}
              </Kpi>
              <Kpi
                label="movimento médio vs varredura anterior"
                sub={
                  <span>
                    <span className="text-mint">{stats.drops} quedas</span> ·{" "}
                    <span className="text-flare">{stats.rises} altas</span> ·{" "}
                    <span className="text-skyl">{stats.news} novas</span>
                  </span>
                }
              >
                <span className={stats.avgDelta < -0.05 ? "text-mint" : stats.avgDelta > 0.05 ? "text-flare" : "text-snow"}>
                  {pct(stats.avgDelta)}
                </span>
              </Kpi>
              <Kpi
                label="cobertura do radar"
                accent="amber"
                sub={
                  <span className="font-mono text-[11px]">
                    {latest ? `${latest.durationMs} ms de execução · ${data?.scans.length ?? 0} varreduras no histórico` : "—"}
                  </span>
                }
              >
                <span className="tabular-nums">{latest?.combosChecked ?? 0}</span>
                <span className="ml-2 text-sm font-normal text-faint">
                  comb. × {offers.length} ofertas
                </span>
              </Kpi>
            </section>

            {/* ------------------------------ FILTROS ------------------------------ */}
            <section className="sticky top-0 z-20 -mx-5 mt-8 border-y border-line/70 bg-ink/85 px-5 py-3 backdrop-blur">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  <Filter size={12} /> filtros
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[9px] uppercase text-faint">mês</span>
                  <Chip active={month === null} onClick={() => setMonth(null)}>todos</Chip>
                  {[4, 5, 6, 7, 8].map((m) => (
                    <Chip key={m} active={month === m} onClick={() => setMonth(month === m ? null : m)}>
                      {MONTH_SHORT_PT[m]}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[9px] uppercase text-faint">dias</span>
                  <Chip active={days === null} onClick={() => setDays(null)}>15–20</Chip>
                  {[15, 16, 17, 18, 19, 20].map((d) => (
                    <Chip key={d} active={days === d} onClick={() => setDays(days === d ? null : d)}>
                      {d}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[9px] uppercase text-faint">bagagem</span>
                  <Chip active={bag === "all"} onClick={() => setBag("all")}>todas</Chip>
                  <Chip active={bag === "without"} onClick={() => setBag("without")}>
                    <Backpack size={11} className="mr-1 inline" /> só mão
                  </Chip>
                  <Chip active={bag === "with"} onClick={() => setBag("with")}>
                    <Luggage size={11} className="mr-1 inline" /> com mala 23 kg
                  </Chip>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[9px] uppercase text-faint">trecho</span>
                  <Chip active={stops === "all"} onClick={() => setStops("all")}>todos</Chip>
                  <Chip active={stops === "direct"} onClick={() => setStops("direct")}>direto</Chip>
                  <Chip active={stops === "onestop"} onClick={() => setStops("onestop")}>1 escala</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[9px] uppercase text-faint">
                    <ArrowDownUp size={10} className="mr-0.5 inline" /> ordem
                  </span>
                  <Chip active={sort === "price"} onClick={() => setSort("price")}>menor preço</Chip>
                  <Chip active={sort === "drop"} onClick={() => setSort("drop")}>
                    <TrendingDown size={11} className="mr-1 inline" /> maior queda
                  </Chip>
                  <Chip active={sort === "duration"} onClick={() => setSort("duration")}>mais rápido</Chip>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setMonth(null);
                      setDays(null);
                      setBag("all");
                      setStops("all");
                    }}
                    className="flex items-center gap-1 rounded-lg border border-flare/40 bg-flare/10 px-2.5 py-1.5 text-xs font-medium text-flare transition-colors hover:bg-flare/20"
                  >
                    <X size={12} /> limpar
                  </button>
                )}
              </div>
            </section>

            {/* --------------------- TABELA + PAINEL LATERAL --------------------- */}
            <section className="mt-6 grid gap-5 lg:grid-cols-[1.75fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-line bg-panel/80">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Gauge size={14} className="text-lime" />
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-snow">
                      ranking de tarifas
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-mist">
                    {filtered.length} {filtered.length === 1 ? "oferta" : "ofertas"} · mostrando{" "}
                    {Math.min(limit, filtered.length)}
                  </span>
                </div>
                {filtered.length === 0 ? (
                  <EmptyRow message="nenhuma oferta para estes filtros" />
                ) : (
                  <>
                    <DealsTable offers={filtered.slice(0, limit)} onSelect={setSelected} />
                    {filtered.length > limit && (
                      <button
                        onClick={() => setLimit((l) => l + 60)}
                        className="w-full border-t border-line py-3 font-mono text-xs uppercase tracking-widest text-mist transition-colors hover:bg-panel2 hover:text-snow"
                      >
                        mostrar mais {Math.min(60, filtered.length - limit)} de {filtered.length - limit}
                      </button>
                    )}
                  </>
                )}
              </div>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-line bg-panel/80 p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-snow">
                      pulso entre varreduras
                    </span>
                    <span className="font-mono text-[9px] uppercase text-faint">
                      {data?.pulse.length ?? 0} leituras
                    </span>
                  </div>
                  <div className="mb-2 flex gap-3 font-mono text-[9px] uppercase tracking-wider text-faint">
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> menor light</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-skyl" /> menor c/ bag</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber" /> média top-10</span>
                  </div>
                  <PulseChart pulse={data?.pulse ?? []} bag={bag} />
                </div>
                <div className="rounded-2xl border border-line bg-panel/80 p-4">
                  <TopMovers offers={offers} onSelect={setSelected} />
                </div>
              </aside>
            </section>

            {/* ------------------------------ HEATMAP ------------------------------ */}
            <section className="mt-6 rounded-2xl border border-line bg-panel/80 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-snow">
                  mapa de calor · mês × duração{bag === "with" ? " (com bagagem)" : bag === "without" ? " (só mão)" : ""}
                </span>
                <span className="font-mono text-[9px] uppercase text-faint">
                  menor tarifa de cada combinação
                </span>
              </div>
              <Heatmap
                offers={bagFiltered}
                activeMonth={month}
                activeDays={days}
                onPick={(m, d) => {
                  setMonth(month === m && days === d ? null : m);
                  setDays(month === m && days === d ? null : d);
                }}
              />
            </section>

            {/* ------------------------------ METODOLOGIA ------------------------------ */}
            <footer className="mt-10 grid gap-5 border-t border-line pt-6 text-[11px] leading-relaxed text-faint md:grid-cols-3">
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
                  como funciona
                </div>
                Cada varredura reavalia as 822 combinações (partidas 01/abr–15/ago/2027 × 15–20
                dias), 15 companhias, com e sem bagagem. Os 2–3 melhores preços por combinação são
                gravados — nada é sobrescrito, tudo vira histórico comparável.
              </div>
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
                  deltas & percentuais
                </div>
                Cada oferta é casada com a mesma combinação (datas + companhia + franquia) na
                varredura anterior pela chave de rota. O Δ mostra a variação em % — verde caiu,
                rosa subiu, azul é estreia no radar. Clique numa linha para a série completa.
              </div>
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
                  fonte dos dados
                </div>
                {latest?.provider === "travelpayouts"
                  ? "Travelpayouts Data API — tarifas reais em cache (buscas Aviasales ~48h); bagagem classificada pela política típica da companhia."
                  : "Nenhuma varredura Travelpayouts disponível. Configure TRAVELPAYOUTS_TOKEN e execute uma nova varredura."}{" "}
                Confirme o preço final no link de cada oferta — tarifas mudam até a emissão.
              </div>
            </footer>
          </>
        )}
      </main>

      {/* ------------------------------ OVERLAY SCAN ------------------------------ */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-ink/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-5">
              <span className="relative grid h-24 w-24 place-items-center">
                <span className="radar-sweep absolute inset-0 rounded-full" />
                <span className="absolute inset-0 rounded-full border border-lime/30" />
                <span className="absolute inset-3 rounded-full border border-lime/20" />
                <span className="absolute inset-6 rounded-full border border-lime/10" />
              </span>
              <div className="text-center">
                <div className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-lime">
                  varredura em curso
                </div>
                <div className="mt-2 space-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mist">
                  <p>consultando 822 combinações · 15 companhias</p>
                  <p>abr – ago 2027 · 15–20 dias · com/sem bagagem</p>
                  <p className="text-faint">gravando no histórico para comparação…</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------ DRAWER ------------------------------ */}
      <AnimatePresence>
        {selected && <OfferDrawer offer={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
