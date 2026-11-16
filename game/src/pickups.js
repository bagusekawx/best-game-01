// Pickups: scrap (XP), oil cans (heal), magnets (vacuum), bombs and chests.
import { PICKUPS } from './config.js';

export class Pickups {
  constructor() {
    this.list = [];
  }

  reset() {
    this.list = [];
  }

  dropScrap(x, y, amount) {
    // Cap the scrap on the ground: merge into the nearest pile when crowded.
    if (this.list.length > 260) {
      let nearest = null;
      let best = Infinity;
      for (const p of this.list) {
        if (p.kind !== 'scrap') continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best) { best = d; nearest = p; }
      }
      if (nearest) { nearest.amount += amount; return; }
    }
    this.list.push({
      kind: 'scrap', x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 24,
      amount, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
      magnetized: false, life: 45,
    });
  }

  dropSpecial(kind, x, y) {
    this.list.push({ kind, x, y, amount: 0, vx: 0, vy: 0, magnetized: false, life: 20 });
  }

  /** Vacuum every scrap on the ground toward the player. */
  vacuumAll() {
    for (const p of this.list) if (p.kind === 'scrap') p.magnetized = true;
  }

  /** Move scrap toward the player when in magnet range; returns collected pickups. */
  update(dt, player) {
    const collected = [];
    const magnetR = player.magnetRadius;
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (p.kind === 'scrap') {
        if (p.magnetized || dist < magnetR) {
          p.magnetized = true;
          const pull = PICKUPS.scrapMagnetSpeed * (1.6 - Math.min(1, dist / 500));
          p.x += (dx / dist) * pull * dt;
          p.y += (dy / dist) * pull * dt;
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.92;
          p.vy *= 0.92;
        }
      }
      if (dist < player.radius + 12) {
        collected.push(p);
        this.list.splice(i, 1);
      }
    }
    return collected;
  }

  draw(ctx) {
    for (const p of this.list) {
      if (p.kind === 'scrap') {
        const pulse = 1 + Math.sin(performance.now() / 180 + p.x) * 0.15;
        ctx.fillStyle = '#ffd94d';
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 4);
        ctx.scale(pulse, pulse);
        const s = p.amount >= 5 ? 7 : 5;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (p.kind === 'heal') {
        ctx.fillStyle = '#7ee081';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1b26';
        ctx.fillRect(p.x - 2, p.y - 6, 4, 12);
        ctx.fillRect(p.x - 6, p.y - 2, 12, 4);
      } else if (p.kind === 'magnet') {
        ctx.fillStyle = '#2ec4b6';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#0d1b26';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'bomb') {
        ctx.fillStyle = '#1c2b33';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + 5, p.y - 9);
        ctx.lineTo(p.x + 9, p.y - 14);
        ctx.stroke();
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.arc(p.x + 9, p.y - 15, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'chest') {
        ctx.fillStyle = '#8a5a2b';
        ctx.beginPath();
        ctx.roundRect(p.x - 13, p.y - 9, 26, 18, 3);
        ctx.fill();
        ctx.fillStyle = '#ffd94d';
        ctx.fillRect(p.x - 3, p.y - 9, 6, 18);
        ctx.fillRect(p.x - 13, p.y - 2, 26, 4);
      }
    }
  }
}
