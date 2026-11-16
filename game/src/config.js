// SCRAPHEAP — tuning tables and constants. Every number the game balances on lives here.
export const VIEW = { width: 1280, height: 720 };
export const ARENA = { width: 2400, height: 1600 };
export const RUN_SECONDS = 360; // survive this long, then the Compactor shows up
export const STEP = 1 / 60; // fixed simulation step

export const PALETTE = {
  sky: '#0d1b26',
  ground: '#14242e',
  groundDark: '#0f1c24',
  grid: '#1b2f3a',
  rust: '#e8722a',
  amber: '#ffb347',
  teal: '#2ec4b6',
  steel: '#8fa8b5',
  bone: '#f2e8d5',
  danger: '#ff4d4d',
  slime: '#7ee081',
};

export const DIFFICULTY = {
  chill: { label: 'CHILL', enemyHp: 0.7, enemyDamage: 0.7, enemySpeed: 0.95, score: 0.75, hint: 'Relaxed run. Fewer, softer machines.' },
  normal: { label: 'NORMAL', enemyHp: 1, enemyDamage: 1, enemySpeed: 1, score: 1, hint: 'The junkyard as it is. Fair and mean.' },
  hell: { label: 'SCRAPYARD HELL', enemyHp: 1.5, enemyDamage: 1.4, enemySpeed: 1.1, score: 1.5, hint: 'More machines. Meaner machines. 1.5x score.' },
};

export const PLAYER_BASE = {
  radius: 16,
  speed: 235,
  maxHp: 100,
  magnet: 90,
  dashDistance: 300,
  dashTime: 0.16,
  dashCooldown: 2.2,
  contactGrace: 0.5, // seconds of invulnerability after a hit
};

export const XP_FOR_LEVEL = (level) => 6 + level * 5; // scrap needed to go from `level` to `level + 1`

// Weapons. `level` tables are 1-based; index 0 is level 1.
export const WEAPONS = {
  spark: {
    name: 'Spark Gun', icon: '⚡', blurb: 'Bolts of live current at the nearest machine.',
    max: 5,
    levels: [
      { damage: 10, rate: 2.4, count: 1, pierce: 0 },
      { damage: 12, rate: 2.7, count: 1, pierce: 0 },
      { damage: 13, rate: 3.0, count: 2, pierce: 0 },
      { damage: 15, rate: 3.2, count: 2, pierce: 1 },
      { damage: 18, rate: 3.6, count: 3, pierce: 1 },
    ],
    projectileSpeed: 560,
  },
  wrench: {
    name: 'Wrench Boomerang', icon: '🔧', blurb: 'A heavy wrench that flies out and comes back swinging.',
    max: 5,
    levels: [
      { damage: 15, rate: 0.9, count: 1, range: 250 },
      { damage: 18, rate: 1.0, count: 1, range: 270 },
      { damage: 20, rate: 1.1, count: 2, range: 290 },
      { damage: 24, rate: 1.2, count: 2, range: 310 },
      { damage: 28, rate: 1.4, count: 3, range: 340 },
    ],
    projectileSpeed: 520,
  },
  saw: {
    name: 'Saw Orbit', icon: '🌀', blurb: 'Buzzsaws circling you, shredding anything close.',
    max: 5,
    levels: [
      { damage: 9, count: 2, radius: 95, spin: 2.6, tick: 0.35 },
      { damage: 11, count: 2, radius: 105, spin: 2.8, tick: 0.33 },
      { damage: 12, count: 3, radius: 115, spin: 3.0, tick: 0.32 },
      { damage: 14, count: 3, radius: 125, spin: 3.2, tick: 0.30 },
      { damage: 17, count: 4, radius: 140, spin: 3.5, tick: 0.28 },
    ],
  },
  nova: {
    name: 'Magnet Nova', icon: '🧲', blurb: 'A magnetic pulse that blasts the whole crowd back.',
    max: 5,
    levels: [
      { damage: 12, radius: 140, cooldown: 3.4, knock: 320 },
      { damage: 16, radius: 160, cooldown: 3.2, knock: 340 },
      { damage: 20, radius: 185, cooldown: 3.0, knock: 370 },
      { damage: 26, radius: 210, cooldown: 2.8, knock: 400 },
      { damage: 34, radius: 240, cooldown: 2.5, knock: 440 },
    ],
  },
  slick: {
    name: 'Oil Slick', icon: '🛢️', blurb: 'Drops burning oil under the nearest machines.',
    max: 5,
    levels: [
      { damage: 7, radius: 70, cooldown: 1.7, duration: 3.0 },
      { damage: 9, radius: 80, cooldown: 1.6, duration: 3.2 },
      { damage: 11, radius: 90, cooldown: 1.5, duration: 3.5 },
      { damage: 14, radius: 100, cooldown: 1.4, duration: 3.8 },
      { damage: 18, radius: 115, cooldown: 1.2, duration: 4.2 },
    ],
    slow: 0.55,
  },
};

// Passive upgrades. `apply` is read by the player stat derivation in player.js.
export const PASSIVES = {
  treads: { name: 'Turbo Treads', icon: '🦶', blurb: '+8% move speed.', max: 5, per: 0.08, stat: 'speed' },
  plating: { name: 'Scrap Plating', icon: '🛡️', blurb: '+20 max HP, +1 armor.', max: 5, per: 20, stat: 'plating' },
  magnet: { name: 'Junk Magnet', icon: '🧲', blurb: '+35% pickup radius.', max: 5, per: 0.35, stat: 'magnet' },
  overclock: { name: 'Overclock', icon: '⏱️', blurb: '+8% attack rate.', max: 5, per: 0.08, stat: 'rate' },
  lucky: { name: 'Lucky Bolt', icon: '🍀', blurb: '+6% crit chance (crits hit double).', max: 5, per: 0.06, stat: 'crit' },
  coolant: { name: 'Coolant Loop', icon: '💧', blurb: 'Regenerate +0.6 HP/s.', max: 5, per: 0.6, stat: 'regen' },
};

// Evolutions: a maxed weapon plus enough of its partner passive becomes something better.
export const EVOLUTIONS = [
  {
    id: 'tesla', weapon: 'spark', passive: 'overclock', passiveLevel: 3,
    name: 'TESLA STORM', icon: '🌩️',
    blurb: 'Spark Gun evolved: every bolt chains lightning to 3 more machines.',
  },
  {
    id: 'gyro', weapon: 'saw', passive: 'magnet', passiveLevel: 3,
    name: 'GYRO RING', icon: '💿',
    blurb: 'Saw Orbit evolved: 6 blades, wider ring, heavier cuts.',
  },
];

export const ENEMIES = {
  toaster: { name: 'Toaster', hp: 18, speed: 96, damage: 8, xp: 1, radius: 15, score: 10, color: '#e8722a' },
  drone: { name: 'Sweeper Drone', hp: 10, speed: 168, damage: 6, xp: 1, radius: 11, score: 10, color: '#ffb347' },
  fridge: { name: 'Fridge Golem', hp: 95, speed: 54, damage: 16, xp: 3, radius: 26, score: 30, color: '#8fa8b5' },
  splitter: { name: 'Splitter', hp: 32, speed: 82, damage: 8, xp: 2, radius: 16, score: 20, color: '#7ee081' },
  mini: { name: 'Mini Split', hp: 9, speed: 132, damage: 5, xp: 1, radius: 9, score: 5, color: '#a8e6a1' },
  spitter: { name: 'Acid Spitter', hp: 26, speed: 72, damage: 6, xp: 2, radius: 14, score: 20, color: '#c86dd7' },
  boss: { name: 'THE COMPACTOR', hp: 2400, speed: 68, damage: 25, xp: 60, radius: 58, score: 1000, color: '#ff4d4d' },
};

// When each enemy type joins the spawn pool (seconds into the run).
export const UNLOCK_AT = { toaster: 0, drone: 30, splitter: 90, fridge: 120, spitter: 180 };
// Enemy HP scales with run time so late waves stay dangerous.
export const hpScaleAt = (t) => 1 + t / 110;
export const ELITE_FROM = 120; // elites (big, tough, drop a chest) can spawn after this
export const ELITE_CHANCE = 0.05;

export const PICKUPS = {
  scrapMagnetSpeed: 620, // how fast scrap flies to the player inside the magnet radius
  healAmount: 25,
  chestHeal: 10,
};
