// Weapons: five auto-firing systems, two evolutions, and the projectiles they throw.
// Every weapon fires on its own — the player's job is positioning and dodging.
import { WEAPONS } from './config.js';

export class Weapons {
  constructor() {
    this.reset();
  }

  reset() {
    // levels: { spark: 1, wrench: 0, ... } — 0 means not owned yet.
    this.levels = { spark: 1, wrench: 0, saw: 0, nova: 0, slick: 0 };
    this.evolved = new Set();
    this.cooldowns = { spark: 0, wrench: 0, nova: 0, slick: 0 };
    this.sawAngle = 0;
    this.sawTick = 0;
    this.projectiles = []; // player projectiles
    this.globs = []; // enemy spit
    this.slicks = []; // burning oil puddles
    this.novaFx = null; // expanding ring drawn for one frame burst
  }

  level(id) {
    return this.levels[id] || 0;
  }

  owned() {
    return Object.keys(this.levels).filter((id) => this.levels[id] > 0);
  }

  addLevel(id) {
    this.levels[id] = Math.min(WEAPONS[id].max, this.level(id) + 1);
  }

  evolve(id) {
    this.evolved.add(id);
  }

  isEvolved(id) {
    return this.evolved.has(id);
  }

  /** Damage roll: crits double. Returns { damage, crit }. */
  rollDamage(base, player) {
    const crit = Math.random() < player.critChance;
    return { damage: crit ? base * 2 : base, crit };
  }

  nearestEnemy(x, y, enemies, maxDist = Infinity) {
    let best = null;
    let bestDist = maxDist;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  update(dt, player, enemies, particles, sfx, onDamage) {
    const rate = player.rateMultiplier;
    // --- Spark Gun: bolts at the nearest enemy ---
    if (this.level('spark') > 0) {
      this.cooldowns.spark -= dt;
      const cfg = WEAPONS.spark.levels[this.level('spark') - 1];
      if (this.cooldowns.spark <= 0) {
        const target = this.nearestEnemy(player.x, player.y, enemies, 620);
        if (target) {
          this.cooldowns.spark = 1 / (cfg.rate * rate);
          const count = cfg.count;
          const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
          for (let i = 0; i < count; i += 1) {
            const spread = (i - (count - 1) / 2) * 0.16;
            this.projectiles.push({
              kind: 'bolt', x: player.x, y: player.y,
              vx: Math.cos(baseAngle + spread) * WEAPONS.spark.projectileSpeed,
              vy: Math.sin(baseAngle + spread) * WEAPONS.spark.projectileSpeed,
              damage: cfg.damage, pierce: cfg.pierce, radius: 6, life: 1.4, hitIds: new Set(),
              chain: this.isEvolved('tesla') ? 3 : 0,
            });
          }
          sfx.shoot();
        } else {
          this.cooldowns.spark = 0.1;
        }
      }
    }

    // --- Wrench Boomerang: flies out, comes back, hurts both ways ---
    if (this.level('wrench') > 0) {
      this.cooldowns.wrench -= dt;
      const cfg = WEAPONS.wrench.levels[this.level('wrench') - 1];
      if (this.cooldowns.wrench <= 0) {
        const target = this.nearestEnemy(player.x, player.y, enemies, 700);
        if (target) {
          this.cooldowns.wrench = 1 / (cfg.rate * rate);
          const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
          for (let i = 0; i < cfg.count; i += 1) {
            const spread = (i - (cfg.count - 1) / 2) * 0.5;
            this.projectiles.push({
              kind: 'wrench', x: player.x, y: player.y,
              vx: Math.cos(baseAngle + spread) * WEAPONS.wrench.projectileSpeed,
              vy: Math.sin(baseAngle + spread) * WEAPONS.wrench.projectileSpeed,
              damage: cfg.damage, pierce: 99, radius: 13, life: 3,
              hitIds: new Set(), returning: false, homeX: player.x, homeY: player.y,
              range: cfg.range, travelled: 0,
            });
          }
          sfx.shoot();
        } else {
          this.cooldowns.wrench = 0.1;
        }
      }
    }

    // --- Saw Orbit: blades circle the player and shred on contact ---
    if (this.level('saw') > 0) {
      const cfg = WEAPONS.saw.levels[this.level('saw') - 1];
      const blades = this.isEvolved('gyro') ? 6 : cfg.count;
      const radius = this.isEvolved('gyro') ? 170 : cfg.radius;
      this.sawAngle += cfg.spin * dt * rate;
      this.sawTick -= dt;
      if (this.sawTick <= 0) {
        this.sawTick = cfg.tick;
        for (let i = 0; i < blades; i += 1) {
          const a = this.sawAngle + (i * Math.PI * 2) / blades;
          const bx = player.x + Math.cos(a) * radius;
          const by = player.y + Math.sin(a) * radius;
          for (const e of enemies) {
            if (!e.alive) continue;
            if (Math.hypot(e.x - bx, e.y - by) < e.radius + 14) {
              const { damage, crit } = this.rollDamage(cfg.damage + (this.isEvolved('gyro') ? 6 : 0), player);
              onDamage(e, damage, crit, bx, by);
            }
          }
        }
      }
    }

    // --- Magnet Nova: periodic AoE pulse with knockback ---
    if (this.level('nova') > 0) {
      this.cooldowns.nova -= dt;
      const cfg = WEAPONS.nova.levels[this.level('nova') - 1];
      if (this.cooldowns.nova <= 0) {
        this.cooldowns.nova = cfg.cooldown / rate;
        this.novaFx = { x: player.x, y: player.y, radius: cfg.radius, life: 0.35, maxLife: 0.35 };
        particles.ring(player.x, player.y, { color: '#2ec4b6', maxRadius: cfg.radius, life: 0.35 });
        for (const e of enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.x - player.x, e.y - player.y);
          if (d < cfg.radius + e.radius) {
            const { damage, crit } = this.rollDamage(cfg.damage, player);
            onDamage(e, damage, crit, e.x, e.y);
            const nx = (e.x - player.x) / (d || 1);
            const ny = (e.y - player.y) / (d || 1);
            e.knockback(nx, ny, e.type === 'boss' ? cfg.knock * 0.1 : cfg.knock);
          }
        }
        sfx.nova();
      }
    }

    // --- Oil Slick: burning puddles under the nearest enemies ---
    if (this.level('slick') > 0) {
      this.cooldowns.slick -= dt;
      const cfg = WEAPONS.slick.levels[this.level('slick') - 1];
      if (this.cooldowns.slick <= 0) {
        const target = this.nearestEnemy(player.x, player.y, enemies, 520);
        if (target) {
          this.cooldowns.slick = cfg.cooldown / rate;
          this.slicks.push({ x: target.x, y: target.y, radius: cfg.radius, damage: cfg.damage, life: cfg.duration, tick: 0 });
        } else {
          this.cooldowns.slick = 0.1;
        }
      }
    }
    // Slicks burn and slow.
    for (let i = this.slicks.length - 1; i >= 0; i -= 1) {
      const s = this.slicks[i];
      s.life -= dt;
      s.tick -= dt;
      if (s.life <= 0) { this.slicks.splice(i, 1); continue; }
      if (s.tick <= 0) {
        s.tick = 0.5;
        for (const e of enemies) {
          if (!e.alive) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) < s.radius + e.radius * 0.5) {
            e.applySlow(WEAPONS.slick.slow, 0.8);
            const { damage, crit } = this.rollDamage(s.damage, player);
            onDamage(e, damage, crit, e.x, e.y - 10);
          }
        }
      }
    }

    this.updateProjectiles(dt, enemies, particles, onDamage, player);
    this.updateGlobs(dt, player);
    if (this.novaFx) {
      this.novaFx.life -= dt;
      if (this.novaFx.life <= 0) this.novaFx = null;
    }
  }

  updateProjectiles(dt, enemies, particles, onDamage, player) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) { this.projectiles.splice(i, 1); continue; }
      if (p.kind === 'wrench') {
        p.travelled += Math.hypot(p.vx, p.vy) * dt;
        if (!p.returning && p.travelled >= p.range) p.returning = true;
        if (p.returning) {
          const dx = player.x - p.x;
          const dy = player.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const speed = WEAPONS.wrench.projectileSpeed;
          p.vx = (dx / d) * speed;
          p.vy = (dy / d) * speed;
          if (d < 24) { this.projectiles.splice(i, 1); continue; }
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      for (const e of enemies) {
        if (!e.alive || p.hitIds.has(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
          p.hitIds.add(e.id);
          const { damage, crit } = this.rollDamage(p.damage, player);
          onDamage(e, damage, crit, p.x, p.y);
          particles.burst(p.x, p.y, { count: 3, color: p.kind === 'bolt' ? '#ffe66d' : '#ffb347', speed: 120, life: 0.25, size: 2 });
          // Tesla Storm: chain to nearby machines.
          if (p.kind === 'bolt' && p.chain > 0) {
            let from = e;
            let remaining = p.chain;
            while (remaining > 0) {
              let next = null;
              let best = 170;
              for (const other of enemies) {
                if (!other.alive || other.id === from.id || p.hitIds.has(other.id)) continue;
                const d = Math.hypot(other.x - from.x, other.y - from.y);
                if (d < best) { best = d; next = other; }
              }
              if (!next) break;
              p.hitIds.add(next.id);
              const chained = this.rollDamage(p.damage * 0.7, player);
              onDamage(next, chained.damage, chained.crit, next.x, next.y);
              particles.burst(next.x, next.y, { count: 4, color: '#7ee0ff', speed: 130, life: 0.25, size: 2 });
              from = next;
              remaining -= 1;
            }
          }
          if (p.pierce <= 0) {
            this.projectiles.splice(i, 1);
            break;
          }
          p.pierce -= 1;
        }
      }
    }
  }

  updateGlobs(dt, player) {
    for (let i = this.globs.length - 1; i >= 0; i -= 1) {
      const g = this.globs[i];
      g.life -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (g.life <= 0) { this.globs.splice(i, 1); continue; }
      if (Math.hypot(g.x - player.x, g.y - player.y) < player.radius + g.radius) {
        this.globs.splice(i, 1);
        g.hitPlayer = true;
      }
    }
  }

  /** A spitter fires a glob at the player. */
  spit(from, player) {
    const dx = player.x - from.x;
    const dy = player.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    this.globs.push({
      x: from.x, y: from.y,
      vx: (dx / d) * 260, vy: (dy / d) * 260,
      damage: from.damage, radius: 8, life: 2.5, hitPlayer: false,
    });
  }

  /** Current saw blade positions, for rendering. */
  sawBlades(player) {
    if (this.level('saw') <= 0) return [];
    const cfg = WEAPONS.saw.levels[this.level('saw') - 1];
    const blades = this.isEvolved('gyro') ? 6 : cfg.count;
    const radius = this.isEvolved('gyro') ? 170 : cfg.radius;
    const out = [];
    for (let i = 0; i < blades; i += 1) {
      const a = this.sawAngle + (i * Math.PI * 2) / blades;
      out.push({ x: player.x + Math.cos(a) * radius, y: player.y + Math.sin(a) * radius, angle: this.sawAngle * 3 });
    }
    return out;
  }

  drawSlicks(ctx) {
    for (const s of this.slicks) {
      ctx.globalAlpha = 0.5 + (s.life > 1 ? 0 : s.life * 0.4);
      ctx.fillStyle = '#1a0f08';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8722a';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.radius * 0.7, s.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  draw(ctx, player) {
    this.drawSlicks(ctx);
    // Saw blades
    for (const b of this.sawBlades(player)) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = '#c9d6dd';
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI * 2) / 8;
        const a2 = a + Math.PI / 8;
        ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
        ctx.lineTo(Math.cos(a2) * 8, Math.sin(a2) * 8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8722a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Projectiles
    for (const p of this.projectiles) {
      if (p.kind === 'bolt') {
        ctx.fillStyle = '#ffe66d';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff8d6';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(performance.now() / 60);
        ctx.fillStyle = '#8fa8b5';
        ctx.fillRect(-9, -3, 18, 6);
        ctx.beginPath();
        ctx.arc(-9, 0, 6, 0, Math.PI * 2);
        ctx.arc(9, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1b26';
        ctx.beginPath();
        ctx.arc(-9, 0, 3, 0, Math.PI * 2);
        ctx.arc(9, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    // Enemy globs
    for (const g of this.globs) {
      ctx.fillStyle = '#7ee081';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c86dd7';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
