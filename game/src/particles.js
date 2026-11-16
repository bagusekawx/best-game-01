// Particles, damage numbers, floating text and screen shake — the juice.
export class Particles {
  constructor() {
    this.list = [];
    this.numbers = [];
    this.shakeTime = 0;
    this.shakePower = 0;
  }

  burst(x, y, { count = 10, color = '#ffb347', speed = 180, life = 0.5, size = 3, gravity = 0 } = {}) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.list.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 40,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color, gravity,
      });
    }
    if (this.list.length > 500) this.list.splice(0, this.list.length - 500);
  }

  ring(x, y, { color = '#2ec4b6', maxRadius = 120, life = 0.35 } = {}) {
    this.list.push({ x, y, vx: 0, vy: 0, life, maxLife: life, size: 2, color, ring: true, maxRadius, gravity: 0 });
  }

  damageNumber(x, y, value, { crit = false, color = null } = {}) {
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 14, y: y - 10,
      vy: -66, life: 0.7, maxLife: 0.7,
      text: String(Math.round(value)),
      color: color || (crit ? '#ffd94d' : '#ffffff'),
      size: crit ? 19 : 14,
    });
    if (this.numbers.length > 80) this.numbers.splice(0, this.numbers.length - 80);
  }

  floatText(x, y, text, color = '#7ee081', size = 16) {
    this.numbers.push({ x, y, vy: -44, life: 1.0, maxLife: 1.0, text, color, size });
  }

  shake(power, time = 0.25) {
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  /** Current camera offset from the shake; call once per frame. */
  shakeOffset(dt) {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    this.shakeTime -= dt;
    const p = this.shakePower * Math.max(0, this.shakeTime / 0.25);
    if (this.shakeTime <= 0) this.shakePower = 0;
    return { x: (Math.random() - 0.5) * 2 * p, y: (Math.random() - 0.5) * 2 * p };
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    for (let i = this.numbers.length - 1; i >= 0; i -= 1) {
      const n = this.numbers[i];
      n.life -= dt;
      if (n.life <= 0) { this.numbers.splice(i, 1); continue; }
      n.y += n.vy * dt;
      n.vy *= 0.94;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      if (p.ring) {
        const r = p.maxRadius * (1 - a);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    for (const n of this.numbers) {
      const a = Math.max(0, n.life / n.maxLife);
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `800 ${n.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,18,24,0.9)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  }
}
