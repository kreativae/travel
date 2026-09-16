// ---------------------------------------------------------------------------
// Utilidades de data (tudo em UTC para evitar surpresas de fuso) e a geração
// das combinações de viagem: partidas abr–ago/2027, viagens de 15–20 dias.
// ---------------------------------------------------------------------------

export interface DateCombo {
  departDate: string; // ISO yyyy-mm-dd
  returnDate: string;
  tripDays: number;
}

export const SEASON_YEAR = 2027;
export const SEASON_START = "2027-04-01";
export const SEASON_LAST_DEPART = "2027-08-15";
export const SEASON_LAST_RETURN = "2027-08-31";
export const TRIP_DURATIONS = [15, 16, 17, 18, 19, 20];

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromISO(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

export function addDaysISO(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function weekdayOfISO(iso: string): number {
  return fromISO(iso).getUTCDay(); // 0=dom … 6=sáb
}

export function monthOfISO(iso: string): number {
  return fromISO(iso).getUTCMonth() + 1; // 1-12
}

export function dayOfMonthISO(iso: string): number {
  return fromISO(iso).getUTCDate();
}

/** Gera TODAS as combinações partida×duração da janela (abr–ago/2027, 15–20 dias). */
export function buildCombos(): DateCombo[] {
  const combos: DateCombo[] = [];
  let cursor = SEASON_START;
  while (cursor <= SEASON_LAST_DEPART) {
    for (const days of TRIP_DURATIONS) {
      const ret = addDaysISO(cursor, days);
      if (ret <= SEASON_LAST_RETURN) {
        combos.push({ departDate: cursor, returnDate: ret, tripDays: days });
      }
    }
    cursor = addDaysISO(cursor, 1);
  }
  return combos;
}

export const MONTH_SHORT_PT = [
  "",
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export const WEEKDAY_SHORT_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "10 abr" */
export function fmtDayMonth(iso: string): string {
  return `${dayOfMonthISO(iso)} ${MONTH_SHORT_PT[monthOfISO(iso)]}`;
}

export function fmtFull(iso: string): string {
  return `${WEEKDAY_SHORT_PT[weekdayOfISO(iso)]} ${fmtDayMonth(iso)}`;
}
