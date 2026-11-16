# SCRAPHEAP — a junkyard survivor

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/bagusekawx/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/bagusekawx/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

The junkyard woke up angry. You are BOLT, one small bot with a spark gun and a bad attitude. Survive **6 minutes** of rogue appliances, then scrap **THE COMPACTOR** — a walking trash compactor with a slam attack, a charge, and minions.

An arena-survivor roguelite in vanilla JS + canvas, no libraries, no network: 5 weapons, 6 passives, 2 evolutions, level-up drafts, elites and chests, 6 enemy types, a boss, 3 difficulties, endless mode after the win, and synthesized WebAudio sound.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

WASD / arrows to move, SPACE to dash (invulnerable), P to pause, M to mute. Weapons fire on their own — your job is positioning, dodging, and picking the right upgrades.

## How it is built

```
game/
  index.html        canvas + DOM HUD and screens
  style.css         junkyard-dusk UI
  src/
    main.js         boot, loop, state machine, combat resolution
    config.js       tuning tables: weapons, passives, enemies, difficulties
    enemies.js      enemy types, elites, the Compactor boss, spawn director
    weapons.js      five auto-firing weapons, evolutions, projectiles
    upgrades.js     level-up draft pool and evolution rules
    player.js       BOLT: movement, dash, damage, derived stats
    world.js        arena, debris field, camera, background
    pickups.js      scrap, heals, magnets, bombs, chests
    particles.js    particles, damage numbers, screen shake
    audio.js        synthesized WebAudio SFX + music (no audio files)
    ui.js           HUD, screens, banners, draft cards, stats
    shots.js        ?shot=title|play|win|over staging via autopilot
    input.js        keyboard + mouse state (+ virtual input for shots)
    save.js         best score / time / wins in localStorage
    random.js       seeded RNG
```

## Run it (the entry program)

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=2vrn35hh&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
