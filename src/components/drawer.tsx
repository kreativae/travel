"use client";

import { fmtFull } from "@/lib/dates";
import { brl, fmtDateTimePt, fmtMinutes, pct } from "@/lib/format";
import type { OfferWithDelta } from "@/lib/providers/types";
import type { HistoryPoint } from "@/lib/analysis";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Backpack,
  ExternalLink,
  Luggage,
  Plane,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { RouteHistoryChart } from "./panels";
import { DeltaBadge, Sigla } from "./primitives";

export default function OfferDrawer({
  offer,
  onClose,
}: {
  offer: OfferWithDelta;
  onClose: () => void;
}) {
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);

  useEffect(() => {
    setPoints(null);
    fetch(`/api/history?key=${encodeURIComponent(offer.routeKey)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setPoints(j.points ?? []))
      .catch(() => setPoints([]));
  }, [offer.routeKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 260 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-panel"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <div className="flex items-center gap-2.5">
              <Sigla code={offer.airlineCode} />
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                histórico da combinação
              </div>
            </div>
            <div className="mt-2 text-lg font-semibold leading-snug text-snow">
              {fmtFull(offer.departDate)} <ArrowRight size={15} className="inline text-faint" />{" "}
              {fmtFull(offer.returnDate)}
            </div>
            <div className="mt-0.5 font-mono text-xs text-mist">
              {offer.airline} · {offer.tripDays} dias · econômica
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-line p-1.5 text-mist transition-colors hover:border-mist/40 hover:text-snow"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                tarifa atual
              </div>
              <div className="mt-1 font-mono text-4xl font-semibold tabular-nums text-snow">
                {brl(offer.price)}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-faint">
                ida + volta · por pessoa · em reais
              </div>
            </div>
            <div className="text-right">
              <DeltaBadge deltaPct={offer.deltaPct} isNew={offer.isNew} />
              {offer.prevPrice !== null && (
                <div className="mt-1.5 font-mono text-[11px] text-mist">
                  antes: {brl(offer.prevPrice)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 text-sm">
            <div className="rounded-xl border border-line bg-panel2 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                <Plane size={11} /> ida · {offer.flightOut}
              </div>
              <div className="mt-1 text-snow">
                {offer.stopsOut === 0 ? "Direto" : `1 escala · ${offer.viaOut}`}
              </div>
              <div className="font-mono text-xs text-mist">{fmtMinutes(offer.durationOutMin)}</div>
            </div>
            <div className="rounded-xl border border-line bg-panel2 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                <Plane size={11} className="scale-x-[-1]" /> volta · {offer.flightBack}
              </div>
              <div className="mt-1 text-snow">
                {offer.stopsBack === 0 ? "Direto" : `1 escala · ${offer.viaBack}`}
              </div>
              <div className="font-mono text-xs text-mist">{fmtMinutes(offer.durationBackMin)}</div>
            </div>
            <div className="col-span-2 rounded-xl border border-line bg-panel2 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                {offer.baggageIncluded ? <Luggage size={11} /> : <Backpack size={11} />} bagagem
              </div>
              <div className="mt-1 text-snow">{offer.baggageNote}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                evolução entre varreduras
              </div>
              {points && points.length > 0 && (
                <div className="font-mono text-[10px] text-mist">
                  {points.length} {points.length === 1 ? "registro" : "registros"}
                </div>
              )}
            </div>
            {points === null ? (
              <div className="grid h-44 place-items-center font-mono text-xs text-faint">
                carregando histórico…
              </div>
            ) : points.length > 0 ? (
              <>
                <div className="rounded-xl border border-line bg-panel2 p-2">
                  <RouteHistoryChart points={points} />
                </div>
                <table className="mt-3 w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-line text-left text-[9px] uppercase tracking-wider text-faint">
                      <th className="py-2 font-medium">varredura</th>
                      <th className="py-2 font-medium">data</th>
                      <th className="py-2 text-right font-medium">tarifa</th>
                      <th className="py-2 text-right font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p) => (
                      <tr key={p.scanId} className="border-b border-line/50 last:border-0">
                        <td className="py-2 text-mist">#{p.scanId}</td>
                        <td className="py-2 text-mist">{fmtDateTimePt(new Date(p.at))}</td>
                        <td className="py-2 text-right tabular-nums text-snow">{brl(p.price)}</td>
                        <td
                          className={`py-2 text-right tabular-nums ${
                            p.deltaPct === null
                              ? "text-faint"
                              : p.deltaPct < -0.01
                                ? "text-mint"
                                : p.deltaPct > 0.01
                                  ? "text-flare"
                                  : "text-mist"
                          }`}
                        >
                          {p.deltaPct === null ? "1ª aparição" : pct(p.deltaPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="rounded-xl border border-line bg-panel2 p-4 text-xs text-mist">
                primeira aparição desta combinação — o histórico será construído varredura após varredura.
              </div>
            )}
          </div>

          <a
            href={offer.deepLink ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm font-semibold text-lime transition-colors hover:bg-lime/20"
          >
            comparar tarifa real no KAYAK <ExternalLink size={14} />
          </a>
          <p className="mt-3 text-center font-mono text-[10px] leading-relaxed text-faint">
            o link abre a busca real com estas datas — preços finais podem variar conforme
            disponibilidade no momento da compra.
          </p>
        </div>
      </motion.aside>
    </>
  );
}
