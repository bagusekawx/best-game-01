// Best score / best time / wins, kept in localStorage. Silent when storage is unavailable.
const KEY = 'scrapheap-best-v1';

export function loadBest() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { score: 0, time: 0, kills: 0, wins: 0, runs: 0 };
    const parsed = JSON.parse(raw);
    return {
      score: parsed.score || 0,
      time: parsed.time || 0,
      kills: parsed.kills || 0,
      wins: parsed.wins || 0,
      runs: parsed.runs || 0,
    };
  } catch {
    return { score: 0, time: 0, kills: 0, wins: 0, runs: 0 };
  }
}

export function recordRun({ score, time, kills, won }) {
  const best = loadBest();
  best.score = Math.max(best.score, score);
  best.time = Math.max(best.time, time);
  best.kills = Math.max(best.kills, kills);
  best.runs += 1;
  if (won) best.wins += 1;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    // storage unavailable — the run still counts on screen
  }
  return best;
}
