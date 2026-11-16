// SCRAPHEAP — boot, game loop, state machine, combat resolution.
// States: title → playing ⇄ draft/paused → won / over (→ endless).
import { VIEW, STEP, RUN_SECONDS, DIFFICULTY, XP_FOR_LEVEL, PICKUPS, ENEMIES } from './config.js';
import { makeRng } from './random.js';
import { initInput, moveVector, consumeDash, consumePause, clearQueues, keys } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Enemy, Director } from './enemies.js';
import { Weapons } from './weapons.js';
import { Pickups } from './pickups.js';
import { Particles } from './particles.js';
import { rollDraft, applyUpgrade } from './upgrades.js';
import * as ui from './ui.js';
import { sfx, unlockAudio, toggleMute, isMuted } from './audio.js';
import { loadBest, recordRun } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);

class Game {
  constructor() {
    this.world = new World();
    this.player = new Player();
    this.weapons = new Weapons();
    this.pickups = new Pickups();
    this.particles = new Particles();
    this.enemies = [];
    this.slamZones = [];
    this.rng = makeRng((Math.random() * 1e9) | 0);
    this.state = 'title';
    this.difficultyId = 'normal';
    this.difficulty = DIFFICULTY.normal;
    this.director = new Director(this.difficulty);
    this.time = 0;
    this.kills = 0;
    this.score = 0;
    this.combo = { count: 0, timer: 0 };
    this.boss = null;
    this.bossWarned = false;
    this.endless = false;
    this.draftQueue = 0;
    this.draftCards = [];
    this.announced = new Set();
    this.best = loadBest();
    this.ambient = [];
    this.seedAmbient();
  }

  xpNeeded() {
    return XP_FOR_LEVEL(this.player.level);
  }

  seedAmbient() {
    // A few machines wandering behind the title screen so the yard feels alive.
    const rng = makeRng(42);
    this.ambient = [];
    for (let i = 0; i < 9; i += 1) {
      const type = ['toaster', 'drone', 'fridge'][i % 3];
      const e = new Enemy(type, 400 + rng() * 1600, 300 + rng() * 1000, 0, DIFFICULTY.normal);
      e.driftAngle = rng() * Math.PI * 2;
      this.ambient.push(e);
    }
  }

  startRun(difficultyId) {
    this.difficultyId = difficultyId;
    this.difficulty = DIFFICULTY[difficultyId];
    this.director = new Director(this.difficulty);
    this.world.reset();
    this.player.reset();
    this.weapons.reset();
    this.pickups.reset();
    this.particles = new Particles();
    this.enemies = [];
    this.slamZones = [];
    this.time = 0;
    this.kills = 0;
    this.score = 0;
    this.combo = { count: 0, timer: 0 };
    this.boss = null;
    this.bossWarned = false;
    this.endless = false;
    this.draftQueue = 0;
    this.announced = new Set();
    this.state = 'playing';
    ui.showHudOnly();
    ui.setBossWarning(false);
    ui.showBanner('SURVIVE 6:00', 'Then scrap THE COMPACTOR', 2600);
    unlockAudio();
    clearQueues();
  }

  // ---- combat ----
  onDamage = (enemy, damage, crit, x, y) => {
    if (!enemy.alive) return;
    enemy.hp -= damage;
    enemy.flash = 0.09;
    this.particles.damageNumber(x, y, damage, { crit });
    if (Math.random() < 0.3) sfx.hit();
    if (enemy.hp <= 0) this.killEnemy(enemy);
  };

  killEnemy(enemy) {
    this.kills += 1;
    this.combo.count = Math.min(30, this.combo.count + 1);
    this.combo.timer = 2.5;
    const mult = 1 + Math.min(this.combo.count, 20) * 0.05;
    this.score += Math.round(enemy.score * mult);
    this.particles.burst(enemy.x, enemy.y, { count: enemy.elite ? 26 : 12, color: enemy.color, speed: 220, life: 0.5, size: 4 });
    this.particles.burst(enemy.x, enemy.y, { count: 6, color: '#ffd94d', speed: 140, life: 0.4, size: 3 });
    sfx.kill();
    if (enemy.type === 'boss') {
      this.particles.shake(14, 0.5);
      this.winRun();
      return;
    }
    if (enemy.type === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const mini = new Enemy('mini', enemy.x + (i === 0 ? -14 : 14), enemy.y, this.time, this.difficulty);
        this.enemies.push(mini);
      }
    }
    this.pickups.dropScrap(enemy.x, enemy.y, enemy.xp);
    if (enemy.elite) {
      this.pickups.dropSpecial('chest', enemy.x, enemy.y);
      this.particles.floatText(enemy.x, enemy.y - 24, 'ELITE DOWN!', '#ffd94d', 18);
    } else {
      const roll = Math.random();
      if (roll < 0.02) this.pickups.dropSpecial('bomb', enemy.x, enemy.y);
      else if (roll < 0.05) this.pickups.dropSpecial('magnet', enemy.x, enemy.y);
      else if (roll < 0.11 && this.player.hp < this.player.maxHp * 0.7) this.pickups.dropSpecial('heal', enemy.x, enemy.y);
    }
    if (this.combo.count > 0 && this.combo.count % 25 === 0) {
      this.particles.floatText(this.player.x, this.player.y - 30, `${this.combo.count} COMBO!`, '#ff9d5c', 18);
    }
  }

  gainXp(amount) {
    this.player.xp += amount;
    while (this.player.xp >= this.xpNeeded()) {
      this.player.xp -= this.xpNeeded();
      this.player.level += 1;
      this.draftQueue += 1;
    }
    if (this.draftQueue > 0 && this.state === 'playing') this.openDraft();
  }

  openDraft() {
    this.state = 'draft';
    this.draftCards = rollDraft(this.weapons, this.player, this.rng);
    sfx.levelup();
    this.particles.ring(this.player.x, this.player.y, { color: '#7ee081', maxRadius: 130, life: 0.5 });
    ui.showDraft(this.draftCards, (card) => this.pickCard(card));
  }

  pickCard(card) {
    applyUpgrade(card, this.weapons, this.player);
    sfx.click();
    this.draftQueue -= 1;
    if (this.draftQueue > 0) {
      this.openDraft();
    } else {
      this.state = 'playing';
      ui.showHudOnly();
      clearQueues(); // a pause pressed during the draft must not fire on resume
    }
  }

  spawnBoss() {
    const angle = Math.random() * Math.PI * 2;
    const x = Math.max(80, Math.min(2320, this.player.x + Math.cos(angle) * 420));
    const y = Math.max(80, Math.min(1520, this.player.y + Math.sin(angle) * 420));
    this.boss = new Enemy('boss', x, y, this.time, this.difficulty);
    this.enemies.push(this.boss);
    ui.showBanner('THE COMPACTOR', 'Destroy it to win. Watch for the slam!', 3000);
    ui.setBossWarning(false);
    sfx.boss();
    this.particles.shake(10, 0.4);
  }

  winRun() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.pickups.dropScrap(this.player.x, this.player.y, 0);
    const finalScore = Math.round(this.score * this.difficulty.score);
    this.best = recordRun({ score: finalScore, time: this.time, kills: this.kills, won: true });
    sfx.win();
    ui.fillStats('win-stats', [
      { value: finalScore.toLocaleString(), label: 'SCORE', sub: this.difficultyId === 'hell' ? '×1.5 HELL BONUS' : this.difficultyId === 'chill' ? '×0.75 CHILL' : 'NORMAL' },
      { value: this.kills, label: 'MACHINES SCRAPPED' },
      { value: ui.formatTime(this.time), label: 'TIME SURVIVED' },
      { value: `LV ${this.player.level}`, label: 'LEVEL REACHED' },
      { value: this.weapons.owned().length, label: 'WEAPONS BUILT' },
      { value: this.best.score.toLocaleString(), label: 'BEST SCORE', sub: this.best.score === finalScore ? '★ NEW BEST ★' : '' },
    ]);
    ui.showOnly('win-screen');
  }

  loseRun() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    const finalScore = Math.round(this.score * this.difficulty.score);
    this.best = recordRun({ score: finalScore, time: this.time, kills: this.kills, won: false });
    sfx.lose();
    this.particles.burst(this.player.x, this.player.y, { count: 40, color: '#2ec4b6', speed: 300, life: 0.8, size: 5 });
    ui.fillStats('over-stats', [
      { value: finalScore.toLocaleString(), label: 'SCORE' },
      { value: this.kills, label: 'MACHINES SCRAPPED' },
      { value: ui.formatTime(this.time), label: 'TIME SURVIVED' },
      { value: `LV ${this.player.level}`, label: 'LEVEL REACHED' },
      { value: this.boss ? 'THE COMPACTOR' : 'THE YARD', label: 'GOT YOU' },
      { value: this.best.score.toLocaleString(), label: 'BEST SCORE' },
    ]);
    ui.showOnly('over-screen');
  }

  enterEndless() {
    this.endless = true;
    this.boss = null;
    this.state = 'playing';
    this.time = RUN_SECONDS; // endless clock keeps counting from 6:00
    ui.showHudOnly();
    ui.showBanner('ENDLESS MODE', 'No more boss. Just you and the heap.', 2600);
    clearQueues();
  }

  // ---- fixed-step simulation ----
  step(dt) {
    if (this.state === 'title') {
      for (const e of this.ambient) {
        e.driftAngle += (Math.random() - 0.5) * 0.05;
        e.x += Math.cos(e.driftAngle) * 26 * dt;
        e.y += Math.sin(e.driftAngle) * 26 * dt;
        e.x = Math.max(40, Math.min(2360, e.x));
        e.y = Math.max(40, Math.min(1560, e.y));
        e.wobble += dt * 6;
      }
      this.world.follow(this.player.x, this.player.y, null);
      return;
    }
    if (this.state !== 'playing') return;

    this.time += dt;
    this.combo.timer -= dt;
    if (this.combo.timer <= 0) this.combo.count = 0;

    // Announcements for new enemy types.
    const unlocks = [[30, 'SWEEPER DRONES', 'Fast. Fragile. Everywhere.'], [90, 'SPLITTERS', 'They break into two. Aim carefully.'], [120, 'FRIDGE GOLEMS', 'Big, slow, and very hard to dent.'], [180, 'ACID SPITTERS', 'They shoot back. Keep moving.']];
    for (const [at, title, sub] of unlocks) {
      if (this.time >= at && !this.announced.has(at)) {
        this.announced.add(at);
        ui.showBanner(title, sub, 2000);
      }
    }
    if (!this.endless && !this.bossWarned && this.time >= RUN_SECONDS - 30) {
      this.bossWarned = true;
      ui.setBossWarning(true);
      sfx.boss();
    }
    if (!this.endless && !this.boss && this.time >= RUN_SECONDS) this.spawnBoss();

    // Player movement + dash.
    const move = moveVector();
    if (consumeDash() && this.player.tryDash(move.x || this.player.facing, move.y)) {
      sfx.dash();
      this.particles.burst(this.player.x, this.player.y, { count: 8, color: '#2ec4b6', speed: 160, life: 0.3, size: 3 });
    }
    this.player.update(dt, move);
    if (consumePause()) {
      this.state = 'paused';
      ui.showOnly('pause-screen');
      return;
    }

    // Spawning.
    const spawnTypes = this.director.update(dt, this.time, this.rng, this.endless);
    for (const type of spawnTypes) {
      const { x, y } = this.director.spawnPoint(this.player, this.world.camera, this.rng);
      this.enemies.push(new Enemy(type, x, y, this.time, this.difficulty, this.director.isElite(this.time, this.rng)));
    }

    // Enemies.
    const spawnMinion = (type, x, y) => {
      this.enemies.push(new Enemy(type, x, y, this.time, this.difficulty));
    };
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const event = e.update(dt, this.player, this.time, spawnMinion);
      if (event === 'spit') this.weapons.spit(e, this.player);
      if (event === 'slam') {
        this.slamZones.push({ x: e.x, y: e.y, radius: 230, timer: 0.7, damage: e.damage * 2 });
        this.particles.shake(6, 0.3);
      }
      if (event === 'charge') this.particles.burst(e.x, e.y, { count: 14, color: '#ff4d4d', speed: 200, life: 0.4, size: 4 });
    }

    // Slam zones detonate.
    for (let i = this.slamZones.length - 1; i >= 0; i -= 1) {
      const zone = this.slamZones[i];
      zone.timer -= dt;
      if (zone.timer <= 0) {
        this.slamZones.splice(i, 1);
        this.particles.ring(zone.x, zone.y, { color: '#ff4d4d', maxRadius: zone.radius, life: 0.4 });
        this.particles.shake(8, 0.3);
        if (Math.hypot(this.player.x - zone.x, this.player.y - zone.y) < zone.radius) {
          if (this.player.takeDamage(zone.damage)) {
            sfx.hurt();
            this.particles.burst(this.player.x, this.player.y, { count: 16, color: '#ff4d4d', speed: 240, life: 0.4, size: 4 });
          }
        }
      }
    }

    // Weapons.
    this.weapons.update(dt, this.player, this.enemies, this.particles, sfx, this.onDamage);

    // Enemy globs that reached the player.
    for (const g of this.weapons.globs) {
      if (g.hitPlayer) {
        g.hitPlayer = false;
        if (this.player.takeDamage(g.damage)) {
          sfx.hurt();
          this.particles.burst(this.player.x, this.player.y, { count: 10, color: '#7ee081', speed: 200, life: 0.35, size: 3 });
        }
      }
    }

    // Contact damage.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < e.radius + this.player.radius - 2) {
        if (this.player.takeDamage(e.damage)) {
          sfx.hurt();
          const dx = (this.player.x - e.x) / (Math.hypot(this.player.x - e.x, this.player.y - e.y) || 1);
          const dy = (this.player.y - e.y) / (Math.hypot(this.player.x - e.x, this.player.y - e.y) || 1);
          this.player.x += dx * 18;
          this.player.y += dy * 18;
          this.particles.burst(this.player.x, this.player.y, { count: 12, color: '#ff4d4d', speed: 220, life: 0.35, size: 4 });
          this.particles.shake(5, 0.2);
        }
      }
    }

    // Pickups.
    for (const p of this.pickups.update(dt, this.player)) {
      if (p.kind === 'scrap') {
        this.gainXp(p.amount);
        if (Math.random() < 0.4) sfx.pickup();
      } else if (p.kind === 'heal') {
        this.player.heal(PICKUPS.healAmount);
        this.particles.floatText(this.player.x, this.player.y - 26, `+${PICKUPS.healAmount} HP`, '#7ee081');
        sfx.heal();
      } else if (p.kind === 'magnet') {
        this.pickups.vacuumAll();
        this.particles.floatText(this.player.x, this.player.y - 26, 'SCRAP VACUUM!', '#2ec4b6');
        sfx.pickup();
      } else if (p.kind === 'bomb') {
        for (const e of this.enemies) {
          if (e.alive && e.type !== 'boss') this.onDamage(e, 500, false, e.x, e.y);
        }
        if (this.boss && this.boss.alive) this.onDamage(this.boss, 150, false, this.boss.x, this.boss.y);
        this.particles.shake(12, 0.4);
        this.particles.floatText(this.player.x, this.player.y - 26, 'BOOM!', '#ffb347', 22);
        sfx.kill();
      } else if (p.kind === 'chest') {
        this.player.heal(PICKUPS.chestHeal);
        sfx.chest();
        this.draftQueue += 1;
        if (this.state === 'playing') this.openDraft();
      }
    }

    // Sweep the dead.
    this.enemies = this.enemies.filter((e) => e.alive);
    if (this.boss && !this.boss.alive) this.boss = null;

    this.particles.update(dt);
    const shake = this.particles.shakeOffset(dt);
    this.world.follow(this.player.x, this.player.y, shake);

    if (this.player.hp <= 0) this.loseRun();
  }

  // ---- rendering ----
  draw() {
    const cam = this.world.camera;
    this.world.drawBackground(ctx);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    if (this.state === 'title') {
      for (const e of this.ambient) e.draw(ctx);
      this.player.draw(ctx);
      ctx.restore();
      return;
    }
    this.weapons.draw(ctx, this.player);
    this.pickups.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    // Slam telegraphs.
    for (const zone of this.slamZones) {
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(performance.now() / 60);
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.player.draw(ctx);
    this.particles.draw(ctx);
    ctx.restore();
  }
}

const game = new Game();
initInput(canvas);
ui.setBestLine(game.best);
ui.showOnly('title-screen');

// ---- wiring: buttons and keys ----
function setDifficulty(id) {
  game.difficultyId = id;
  document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('selected', b.dataset.diff === id));
  document.getElementById('diff-hint').textContent = DIFFICULTY[id].hint;
}
document.querySelectorAll('.diff-btn').forEach((b) => b.addEventListener('click', () => { setDifficulty(b.dataset.diff); sfx.click(); }));
document.getElementById('btn-start').addEventListener('click', () => game.startRun(game.difficultyId));
document.getElementById('btn-resume').addEventListener('click', () => { game.state = 'playing'; ui.showHudOnly(); clearQueues(); });
document.getElementById('btn-restart-pause').addEventListener('click', () => game.startRun(game.difficultyId));
document.getElementById('btn-quit-pause').addEventListener('click', () => { game.state = 'title'; ui.setBestLine(loadBest()); ui.showOnly('title-screen'); });
document.getElementById('btn-endless').addEventListener('click', () => game.enterEndless());
document.getElementById('btn-restart-win').addEventListener('click', () => game.startRun(game.difficultyId));
document.getElementById('btn-title-win').addEventListener('click', () => { game.state = 'title'; ui.setBestLine(loadBest()); ui.showOnly('title-screen'); });
document.getElementById('btn-restart-over').addEventListener('click', () => game.startRun(game.difficultyId));
document.getElementById('btn-title-over').addEventListener('click', () => { game.state = 'title'; ui.setBestLine(loadBest()); ui.showOnly('title-screen'); });
document.getElementById('btn-mute').addEventListener('click', () => ui.setMuteButton(toggleMute()));
document.getElementById('btn-pause').addEventListener('click', () => {
  if (game.state === 'playing') { game.state = 'paused'; ui.showOnly('pause-screen'); }
  else if (game.state === 'paused') { game.state = 'playing'; ui.showHudOnly(); clearQueues(); }
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') ui.setMuteButton(toggleMute());
  if (event.code === 'Enter' && game.state === 'title') game.startRun(game.difficultyId);
  if (event.code === 'KeyR' && (game.state === 'over' || game.state === 'won')) game.startRun(game.difficultyId);
  if (game.state === 'draft') {
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
    if (index >= 0 && game.draftCards[index]) game.pickCard(game.draftCards[index]);
  }
  if (event.code === 'Escape' && game.state === 'paused') { game.state = 'playing'; ui.showHudOnly(); clearQueues(); }
});

// ---- main loop: fixed-step simulation, render every frame ----
let accumulator = 0;
let last = performance.now();
function frame(now) {
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += frameDt;
  let guard = 0;
  while (accumulator >= STEP && guard < 8) {
    game.step(STEP);
    accumulator -= STEP;
    guard += 1;
  }
  if (guard === 8) accumulator = 0;
  game.draw();
  if (game.state === 'playing' || game.state === 'draft' || game.state === 'paused') ui.updateHud(game);
  window.requestAnimationFrame(frame);
}
window.requestAnimationFrame(frame);

// ---- screenshot scenes (?shot=title|play|win|over) ----
const shot = params.get('shot');
if (shot) {
  window.__shotReady = false;
  const seed = Number(params.get('seed') || 1);
  stageShot(game, shot, seed);
  // Let a few frames render before signalling readiness.
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    ui.updateHud(game);
    window.__shotReady = true;
  }));
}
