// Most-recent-first ordering for the record modules (jobs, work orders, quotes,
// invoices, …): newly created or recently changed records sort to the top of
// list views and the front of card grids.
//
// Records carry a mix of recency signals — display-string dates ("Jun 12, 2026"),
// ISO lifecycle stamps, and session ids that embed Date.now() ("inv-1751600000000-x").
// A record's recency is the max of whatever it has.

function stampTs(s?: string): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

function idTs(id?: string): number {
  const m = id?.match(/-(\d{13})(?:\D|$)/);
  return m ? Number(m[1]) : 0;
}

export function recencyTs(id: string | undefined, ...stamps: (string | undefined)[]): number {
  return Math.max(idTs(id), ...stamps.map(stampTs), 0);
}
