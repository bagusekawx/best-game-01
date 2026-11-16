// Screenshot scenes behind ?shot=title|play|win|over. Each one plays the real game
// forward from a fresh run with a simple autopilot (flee the nearest machine, chase
// nearby scrap, dash when surrounded), so every frame is what a real run looks like
// and the same seed always gives the same frame.
import { STEP, RUN_SECONDS, ARENA } from './config.js';
import { makeRng } from './random.js';
import { Enemy } from './enemies.js';
import { setVirtualMove, queueDash, clearVirtual } from './input.js';
import { hideBanner } from './ui.js';
import { toggleMute, isMuted } from './audio.js';

// The sim uses Math.random in places (enemy jitter, crits, drops), so staging
// swaps it for a seeded RNG per attempt: the same seed always stages the same
// frame, and the best of several seeds wins.
const realRandom = Math.random;

function withSeededRandom(seed, fn) {
  Math.random = makeRng(seed);
  try {
    return fn();
  } finally {
    Math.random = realRandom;
  }
}

/** Steer: away from the crowd, toward nearby scrap, else drift to the middle. */
function autopilot(game) {
  const player = game.player;
  let mx = 0;
  let my = 0;
  let nearest = null;
  let nearestDist = Infinity;
  let closeCount = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < nearestDist) { nearestDist = d; nearest = e; }
    if (d < 170) {
      closeCount += 1;
      centroidX += e.x;
      centroidY += e.y;
    }
  }
  if (closeCount >= 3) {
    // Surrounded: flee from the crowd's centre, which is stable where a
    // per-enemy sum oscillates.
    centroidX /= closeCount;
    centroidY /= closeCount;
    const d = Math.hypot(player.x - centroidX, player.y - centroidY) || 1;
    mx += (player.x - centroidX) / d;
    my += (player.y - centroidY) / d;
  } else if (nearest && nearestDist < 240) {
    const weight = 1 + (240 - nearestDist) / 120; // the closer, the harder the flee
    mx += ((player.x - nearest.x) / (nearestDist || 1)) * weight;
    my += ((player.y - nearest.y) / (nearestDist || 1)) * weight;
  }
  let scrap = null;
  let scrapDist = 260;
  for (const p of game.pickups.list) {
    if (p.kind !== 'scrap') continue;
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d < scrapDist) { scrapDist = d; scrap = p; }
  }
  if (scrap && nearestDist > 150) {
    mx += (scrap.x - player.x) / (scrapDist || 1) * 0.7;
    my += (scrap.y - player.y) / (scrapDist || 1) * 0.7;
  }
  // Hurt? Go get the oil can.
  if (player.hp < player.maxHp * 0.55) {
    let heal = null;
    let healDist = 450;
    for (const p of game.pickups.list) {
      if (p.kind !== 'heal') continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < healDist) { healDist = d; heal = p; }
    }
    if (heal) {
      mx += (heal.x - player.x) / (healDist || 1) * 1.4;
      my += (heal.y - player.y) / (healDist || 1) * 1.4;
    }
  }
  // Stay off the fences: steer inward when near an edge.
  const edge = 220;
  if (player.x < edge) mx += (edge - player.x) / edge * 1.5;
  if (player.x > ARENA.width - edge) mx -= (player.x - (ARENA.width - edge)) / edge * 1.5;
  if (player.y < edge) my += (edge - player.y) / edge * 1.5;
  if (player.y > ARENA.height - edge) my -= (player.y - (ARENA.height - edge)) / edge * 1.5;
  if (mx === 0 && my === 0) {
    mx = (ARENA.width / 2 - player.x) / 1200;
    my = (ARENA.height / 2 - player.y) / 800;
  }
  const len = Math.hypot(mx, my) || 1;
  setVirtualMove(mx / len, my / len);
  if (closeCount >= 2) queueDash();
}

/** Run the simulation forward `seconds` of game time, auto-picking every draft. */
function simulate(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.state === 'draft') {
      game.pickCard(pickStagingCard(game));
      continue;
    }
    if (game.state !== 'playing') break;
    autopilot(game);
    game.step(STEP);
  }
  // Drain a draft left open on the last step so the run ends in play, not in a menu.
  while (game.state === 'draft') game.pickCard(pickStagingCard(game));
  clearVirtual();
}

/** The staging pilot drafts like a good player: evolutions, then focus damage. */
function pickStagingCard(game) {
  const cards = game.draftCards;
  const byKind = (kind, ids) => cards.find((c) => c.kind === kind && (!ids || ids.includes(c.id)));
  const ownedWeak = cards.find((c) => c.kind === 'weapon' && game.weapons.level(c.id) > 0 && game.weapons.level(c.id) < 3);
  return byKind('evolution')
    || ownedWeak
    || cards.find((c) => c.kind === 'weapon' && game.weapons.level(c.id) === 0)
    || byKind('weapon')
    || byKind('passive', ['overclock', 'lucky'])
    || cards[0];
}

function stagePlay(game, seed) {
  // Try several seeds at each length; keep the strongest run (alive, most HP,
  // then most kills) and re-run it — deterministic, so the frame is identical.
  for (const seconds of [200, 150, 100, 60]) {
    let best = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const trySeed = seed + attempt * 17;
      const outcome = withSeededRandom(trySeed, () => {
        game.rng = makeRng(trySeed);
        game.startRun('normal');
        simulate(game, seconds);
        return { seed: trySeed, alive: game.state === 'playing', hp: game.player.hp, kills: game.kills };
      });
      if (!outcome.alive) continue;
      if (!best || outcome.hp > best.hp || (outcome.hp === best.hp && outcome.kills > best.kills)) best = outcome;
    }
    if (!best) continue;
    withSeededRandom(best.seed, () => {
      game.rng = makeRng(best.seed);
      game.startRun('normal');
      simulate(game, seconds);
      // A closing ring of real machines, so the frame shows the fight at its busiest.
      const types = game.director.availableTypes(game.time);
      for (let i = 0; i < 16; i += 1) {
        const angle = (i / 16) * Math.PI * 2;
        const radius = 270 + game.rng() * 160;
        const x = Math.max(30, Math.min(ARENA.width - 30, game.player.x + Math.cos(angle) * radius));
        const y = Math.max(30, Math.min(ARENA.height - 30, game.player.y + Math.sin(angle) * radius));
        const type = types[Math.floor(game.rng() * types.length)];
        game.enemies.push(new Enemy(type, x, y, game.time, game.difficulty, i === 0));
      }
      simulate(game, 1.2);
    });
    if (game.state === 'playing') {
      hideBanner();
      return;
    }
    // The ring killed the pilot: restage the same run without it.
    withSeededRandom(best.seed, () => {
      game.rng = makeRng(best.seed);
      game.startRun('normal');
      simulate(game, seconds);
    });
    if (game.state === 'playing') {
      hideBanner();
      return;
    }
  }
}

function stageWin(game, seed) {
  withSeededRandom(seed, () => {
    for (const seconds of [150, 120, 90, 60]) {
      game.rng = makeRng(seed);
      game.startRun('normal');
      simulate(game, seconds);
      if (game.state !== 'playing') continue;
      // The boss arrives on schedule; soften it so the staged run ends in a win.
      game.time = RUN_SECONDS;
      game.spawnBoss();
      if (game.boss) {
        game.boss.hp = 1;
        game.onDamage(game.boss, 10, false, game.boss.x, game.boss.y);
      }
      return;
    }
  });
}

function stageOver(game, seed) {
  withSeededRandom(seed, () => {
    game.rng = makeRng(seed);
    game.startRun('normal');
    // A good run first — then the pilot gives up and the yard wins, as it should.
    simulate(game, 90);
    if (game.state !== 'playing') return;
    const steps = Math.floor(150 / STEP);
    for (let i = 0; i < steps; i += 1) {
      if (game.state === 'draft') {
        game.pickCard(pickStagingCard(game));
        continue;
      }
      if (game.state !== 'playing') break;
      setVirtualMove(0, 0);
      game.step(STEP);
    }
    clearVirtual();
    if (game.state === 'playing') {
      // Still standing (unlikely): one last shove from the yard.
      game.player.hp = 1;
      game.player.invulnerable = 0;
      for (let i = 0; i < Math.floor(30 / STEP) && game.state === 'playing'; i += 1) game.step(STEP);
    }
  });
}

/** Set `game` to the named scene. Any other name is the title screen. */
export function stageShot(game, name, seed) {
  if (!isMuted()) toggleMute(); // screenshots need no sound; skip the synth work
  if (name === 'play') stagePlay(game, seed);
  else if (name === 'win') stageWin(game, seed);
  else if (name === 'over') stageOver(game, seed);
  // title: the game already boots there.
}
