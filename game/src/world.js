// The junkyard: arena bounds, scattered debris, camera and background rendering.
import { ARENA, VIEW, PALETTE } from './config.js';
import { makeRng, range } from './random.js';

const DEBRIS_TYPES = ['tire', 'can', 'plate', 'pipe', 'crate', 'coil'];

// Deterministic debris field so the yard looks the same every run.
function buildDebris(seed) {
  const rng = makeRng(seed);
  const debris = [];
  for (let i = 0; i < 220; i += 1) {
    debris.push({
      x: range(rng, 30, ARENA.width - 30),
      y: range(rng, 30, ARENA.height - 30),
      type: DEBRIS_TYPES[Math.floor(rng() * DEBRIS_TYPES.length)],
      angle: rng() * Math.PI * 2,
      scale: range(rng, 0.7, 1.6),
      shade: range(rng, 0.75, 1.1),
    });
  }
  return debris;
}

export class World {
  constructor(seed = 1337) {
    this.debris = buildDebris(seed);
    this.camera = { x: ARENA.width / 2 - VIEW.width / 2, y: ARENA.height / 2 - VIEW.height / 2 };
    this.time = 0;
  }

  reset() {
    this.time = 0;
    this.camera.x = ARENA.width / 2 - VIEW.width / 2;
    this.camera.y = ARENA.height / 2 - VIEW.height / 2;
  }

  /** Keep the camera on the player, clamped to the arena. */
  follow(x, y, shake) {
    const targetX = x - VIEW.width / 2;
    const targetY = y - VIEW.height / 2;
    this.camera.x += (targetX - this.camera.x) * 0.18;
    this.camera.y += (targetY - this.camera.y) * 0.18;
    this.camera.x = Math.max(0, Math.min(ARENA.width - VIEW.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(ARENA.height - VIEW.height, this.camera.y));
    if (shake) {
      this.camera.x += shake.x;
      this.camera.y += shake.y;
    }
  }

  drawBackground(ctx) {
    const { x: cx, y: cy } = this.camera;
    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    // Ground slab with a subtle checker of worn concrete.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(-cx, -cy, ARENA.width, ARENA.height);
    const tile = 120;
    ctx.fillStyle = PALETTE.groundDark;
    const startX = Math.max(0, Math.floor(cx / tile) * tile);
    const startY = Math.max(0, Math.floor(cy / tile) * tile);
    for (let gx = startX; gx < Math.min(ARENA.width, cx + VIEW.width + tile); gx += tile) {
      for (let gy = startY; gy < Math.min(ARENA.height, cy + VIEW.height + tile); gy += tile) {
        if (((gx / tile) + (gy / tile)) % 2 === 0) ctx.fillRect(gx - cx, gy - cy, tile, tile);
      }
    }

    // Fence around the yard.
    ctx.strokeStyle = '#e8722a';
    ctx.lineWidth = 6;
    ctx.setLineDash([26, 14]);
    ctx.strokeRect(-cx + 8, -cy + 8, ARENA.width - 16, ARENA.height - 16);
    ctx.setLineDash([]);

    // Debris, only what is on screen.
    for (const d of this.debris) {
      const sx = d.x - cx;
      const sy = d.y - cy;
      if (sx < -50 || sx > VIEW.width + 50 || sy < -50 || sy > VIEW.height + 50) continue;
      this.drawDebris(ctx, d, sx, sy);
    }
  }

  drawDebris(ctx, d, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(d.angle);
    ctx.scale(d.scale, d.scale);
    ctx.globalAlpha = 0.55 * d.shade;
    if (d.type === 'tire') {
      ctx.strokeStyle = '#1c2b33';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#31454f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (d.type === 'can') {
      ctx.fillStyle = '#b0483e';
      ctx.fillRect(-5, -9, 10, 18);
      ctx.fillStyle = '#d8cdb4';
      ctx.fillRect(-5, -9, 10, 4);
    } else if (d.type === 'plate') {
      ctx.fillStyle = '#3d5563';
      ctx.fillRect(-16, -9, 32, 18);
      ctx.fillStyle = '#55707d';
      ctx.fillRect(-16, -9, 32, 4);
    } else if (d.type === 'pipe') {
      ctx.fillStyle = '#6b7f88';
      ctx.fillRect(-18, -4, 36, 8);
      ctx.fillStyle = '#46565e';
      ctx.beginPath();
      ctx.arc(18, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.type === 'crate') {
      ctx.strokeStyle = '#7a5a2e';
      ctx.lineWidth = 3;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.beginPath();
      ctx.moveTo(-11, -11);
      ctx.lineTo(11, 11);
      ctx.moveTo(11, -11);
      ctx.lineTo(-11, 11);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#c9862f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
