// Enemies: five machine types, elites, the Compactor boss, and the spawn director.
import { ARENA, ENEMIES, UNLOCK_AT, ELITE_FROM, ELITE_CHANCE, hpScaleAt, VIEW } from './config.js';
import { range } from './random.js';

let nextId = 1;

export class Enemy {
  constructor(type, x, y, time, difficulty, elite = false) {
    const def = ENEMIES[type];
    this.id = nextId;
    nextId += 1;
    this.type = type;
    this.name = def.name;
    this.x = x;
    this.y = y;
    this.elite = elite;
    const hpMul = hpScaleAt(time) * difficulty.enemyHp * (elite ? 6 : 1);
    this.maxHp = Math.round(def.hp * hpMul);
    this.hp = this.maxHp;
    this.speed = def.speed * difficulty.enemySpeed * (elite ? 0.85 : 1) * range(Math.random, 0.9, 1.1);
    this.damage = Math.round(def.damage * difficulty.enemyDamage * (elite ? 1.5 : 1));
    this.xp = def.xp * (elite ? 5 : 1);
    this.radius = def.radius * (elite ? 1.5 : 1);
    this.score = def.score * (elite ? 5 : 1);
    this.color = def.color;
    this.knockX = 0;
    this.knockY = 0;
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.flash = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.shootCooldown = range(Math.random, 1, 2.2);
    // Boss state
    this.phase = 0;
    this.attackTimer = 2.5;
    this.charging = 0;
    this.chargeDx = 0;
    this.chargeDy = 0;
    this.spawnTimer = 6;
    this.slamTimer = 4;
  }

  get alive() {
    return this.hp > 0;
  }

  get slowed() {
    return performance.now() / 1000 < this.slowUntil;
  }

  applySlow(factor, seconds) {
    this.slowFactor = factor;
    this.slowUntil = performance.now() / 1000 + seconds;
  }

  knockback(dx, dy, force) {
    this.knockX += dx * force;
    this.knockY += dy * force;
  }

  /** Returns 'spit' when the spitter fires, 'slam'/'charge'/'spawn' for boss tells. */
  update(dt, player, time, spawnMinion) {
    this.flash = Math.max(0, this.flash - dt);
    this.wobble += dt * 6;
    // Knockback decay
    this.x += this.knockX * dt;
    this.y += this.knockY * dt;
    this.knockX *= 0.86;
    this.knockY *= 0.86;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = this.speed * (this.slowed ? this.slowFactor : 1);

    if (this.type === 'boss') return this.updateBoss(dt, player, dist, dx / dist, dy / dist, speed, spawnMinion);

    if (this.type === 'spitter') {
      // Keep a firing distance of ~260px, then spit globs.
      if (dist > 300) {
        this.x += (dx / dist) * speed * dt;
        this.y += (dy / dist) * speed * dt;
      } else if (dist < 200) {
        this.x -= (dx / dist) * speed * 0.7 * dt;
        this.y -= (dy / dist) * speed * 0.7 * dt;
      } else {
        // Strafe sideways while in range.
        const side = Math.sin(this.wobble * 0.5) > 0 ? 1 : -1;
        this.x += (-dy / dist) * side * speed * 0.6 * dt;
        this.y += (dx / dist) * side * speed * 0.6 * dt;
      }
      this.shootCooldown -= dt;
      if (this.shootCooldown <= 0 && dist < 420) {
        this.shootCooldown = 2.2;
        return 'spit';
      }
      return null;
    }

    if (this.type === 'drone') {
      // Fast zigzag approach.
      const wob = Math.sin(this.wobble) * 0.55;
      const nx = dx / dist;
      const ny = dy / dist;
      this.x += (nx - ny * wob) * speed * dt;
      this.y += (ny + nx * wob) * speed * dt;
      return null;
    }

    // Chasers: toaster, fridge, splitter, mini.
    this.x += (dx / dist) * speed * dt;
    this.y += (dy / dist) * speed * dt;
    return null;
  }

  updateBoss(dt, player, dist, nx, ny, speed, spawnMinion) {
    this.attackTimer -= dt;
    this.spawnTimer -= dt;
    this.slamTimer -= dt;

    if (this.charging > 0) {
      this.charging -= dt;
      this.x += this.chargeDx * 520 * dt;
      this.y += this.chargeDy * 520 * dt;
      return null;
    }

    // Spawn minions every few seconds.
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 7;
      if (spawnMinion) {
        spawnMinion('drone', this.x + 40, this.y);
        spawnMinion('drone', this.x - 40, this.y);
        spawnMinion('toaster', this.x, this.y + 40);
      }
      return 'spawn';
    }
    // Slam when close: a big AoE the player must dash out of.
    if (this.slamTimer <= 0 && dist < 260) {
      this.slamTimer = 5;
      return 'slam';
    }
    // Charge when far: telegraphed by the phase flag main.js reads.
    if (this.attackTimer <= 0 && dist > 320) {
      this.attackTimer = 6;
      this.charging = 0.55;
      this.chargeDx = nx;
      this.chargeDy = ny;
      return 'charge';
    }
    // Otherwise lumber toward the player.
    this.x += nx * speed * dt;
    this.y += ny * speed * dt;
    return null;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.9;
    const c = this.color;
    const r = this.radius;
    if (this.elite) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.type === 'toaster') {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-r, -r * 0.8, r * 2, r * 1.6, 5);
      ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(-r * 0.6, -r * 0.8, r * 1.2, 5);
      ctx.fillStyle = '#ffe66d';
      ctx.beginPath();
      ctx.arc(-r * 0.35, 0, 3, 0, Math.PI * 2);
      ctx.arc(r * 0.35, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2b33';
      ctx.fillRect(-r * 0.7, r * 0.8, 6, 5);
      ctx.fillRect(r * 0.7 - 6, r * 0.8, 6, 5);
    } else if (this.type === 'drone') {
      const spin = Math.sin(this.wobble * 3) * 0.3;
      ctx.strokeStyle = '#8fa8b5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r - 6, -4 + spin * 10);
      ctx.lineTo(-r + 4, 0);
      ctx.moveTo(r + 6, -4 - spin * 10);
      ctx.lineTo(r - 4, 0);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'fridge') {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-r * 0.8, -r, r * 1.6, r * 2, 6);
      ctx.fill();
      ctx.fillStyle = '#5d7480';
      ctx.fillRect(-r * 0.8, -4, r * 1.6, 3);
      ctx.fillStyle = '#0d1b26';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.4, 4, 0, Math.PI * 2);
      ctx.arc(r * 0.3, -r * 0.4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8722a';
      ctx.fillRect(r * 0.45, -r * 0.6, 4, 12);
    } else if (this.type === 'splitter' || this.type === 'mini') {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d1b26';
      ctx.beginPath();
      ctx.arc(-r * 0.3, r * 0.1, 2.5, 0, Math.PI * 2);
      ctx.arc(r * 0.3, r * 0.1, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'spitter') {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, r * 0.8);
      ctx.lineTo(-r, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7ee081';
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d1b26';
      ctx.beginPath();
      ctx.arc(-r * 0.35, r * 0.35, 2.5, 0, Math.PI * 2);
      ctx.arc(r * 0.35, r * 0.35, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'boss') {
      // THE COMPACTOR: a walking trash compactor with a crusher jaw.
      ctx.fillStyle = '#5d7480';
      ctx.beginPath();
      ctx.roundRect(-r, -r * 0.9, r * 2, r * 1.8, 10);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-r * 0.85, -r * 0.9, r * 1.7, r * 0.5, 8);
      ctx.fill();
      // Crusher jaw
      const jaw = 6 + Math.sin(this.wobble * 2) * 4;
      ctx.fillStyle = '#2b3a42';
      ctx.fillRect(-r * 0.7, r * 0.55, r * 1.4, 12 + jaw);
      ctx.fillStyle = '#ffb347';
      for (let i = -2; i <= 2; i += 1) ctx.fillRect(i * r * 0.28 - 3, r * 0.55 + 12 + jaw - 4, 6, 8);
      // Eyes
      ctx.fillStyle = '#ffe66d';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.25, 7, 0, Math.PI * 2);
      ctx.arc(r * 0.35, -r * 0.25, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d1b26';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.25, 3, 0, Math.PI * 2);
      ctx.arc(r * 0.35, -r * 0.25, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP bar (only when hurt)
    if (this.hp < this.maxHp && this.type !== 'boss') {
      const w = r * 2;
      ctx.fillStyle = 'rgba(10,18,24,0.8)';
      ctx.fillRect(-w / 2, -r - 12, w, 5);
      ctx.fillStyle = this.elite ? '#ffd94d' : '#7ee081';
      ctx.fillRect(-w / 2, -r - 12, w * Math.max(0, this.hp / this.maxHp), 5);
    }
    ctx.restore();
  }
}

// The director decides what spawns and when, scaling with run time.
export class Director {
  constructor(difficulty) {
    this.difficulty = difficulty;
    this.timer = 0.8;
    this.bossSpawned = false;
  }

  reset() {
    this.timer = 0.8;
    this.bossSpawned = false;
  }

  availableTypes(time) {
    return Object.keys(UNLOCK_AT).filter((t) => time >= UNLOCK_AT[t]);
  }

  /** Spawn points just outside the camera view. */
  spawnPoint(player, camera, rng) {
    const margin = 60;
    const side = Math.floor(rng() * 4);
    let x;
    let y;
    if (side === 0) { x = camera.x - margin; y = camera.y + rng() * VIEW.height; }
    else if (side === 1) { x = camera.x + VIEW.width + margin; y = camera.y + rng() * VIEW.height; }
    else if (side === 2) { x = camera.x + rng() * VIEW.width; y = camera.y - margin; }
    else { x = camera.x + rng() * VIEW.width; y = camera.y + VIEW.height + margin; }
    x = Math.max(20, Math.min(ARENA.width - 20, x));
    y = Math.max(20, Math.min(ARENA.height - 20, y));
    // Never spawn on top of the player.
    if (Math.hypot(x - player.x, y - player.y) < 220) {
      x = player.x + (x < player.x ? -320 : 320);
      y = player.y + (y < player.y ? -320 : 320);
      x = Math.max(20, Math.min(ARENA.width - 20, x));
      y = Math.max(20, Math.min(ARENA.height - 20, y));
    }
    return { x, y };
  }

  /** Returns an array of enemy types to spawn this tick (may be empty). */
  update(dt, time, rng, endless = false) {
    if (time >= 360 && !endless) return []; // boss time: no more trash spawns
    this.timer -= dt;
    if (this.timer > 0) return [];
    // Spawn interval shrinks and batch grows as the run goes on.
    const interval = Math.max(0.26, 1.05 - time * 0.0021);
    this.timer = interval;
    const batch = 1 + Math.floor(time / 75) + (rng() < 0.3 ? 1 : 0);
    const types = this.availableTypes(time);
    const out = [];
    for (let i = 0; i < batch; i += 1) {
      // Weight early types less as time passes so the mix shifts.
      const weights = types.map((t) => (t === 'toaster' ? Math.max(1, 6 - time / 60) : t === 'drone' ? 3 : 2));
      let total = 0;
      for (const w of weights) total += w;
      let roll = rng() * total;
      let type = types[0];
      for (let j = 0; j < types.length; j += 1) {
        roll -= weights[j];
        if (roll <= 0) { type = types[j]; break; }
      }
      out.push(type);
    }
    return out;
  }

  isElite(time, rng) {
    return time >= ELITE_FROM && rng() < ELITE_CHANCE;
  }
}
