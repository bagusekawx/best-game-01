// DOM UI: HUD, screens, banners, draft cards, stats. The canvas draws the world;
// this module owns everything the player reads.
import { WEAPONS, PASSIVES, RUN_SECONDS } from './config.js';

const $ = (id) => document.getElementById(id);
let bannerTimer = null;

export const SCREENS = ['title-screen', 'pause-screen', 'draft-screen', 'win-screen', 'over-screen'];

export function showOnly(screenId) {
  for (const id of SCREENS) $(id).classList.toggle('hidden', id !== screenId);
  $('hud').classList.toggle('hidden', screenId === 'title-screen');
}

export function showHudOnly() {
  for (const id of SCREENS) $(id).classList.add('hidden');
  $('hud').classList.remove('hidden');
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function showBanner(title, sub = '', ms = 2200) {
  const banner = $('banner');
  $('banner-title').textContent = title;
  $('banner-sub').textContent = sub;
  banner.classList.remove('hidden');
  if (bannerTimer) window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => banner.classList.add('hidden'), ms);
}

export function setBossWarning(show) {
  $('bosswarn').classList.toggle('hidden', !show);
}

export function updateHud(game) {
  const { player, weapons, time, kills, score, combo, boss, endless } = game;
  // XP bar
  const need = game.xpNeeded();
  $('xpfill').style.width = `${Math.min(100, (player.xp / need) * 100)}%`;
  $('xplabel').textContent = `LV ${player.level}`;
  // HP bar
  $('hpfill').style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  $('hplabel').textContent = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
  // Dash
  const dashReady = player.dashCooldown <= 0;
  $('dashfill').style.width = `${dashReady ? 100 : (1 - player.dashCooldown / 2.2) * 100}%`;
  // Timer + objective
  const remaining = RUN_SECONDS - time;
  const timerEl = $('timer');
  if (endless) {
    timerEl.textContent = `∞ ${formatTime(time)}`;
    timerEl.classList.remove('urgent');
    $('objective').textContent = 'Endless scrapping — how long can you last?';
  } else if (boss) {
    timerEl.textContent = 'BOSS';
    timerEl.classList.add('urgent');
    $('objective').textContent = 'Destroy THE COMPACTOR to win!';
  } else {
    timerEl.textContent = formatTime(remaining);
    timerEl.classList.toggle('urgent', remaining <= 30);
    $('objective').textContent = remaining <= 30
      ? 'The Compactor stirs...'
      : 'Survive until the Compactor arrives';
  }
  $('kills').textContent = `☠ ${kills}`;
  $('score').textContent = `SCORE ${score}`;
  const comboEl = $('combo');
  if (combo.count >= 5 && combo.timer > 0) {
    comboEl.classList.remove('hidden');
    comboEl.textContent = `COMBO ×${combo.count}`;
  } else {
    comboEl.classList.add('hidden');
  }
  // Boss bar
  if (boss && boss.alive) {
    $('bossbar').classList.remove('hidden');
    $('bossfill').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  } else {
    $('bossbar').classList.add('hidden');
  }
  // Weapon chips
  const chips = weapons.owned().map((id) => {
    const level = weapons.level(id);
    const evo = (id === 'spark' && weapons.isEvolved('tesla')) || (id === 'saw' && weapons.isEvolved('gyro'));
    const pips = Array.from({ length: 5 }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
    const icon = evo ? (id === 'spark' ? '🌩️' : '💿') : WEAPONS[id].icon;
    return `<div class="weapon-chip ${evo ? 'evolved' : ''}" title="${WEAPONS[id].name}">${icon}<span class="lvl">${evo ? 'MAX+' : `LV ${level}`}</span><span class="pips">${pips}</span></div>`;
  }).join('');
  const passiveChips = Object.keys(player.passives).map((id) => {
    const level = player.passives[id];
    return `<div class="weapon-chip" title="${PASSIVES[id].name}">${PASSIVES[id].icon}<span class="lvl">LV ${level}</span></div>`;
  }).join('');
  $('weapons').innerHTML = chips + passiveChips;
}

export function showDraft(cards, onPick) {
  const container = $('draft-cards');
  container.innerHTML = '';
  cards.forEach((card, index) => {
    const el = document.createElement('div');
    el.className = `draft-card${card.evolution ? ' evolution' : ''}`;
    el.innerHTML = `
      <div class="card-icon">${card.icon}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-level">${card.evolution ? '★ EVOLUTION ★' : `LEVEL ${card.level} / ${card.max}`}</div>
      <div class="card-blurb">${card.blurb}</div>
      <div class="card-key">PRESS ${index + 1}</div>`;
    el.addEventListener('click', () => onPick(card));
    container.appendChild(el);
  });
  showOnly('draft-screen');
}

export function fillStats(elementId, stats) {
  const el = $(elementId);
  el.innerHTML = stats.map((s) => `
    <div class="stat">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
      ${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}
    </div>`).join('');
}

export function setMuteButton(muted) {
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
}

export function setBestLine(best) {
  const el = $('best-line');
  if (best.runs === 0) {
    el.textContent = 'No runs yet — the heap awaits its first victim.';
  } else {
    el.textContent = `BEST ${best.score.toLocaleString()} pts · ${formatTime(best.time)} survived · ${best.wins} win${best.wins === 1 ? '' : 's'} in ${best.runs} run${best.runs === 1 ? '' : 's'}`;
  }
}
