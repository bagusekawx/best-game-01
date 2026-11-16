// BOLT, the player: a little scrap-bot. Movement, dash, damage, healing, derived stats.
import { ARENA, PLAYER_BASE, PASSIVES } from './config.js';

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = ARENA.width / 2;
    this.y = ARENA.height / 2;
    this.radius = PLAYER_BASE.radius;
    this.level = 1;
    this.xp = 0;
    this.hp = PLAYER_BASE.maxHp;
    this.facing = 1; // 1 right, -1 left
    this.walkCycle = 0;
    this.moving = false;
    // Dash state
    this.dashing = 0;
    this.dashCooldown = 0;
    this.dashDx = 0;
    this.dashDy = 0;
    this.invulnerable = 0; // grace timer after a hit
    this.hurtFlash = 0;
    // Passive levels, e.g. { treads: 2, magnet: 1 }
    this.passives = {};
    this.regenCarry = 0;
  }

  passiveLevel(id) {
    return this.passives[id] || 0;
  }

  /** Stats after passives. Called by the systems that need them. */
  get speed() {
    return PLAYER_BASE.speed * (1 + this.passiveLevel('treads') * PASSIVES.treads.per);
  }

  get maxHp() {
    return PLAYER_BASE.maxHp + this.passiveLevel('plating') * PASSIVES.plating.per;
  }

  get armor() {
    return this.passiveLevel('plating'); // flat damage reduction per hit
  }

  get magnetRadius() {
    return PLAYER_BASE.magnet * (1 + this.passiveLevel('magnet') * PASSIVES.magnet.per);
  }

  get rateMultiplier() {
    return 1 + this.passiveLevel('overclock') * PASSIVES.overclock.per;
  }

  get critChance() {
    return this.passiveLevel('lucky') * PASSIVES.lucky.per;
  }

  get regen() {
    return this.passiveLevel('coolant') * PASSIVES.coolant.per;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addPassive(id) {
    this.passives[id] = this.passiveLevel(id) + 1;
    if (id === 'plating') this.heal(PASSIVES.plating.per); // plating tops the new health up
  }

  /** Returns true when the hit actually landed (not dodged by grace/dash). */
  takeDamage(amount) {
    if (this.invulnerable > 0 || this.dashing > 0) return false;
    const dealt = Math.max(1, amount - this.armor);
    this.hp -= dealt;
    this.invulnerable = PLAYER_BASE.contactGrace;
    this.hurtFlash = 0.18;
    return true;
  }

  tryDash(dx, dy) {
    if (this.dashCooldown > 0 || (dx === 0 && dy === 0)) return false;
    this.dashing = PLAYER_BASE.dashTime;
    this.dashCooldown = PLAYER_BASE.dashCooldown;
    this.dashDx = dx;
    this.dashDy = dy;
    return true;
  }

  update(dt, move) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.regen > 0) {
      this.regenCarry += this.regen * dt;
      if (this.regenCarry >= 1) {
        this.heal(Math.floor(this.regenCarry));
        this.regenCarry %= 1;
      }
    }

    if (this.dashing > 0) {
      this.dashing -= dt;
      const dashSpeed = PLAYER_BASE.dashDistance / PLAYER_BASE.dashTime;
      this.x += this.dashDx * dashSpeed * dt;
      this.y += this.dashDy * dashSpeed * dt;
    } else if (move.x !== 0 || move.y !== 0) {
      this.x += move.x * this.speed * dt;
      this.y += move.y * this.speed * dt;
      this.moving = true;
      this.walkCycle += dt * 11;
      if (move.x !== 0) this.facing = move.x > 0 ? 1 : -1;
    } else {
      this.moving = false;
    }

    this.x = Math.max(this.radius + 10, Math.min(ARENA.width - this.radius - 10, this.x));
    this.y = Math.max(this.radius + 10, Math.min(ARENA.height - this.radius - 10, this.y));
  }

  draw(ctx) {
    const bob = this.moving ? Math.sin(this.walkCycle) * 2 : Math.sin(performance.now() / 400) * 1;
    // Soft teal glow under the bot so it reads against the dark yard.
    const glow = ctx.createRadialGradient(this.x, this.y + 8, 4, this.x, this.y + 8, 34);
    glow.addColorStop(0, 'rgba(46, 196, 182, 0.35)');
    glow.addColorStop(1, 'rgba(46, 196, 182, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y + 8, 34, 0, Math.PI * 2);
    ctx.fill();
    // White ring marking the bot's space, so it pops in a crowd.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    if (this.dashing > 0) ctx.globalAlpha = 0.75;
    if (this.invulnerable > 0 && Math.floor(performance.now() / 90) % 2 === 0) ctx.globalAlpha = 0.45;

    // Treads
    ctx.fillStyle = '#1c2b33';
    ctx.fillRect(-15, 8, 30, 9);
    ctx.fillStyle = '#31454f';
    for (let i = -12; i <= 12; i += 8) ctx.fillRect(i, 10, 4, 5);

    // Body — a dented little boiler with a teal shell
    ctx.fillStyle = this.hurtFlash > 0 ? '#ff6b6b' : '#2ec4b6';
    ctx.beginPath();
    ctx.roundRect(-14, -12, 28, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#1f8f84';
    ctx.fillRect(-14, 2, 28, 4);
    // Rivets
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(-10, -8, 2, 0, Math.PI * 2);
    ctx.arc(10, -8, 2, 0, Math.PI * 2);
    ctx.fill();

    // Head dome + eye
    ctx.fillStyle = '#8fa8b5';
    ctx.beginPath();
    ctx.arc(0, -14, 9, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#0d1b26';
    ctx.beginPath();
    ctx.arc(this.facing * 3, -15, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.arc(this.facing * 4.5, -15, 2, 0, Math.PI * 2);
    ctx.fill();
    // Antenna
    ctx.strokeStyle = '#8fa8b5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(0, -29);
    ctx.stroke();
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(0, -31, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Arms
    ctx.strokeStyle = '#8fa8b5';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.lineTo(-19, 4);
    ctx.moveTo(13, -4);
    ctx.lineTo(19, 4);
    ctx.stroke();
    ctx.restore();
  }
}
