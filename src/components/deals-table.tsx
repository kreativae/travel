"use client";

import { fmtDayMonth, fmtFull, WEEKDAY_SHORT_PT, weekdayOfISO } from "@/lib/dates";
import { brl, fmtMinutes } from "@/lib/format";
import type { OfferWithDelta } from "@/lib/providers/types";
import { Backpack, ChevronRight, Luggage, Plane } from "lucide-react";
import { motion } from "framer-motion";
import { DeltaBadge, Sigla } from "./primitives";

export default function DealsTable({
  offers,
  onSelect,
  startRank = 1,
}: {
  offers: OfferWithDelta[];
  onSelect: (o: OfferWithDelta) => void;
  startRank?: number;
}) {
  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="w-full min-w-[880px] border-collapse">
        <thead>
          <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            <th className="px-3 py-2.5 font-medium">#</th>
            <th className="px-3 py-2.5 font-medium">datas (ida → volta)</th>
            <th className="px-3 py-2.5 font-medium">companhia</th>
            <th className="px-3 py-2.5 font-medium">trecho</th>
            <th className="px-3 py-2.5 font-medium">bagagem</th>
            <th className="px-3 py-2.5 font-medium">Δ varredura</th>
            <th className="px-3 py-2.5 text-right font-medium">tarifa</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {offers.map((o, i) => (
            <motion.tr
              key={o.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.012, 0.4) }}
              onClick={() => onSelect(o)}
              className="group cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-panel2/70"
            >
              <td className="px-3 py-3 font-mono text-xs text-faint">
                {(startRank + i).toString().padStart(2, "0")}
              </td>
              <td className="px-3 py-3">
                <div className="text-sm font-medium text-snow">
                  {fmtFull(o.departDate)} <span className="text-faint">→</span> {fmtFull(o.returnDate)}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-mist">
                  {o.tripDays} dias · {WEEKDAY_SHORT_PT[weekdayOfISO(o.departDate)]} a{" "}
                  {WEEKDAY_SHORT_PT[weekdayOfISO(o.returnDate)]}
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <Sigla code={o.airlineCode} />
                  <div>
                    <div className="text-sm text-snow">{o.airline}</div>
                    <div className="font-mono text-[10px] text-faint">
                      {o.flightOut} / {o.flightBack}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-1.5 text-sm text-snow">
                  <Plane size={13} className="text-faint" />
                  {o.stopsOut === 0 ? (
                    <span className="text-mint">Direto</span>
                  ) : (
                    <span>
                      1 escala <span className="font-mono text-xs text-mist">· {o.viaOut}</span>
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-mist">
                  {fmtMinutes(o.durationOutMin)} / {fmtMinutes(o.durationBackMin)}
                </div>
              </td>
              <td className="px-3 py-3">
                {o.baggageIncluded ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-skyl">
                    <Luggage size={13} /> inclui 23 kg
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-mist">
                    <Backpack size={13} /> só mão
                  </span>
                )}
              </td>
              <td className="px-3 py-3">
                <DeltaBadge deltaPct={o.deltaPct} isNew={o.isNew} size="sm" />
              </td>
              <td className="px-3 py-3 text-right">
                <div className="font-mono text-base font-semibold tabular-nums text-snow">
                  {brl(o.price)}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wide text-faint">
                  ida+volta · p/ pessoa
                </div>
              </td>
              <td className="pr-2">
                <ChevronRight
                  size={16}
                  className="text-faint transition-transform duration-200 group-hover:translate-x-1 group-hover:text-lime"
                />
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ message }: { message: string }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="font-mono text-xs uppercase tracking-widest text-faint">{message}</div>
      <div className="mt-1 text-sm text-mist">
        ajuste os filtros ou rode uma nova varredura
      </div>
    </div>
  );
}
