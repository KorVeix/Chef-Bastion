import { BugType } from './types';

// ============================================================================
// MÉTRICAS LOCALES DE PARTIDA (sin servidor, sin claves, offline)
// ============================================================================
// Each finished match is stored on the device as one compact record. The summary answers the questions
// a beta needs: how long Survival runs last, what kills the player, whether they play with combos,
// where the campaign gets stuck and whether people come back on later days.
// A sink can be attached later (e.g. an analytics SDK behind consent) without changing callers.

export const METRICS_STORAGE_KEY = 'chefbastion.metrics.v1';
export const METRICS_MAX_RUNS = 400;

export interface MatchRecord {
  mode: 'rush' | 'strategic';
  endedAt: number; // epoch ms
  victory: boolean;
  level: number; // campaign level (Strategic) or 0 (Rush)
  phaseReached: number;
  survivedSeconds: number;
  bugsCleaned: number;
  kills1: number;
  kills2: number;
  kills3: number;
  breaches: Partial<Record<BugType, number>>;
}

export interface MetricsStore {
  firstSeenAt: number;
  runs: MatchRecord[];
}

export interface MetricsSummary {
  totalMatches: number;
  daysPlayed: number;
  returnedOnLaterDay: boolean;
  rush: {
    runs: number;
    bestSeconds: number;
    medianSeconds: number;
    averageSeconds: number;
  };
  strategic: {
    matches: number;
    winRate: number; // 0..1
    hardestLevel: number | null; // level with most defeats
    highestLevelWon: number;
  };
  comboKillShare: number; // 0..1 share of kills that were 2★ or 3★
  topBreachCause: BugType | null;
  breachesByBug: Partial<Record<BugType, number>>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type MetricsSink = (record: MatchRecord) => void;
let sink: MetricsSink | null = null;

/** Optional forwarding of each finished match (for a future analytics SDK shown only after consent). */
export function setMetricsSink(next: MetricsSink | null): void {
  sink = next;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadMetrics(storage: KeyValueStorage | null = defaultStorage(), now = Date.now()): MetricsStore {
  try {
    const raw = storage?.getItem(METRICS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MetricsStore;
      if (Array.isArray(parsed.runs) && typeof parsed.firstSeenAt === 'number') return parsed;
    }
  } catch {
    // Corrupt or blocked storage: start fresh rather than break the game.
  }
  return { firstSeenAt: now, runs: [] };
}

export function recordMatch(
  record: MatchRecord,
  storage: KeyValueStorage | null = defaultStorage()
): MetricsStore {
  const store = loadMetrics(storage, record.endedAt);
  store.runs.push(record);
  if (store.runs.length > METRICS_MAX_RUNS) {
    store.runs.splice(0, store.runs.length - METRICS_MAX_RUNS);
  }
  try {
    storage?.setItem(METRICS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked: metrics are best-effort.
  }
  try {
    sink?.(record);
  } catch {
    // A failing sink must never affect the game.
  }
  return store;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function summarizeMetrics(store: MetricsStore): MetricsSummary {
  const runs = store.runs;
  const rushRuns = runs.filter((r) => r.mode === 'rush');
  const strategic = runs.filter((r) => r.mode === 'strategic');
  const rushSeconds = rushRuns.map((r) => r.survivedSeconds);

  const days = new Set(runs.map((r) => dayKey(r.endedAt)));
  const firstDay = dayKey(store.firstSeenAt);

  const defeatsByLevel = new Map<number, number>();
  for (const r of strategic) {
    if (!r.victory) defeatsByLevel.set(r.level, (defeatsByLevel.get(r.level) ?? 0) + 1);
  }
  let hardestLevel: number | null = null;
  let hardestDefeats = 0;
  for (const [lvl, defeats] of defeatsByLevel) {
    if (defeats > hardestDefeats || (defeats === hardestDefeats && hardestLevel !== null && lvl < hardestLevel)) {
      hardestLevel = lvl;
      hardestDefeats = defeats;
    }
  }

  const breachesByBug: Partial<Record<BugType, number>> = {};
  let kills = 0;
  let comboKills = 0;
  for (const r of runs) {
    kills += r.kills1 + r.kills2 + r.kills3;
    comboKills += r.kills2 + r.kills3;
    for (const [type, n] of Object.entries(r.breaches) as [BugType, number][]) {
      breachesByBug[type] = (breachesByBug[type] ?? 0) + n;
    }
  }
  let topBreachCause: BugType | null = null;
  for (const [type, n] of Object.entries(breachesByBug) as [BugType, number][]) {
    if (topBreachCause === null || n > (breachesByBug[topBreachCause] ?? 0)) topBreachCause = type;
  }

  return {
    totalMatches: runs.length,
    daysPlayed: days.size,
    returnedOnLaterDay: [...days].some((d) => d !== firstDay),
    rush: {
      runs: rushRuns.length,
      bestSeconds: rushSeconds.length ? Math.max(...rushSeconds) : 0,
      medianSeconds: median(rushSeconds),
      averageSeconds: rushSeconds.length
        ? Math.round(rushSeconds.reduce((a, b) => a + b, 0) / rushSeconds.length)
        : 0,
    },
    strategic: {
      matches: strategic.length,
      winRate: strategic.length ? strategic.filter((r) => r.victory).length / strategic.length : 0,
      hardestLevel,
      highestLevelWon: strategic.filter((r) => r.victory).reduce((m, r) => Math.max(m, r.level), 0),
    },
    comboKillShare: kills ? comboKills / kills : 0,
    topBreachCause,
    breachesByBug,
  };
}

/** Compact JSON a beta tester can copy and send (no personal data: only match numbers and dates). */
export function exportMetrics(store: MetricsStore): string {
  return JSON.stringify({ v: 1, summary: summarizeMetrics(store), runs: store.runs });
}
