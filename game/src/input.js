// Keyboard + mouse state. The game reads this, never the raw events.
export const keys = new Set();
export const mouse = { x: 0, y: 0, down: false };
let dashQueued = false;
let pauseQueued = false;
let virtualMove = null; // set by the screenshot autopilot; overrides the keys

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];

export function initInput(canvas) {
  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS.includes(event.code) || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') dashQueued = true;
    if (event.code === 'KeyP' || event.code === 'Escape') pauseQueued = true;
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', () => { mouse.down = true; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
}

/** Normalised move vector from WASD/arrows, or {x:0,y:0} when idle. */
export function moveVector() {
  if (virtualMove) return virtualMove;
  const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}

/** Screenshot autopilot controls: steer without a keyboard. */
export function setVirtualMove(x, y) {
  virtualMove = { x, y };
}

export function clearVirtual() {
  virtualMove = null;
}

export function queueDash() {
  dashQueued = true;
}

export function consumeDash() {
  const q = dashQueued;
  dashQueued = false;
  return q;
}

export function consumePause() {
  const q = pauseQueued;
  pauseQueued = false;
  return q;
}

export function clearQueues() {
  dashQueued = false;
  pauseQueued = false;
}
