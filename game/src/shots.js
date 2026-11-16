// Screenshot scenes behind ?shot=title|play|win|over. Each one plays the real game
// forward from a fresh run with a simple autopilot (flee the nearest machine, chase
// nearby scrap, dash when surrounded), so every frame is what a real run looks like
// and the same seed always gives the same frame.
import { STEP, RUN_SECONDS } from './config.js';
import { makeRng } from './random.js';
import { setVirtualMove, queueDash, clearVirtual } from './input.js';

/** Steer: away from close enemies, toward nearby scrap, else drift to the middle. */
function autopilot(game) {
  const player = game.player;
  let mx = 0;
  let my = 0;
  let nearest = null;
  let nearestDist = Infinity;
  let closeCount = 0;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < nearestDist) { nearestDist = d; nearest = e; }
    if (d < 130) closeCount += 1;
  }
  if (nearest && nearestDist < 170) {
    mx += (player.x - nearest.x) / (nearestDist || 1);
    my += (player.y - nearest.y) / (nearestDist || 1);
  }
  let scrap = null;
  let scrapDist = 260;
  for (const p of game.pickups.list) {
    if (p.kind !== 'scrap') continue;
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d < scrapDist) { scrapDist = d; scrap = p; }
  }
  if (scrap && nearestDist > 90) {
    mx += (scrap.x - player.x) / (scrapDist || 1) * 0.7;
    my += (scrap.y - player.y) / (scrapDist || 1) * 0.7;
  }
  if (mx === 0 && my === 0) {
    mx = (1200 - player.x) / 1200;
    my = (800 - player.y) / 800;
  }
  const len = Math.hypot(mx, my) || 1;
  setVirtualMove(mx / len, my / len);
  if (closeCount >= 3) queueDash();
}

/** Run the simulation forward `seconds` of game time, auto-picking every draft. */
function simulate(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.state === 'draft') {
      game.pickCard(game.draftCards[0]);
      continue;
    }
    if (game.state !== 'playing') break;
    autopilot(game);
    game.step(STEP);
  }
  clearVirtual();
}

function stagePlay(game, seed) {
  // Try a long run first; fall back to shorter ones if the pilot dies.
  for (const seconds of [150, 100, 60]) {
    game.rng = makeRng(seed);
    game.startRun('normal');
    simulate(game, seconds);
    if (game.state === 'playing') return;
  }
}

function stageWin(game, seed) {
  game.rng = makeRng(seed);
  game.startRun('normal');
  simulate(game, 120);
  if (game.state !== 'playing') {
    game.rng = makeRng(seed);
    game.startRun('normal');
    simulate(game, 60);
  }
  if (game.state !== 'playing') return;
  // The boss arrives on schedule; soften it so the staged run ends in a win.
  game.time = RUN_SECONDS;
  game.spawnBoss();
  if (game.boss) {
    game.boss.hp = 1;
    game.onDamage(game.boss, 10, false, game.boss.x, game.boss.y);
  }
}

function stageOver(game, seed) {
  game.rng = makeRng(seed);
  game.startRun('normal');
  // A pilot that stands still and never dashes: the yard wins, as it should.
  const steps = Math.floor(240 / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.state === 'draft') {
      game.pickCard(game.draftCards[0]);
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
}

/** Set `game` to the named scene. Any other name is the title screen. */
export function stageShot(game, name, seed) {
  if (name === 'play') stagePlay(game, seed);
  else if (name === 'win') stageWin(game, seed);
  else if (name === 'over') stageOver(game, seed);
  // title: the game already boots there.
}
