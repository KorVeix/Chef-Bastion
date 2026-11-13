import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportMetrics,
  KeyValueStorage,
  loadMetrics,
  MatchRecord,
  METRICS_MAX_RUNS,
  METRICS_STORAGE_KEY,
  recordMatch,
  setMetricsSink,
  summarizeMetrics,
} from './analytics';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const DAY = 24 * 3600 * 1000;
const T0 = new Date(2026, 10, 13, 10, 0, 0).getTime();

function rush(seconds: number, endedAt = T0, extra: Partial<MatchRecord> = {}): MatchRecord {
  return {
    mode: 'rush',
    endedAt,
    victory: false,
    level: 0,
    phaseReached: 1,
    survivedSeconds: seconds,
    bugsCleaned: 10,
    kills1: 6,
    kills2: 3,
    kills3: 1,
    breaches: { cap_beetle: 3, speed_ant: 1 },
    ...extra,
  };
}

function campaign(level: number, victory: boolean, endedAt = T0): MatchRecord {
  return {
    mode: 'strategic',
    endedAt,
    victory,
    level,
    phaseReached: victory ? 3 : 2,
    survivedSeconds: 120,
    bugsCleaned: 12,
    kills1: 12,
    kills2: 0,
    kills3: 0,
    breaches: victory ? {} : { speed_ant: 4 },
  };
}

test('Métricas: guarda cada partida en el móvil y resume Supervivencia', () => {
  const storage = memoryStorage();
  recordMatch(rush(64), storage);
  recordMatch(rush(128), storage);
  recordMatch(rush(90), storage);
  const summary = summarizeMetrics(loadMetrics(storage));
  assert.equal(summary.totalMatches, 3);
  assert.deepEqual(summary.rush, { runs: 3, bestSeconds: 128, medianSeconds: 90, averageSeconds: 94 });
  assert.equal(summary.topBreachCause, 'cap_beetle');
  assert.equal(summary.breachesByBug.cap_beetle, 9);
  assert.equal(summary.comboKillShare, 0.4);
});

test('Métricas: campaña con tasa de victorias, nivel más atascado y vuelta otro día', () => {
  const storage = memoryStorage();
  recordMatch(campaign(4, true, T0), storage);
  recordMatch(campaign(5, false, T0), storage);
  recordMatch(campaign(5, false, T0 + 60_000), storage);
  recordMatch(campaign(5, true, T0 + DAY), storage);
  const summary = summarizeMetrics(loadMetrics(storage));
  assert.equal(summary.strategic.matches, 4);
  assert.equal(summary.strategic.winRate, 0.5);
  assert.equal(summary.strategic.hardestLevel, 5);
  assert.equal(summary.strategic.highestLevelWon, 5);
  assert.equal(summary.daysPlayed, 2);
  assert.equal(summary.returnedOnLaterDay, true);
});

test('Métricas: tope de partidas guardadas, almacenamiento roto y sink que falla no rompen nada', () => {
  const storage = memoryStorage();
  for (let i = 0; i < METRICS_MAX_RUNS + 25; i++) recordMatch(rush(i), storage);
  const store = loadMetrics(storage);
  assert.equal(store.runs.length, METRICS_MAX_RUNS);
  assert.equal(store.runs[0].survivedSeconds, 25);

  storage.data.set(METRICS_STORAGE_KEY, '{no es json');
  assert.equal(loadMetrics(storage, T0).runs.length, 0);

  const broken: KeyValueStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('full');
    },
  };
  setMetricsSink(() => {
    throw new Error('sdk down');
  });
  assert.doesNotThrow(() => recordMatch(rush(30), broken));
  assert.doesNotThrow(() => recordMatch(rush(30), null));
  setMetricsSink(null);
});

test('Métricas: el sink recibe cada partida y el export no lleva datos personales', () => {
  const seen: MatchRecord[] = [];
  setMetricsSink((r) => seen.push(r));
  recordMatch(rush(77), memoryStorage());
  setMetricsSink(null);
  assert.equal(seen.length, 1);

  const exported = JSON.parse(exportMetrics({ firstSeenAt: T0, runs: [rush(77)] }));
  assert.equal(exported.v, 1);
  assert.equal(exported.summary.rush.bestSeconds, 77);
  assert.deepEqual(Object.keys(exported.runs[0]).sort(), [
    'breaches',
    'bugsCleaned',
    'endedAt',
    'kills1',
    'kills2',
    'kills3',
    'level',
    'mode',
    'phaseReached',
    'survivedSeconds',
    'victory',
  ]);
});
