import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Uma varredura = execução completa do motor de busca de preços
 * (todas as combinações de datas abr–ago/2027 × 15–20 dias).
 */
export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // 'amadeus' | 'market'
  status: text("status").notNull().default("done"),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at").notNull(),
  offersCount: integer("offers_count").notNull().default(0),
  combosChecked: integer("combos_checked").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  coverage: jsonb("coverage"),
  note: text("note"),
});

/**
 * Uma oferta encontrada em uma varredura.
 * routeKey identifica a "mesma" oferta entre varreduras
 * (datas + companhia + bagagem) e permite o histórico/percentuais.
 */
export const offers = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    scanId: integer("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    routeKey: text("route_key").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    departDate: text("depart_date").notNull(), // ISO yyyy-mm-dd
    returnDate: text("return_date").notNull(),
    tripDays: integer("trip_days").notNull(),
    airline: text("airline").notNull(),
    airlineCode: text("airline_code").notNull(),
    flightOut: text("flight_out"),
    flightBack: text("flight_back"),
    stopsOut: integer("stops_out").notNull(),
    stopsBack: integer("stops_back").notNull(),
    viaOut: text("via_out"),
    viaBack: text("via_back"),
    durationOutMin: integer("duration_out_min").notNull(),
    durationBackMin: integer("duration_back_min").notNull(),
    cabin: text("cabin").notNull().default("ECONOMY"),
    baggageIncluded: boolean("baggage_included").notNull(),
    baggageNote: text("baggage_note"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    deepLink: text("deep_link"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("offers_scan_idx").on(t.scanId),
    index("offers_routekey_idx").on(t.routeKey),
    index("offers_depart_idx").on(t.departDate),
    index("offers_scan_price_idx").on(t.scanId, t.price),
  ]
);

export type Scan = typeof scans.$inferSelect;
export type Offer = typeof offers.$inferSelect;
