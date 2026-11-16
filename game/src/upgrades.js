// Level-up drafts: the choices that shape a run. Three cards, pick one.
import { WEAPONS, PASSIVES, EVOLUTIONS } from './config.js';
import { shuffle } from './random.js';

/** All upgrades the player could still take right now. */
export function availableUpgrades(weapons, player) {
  const out = [];
  for (const id of Object.keys(WEAPONS)) {
    const level = weapons.level(id);
    if (level >= WEAPONS[id].max) continue;
    out.push({
      kind: 'weapon', id,
      name: level === 0 ? `New: ${WEAPONS[id].name}` : WEAPONS[id].name,
      icon: WEAPONS[id].icon,
      blurb: WEAPONS[id].blurb,
      level: level + 1, max: WEAPONS[id].max,
    });
  }
  for (const id of Object.keys(PASSIVES)) {
    const level = player.passiveLevel(id);
    if (level >= PASSIVES[id].max) continue;
    out.push({
      kind: 'passive', id,
      name: PASSIVES[id].name,
      icon: PASSIVES[id].icon,
      blurb: PASSIVES[id].blurb,
      level: level + 1, max: PASSIVES[id].max,
    });
  }
  // Evolutions appear once their weapon is maxed and the partner passive is high enough.
  for (const evo of EVOLUTIONS) {
    if (weapons.isEvolved(evo.id)) continue;
    if (weapons.level(evo.weapon) >= WEAPONS[evo.weapon].max && player.passiveLevel(evo.passive) >= evo.passiveLevel) {
      out.push({
        kind: 'evolution', id: evo.id,
        name: evo.name, icon: evo.icon, blurb: evo.blurb,
        level: 1, max: 1, evolution: true,
      });
    }
  }
  return out;
}

/** Roll `count` distinct draft cards. Falls back to a heal when nothing is left. */
export function rollDraft(weapons, player, rng, count = 3) {
  const pool = shuffle(rng, availableUpgrades(weapons, player));
  const cards = pool.slice(0, count);
  if (cards.length === 0) {
    return [{
      kind: 'heal', id: 'heal', name: 'Oil Top-Up', icon: '🛢️',
      blurb: 'Nothing left to build. Restore 40 HP instead.',
      level: 1, max: 1,
    }];
  }
  return cards;
}

export function applyUpgrade(choice, weapons, player) {
  if (choice.kind === 'weapon') weapons.addLevel(choice.id);
  else if (choice.kind === 'passive') player.addPassive(choice.id);
  else if (choice.kind === 'evolution') weapons.evolve(choice.id);
  else if (choice.kind === 'heal') player.heal(40);
}
