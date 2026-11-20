import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBO_WINDOW_SECONDS,
  createInitialGrid,
  createWorld,
  detonateBomb,
  getArenaConfig,
  getHumanSpawnCoords,
  getSoloLevelConfig,
  isSpawnSafeZone,
  placeBombForPlayer,
  stepWorld,
} from './engine';
import { computeBotInput, computeDangerMap, findVisibleHumanInCorridor } from './ai';
import {
  LEVEL_BIOMES,
  canPlayLevel,
  computePartyMaxLevel,
  generateSoloCampaignNodes,
  getBugRosterForLevel,
  getLevelBiome,
  normalizeLevelProgress,
  recordLevelCompletion,
} from './levels';
import { MAX_MP_LEVEL, MAX_SOLO_LEVEL } from './types';

test('spawn corners are guaranteed open and players survive initial seconds without input', () => {
  const world = createWorld({
    seed: 12345,
    players: [
      { id: 'p1', name: 'Oyuncu', slot: 0, isBot: false },
      { id: 'b1', name: 'Bot 1', slot: 1, isBot: true, botPolicy: 'stalker' },
      { id: 'b2', name: 'Bot 2', slot: 2, isBot: true, botPolicy: 'trapper' },
      { id: 'b3', name: 'Bot 3', slot: 3, isBot: true, botPolicy: 'raider' },
    ],
  });

  // Verify spawn corners have empty tiles
  for (const s of getHumanSpawnCoords(world.rows)) {
    assert.equal(world.grid[s.gy][s.gx], 'empty');
    assert.equal(isSpawnSafeZone(s.gx, s.gy, world.rows), true);
  }

  // Run 3 seconds with zero player input and bots active
  for (let i = 0; i < 90; i++) {
    const inputs: Record<string, { dx: number; dy: number; placeBomb: boolean }> = {
      p1: { dx: 0, dy: 0, placeBomb: false },
    };
    for (const p of world.players) {
      if (p.isBot) inputs[p.id] = computeBotInput(world, p);
    }
    stepWorld(world, inputs, 1 / 30, 'p1');
  }

  assert.equal(world.players[0].alive, true);
  assert.equal(world.matchFinished, false);
});

test('odd grid coordinates are indestructible steel walls', () => {
  const world = createWorld({
    seed: 99,
    players: [{ id: 'p1', name: 'P1', slot: 0, isBot: false }],
  });

  for (let y = 1; y < world.rows; y += 2) {
    for (let x = 1; x < world.cols; x += 2) {
      assert.equal(world.grid[y][x], 'wall');
    }
  }
});

test('bomb placement, crate destruction, chain detonation, and steel wall occlusion work accurately', () => {
  const world = createWorld({
    seed: 1,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'p2', name: 'P2', slot: 1, isBot: false },
    ],
  });

  // Clear row 0 and place a crate at (2, 0) and steel wall check at (1, 1)
  world.grid[0][1] = 'empty';
  world.grid[0][2] = 'crate';
  world.grid[0][3] = 'empty';

  const p1 = world.players[0];
  p1.flameRange = 3;
  p1.maxBombs = 2;
  p1.x = 0.5;
  p1.y = 0.5;

  const placed1 = placeBombForPlayer(world, p1, []);
  assert.equal(placed1, true);
  assert.equal(world.bombs.length, 1);

  // Move p1 to (0, 2) and place second bomb to test chain reaction vertically
  world.grid[1][0] = 'empty';
  world.grid[2][0] = 'empty';
  p1.x = 0.5;
  p1.y = 2.5;
  const placed2 = placeBombForPlayer(world, p1, []);
  assert.equal(placed2, true);
  assert.equal(world.bombs.length, 2);

  // Detonate bomb 1 at (0,0) -> should break crate at (2,0) and chain-detonate bomb 2 at (0,2)!
  const events: ReturnType<typeof stepWorld>['events'] = [];
  detonateBomb(world, world.bombs[0].id, events);

  assert.equal(world.bombs.length, 0, 'Chain detonation should detonate both bombs');
  assert.equal(world.grid[0][2], 'empty', 'Crate at (2,0) should be destroyed');
  assert.equal(world.grid[1][1], 'wall', 'Steel pillar at (1,1) must remain intact');
  assert.equal(p1.activeBombs, 0, 'Owner activeBombs must reset to 0 after detonation');
});

test('shield absorbs explosion hit once and second hit eliminates player triggering victory', () => {
  const world = createWorld({
    seed: 55,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'p2', name: 'P2', slot: 1, isBot: false },
    ],
  });

  const p1 = world.players[0];
  const p2 = world.players[1];
  p2.hasShield = true;

  // Place p1 bomb right next to p2
  p1.x = p2.x - 1;
  p1.y = p2.y;
  world.grid[Math.floor(p1.y)][Math.floor(p1.x)] = 'empty';
  placeBombForPlayer(world, p1, []);

  // Move p1 to safety away from row 0 blast
  world.grid[1][0] = 'empty';
  world.grid[2][0] = 'empty';
  p1.x = 0.5;
  p1.y = 2.5;

  // Step until first bomb detonates
  for (let i = 0; i < 95; i++) {
    stepWorld(world, {}, 1 / 30, 'p1');
  }

  assert.equal(p2.hasShield, false, 'Shield should absorb the first explosion');
  assert.equal(p2.alive, true, 'Player with shield should survive first explosion');
  assert.equal(world.matchFinished, false);

  // Wait for invulnerability to expire, then detonate another bomb on p2
  p2.invulnTimer = 0;
  p1.x = p2.x;
  p1.y = p2.y;
  placeBombForPlayer(world, p1, []);
  p1.x = 0.5;
  p1.y = 2.5;

  for (let i = 0; i < 110; i++) {
    stepWorld(world, {}, 1 / 30, 'p1');
  }

  assert.equal(p2.alive, false, 'Second explosion without shield must eliminate player');
  assert.equal(world.matchFinished, true, 'Match must finish when only 1 player remains');
  assert.equal(world.winnerId, 'p1');
  assert.equal(world.endReason, 'victory');
});

test('AI bot escapes from active bomb danger zone placed by a player', () => {
  const world = createWorld({
    seed: 7,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'bot', name: 'Bot', slot: 1, isBot: true, botPolicy: 'raider' },
    ],
  });

  const p1 = world.players[0];
  const bot = world.players[1];
  // Human places a bomb on the bot's tile
  p1.x = bot.x;
  p1.y = bot.y;
  const placed = placeBombForPlayer(world, p1, []);
  assert.equal(placed, true);
  p1.x = 0.5;
  p1.y = 0.5;

  const danger = computeDangerMap(world);
  assert.equal(danger.has(`${Math.floor(bot.x)},${Math.floor(bot.y)}`), true);

  const input = computeBotInput(world, bot);
  assert.equal(input.dx !== 0 || input.dy !== 0, true, 'Bot must choose a movement direction to escape danger');
  assert.equal(input.placeBomb, false, 'Bot must not place a bomb while escaping');
});

test('bots survive opening 12 seconds of active skirmish and corner snapping aligns around pillars', () => {
  const world = createWorld({
    seed: 101,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: 'B1', slot: 1, isBot: true, botPolicy: 'stalker' },
      { id: 'b2', name: 'B2', slot: 2, isBot: true, botPolicy: 'trapper' },
      { id: 'b3', name: 'B3', slot: 3, isBot: true, botPolicy: 'raider' },
    ],
  });

  for (let i = 0; i < 360; i++) {
    const inputs: Record<string, { dx: number; dy: number; placeBomb: boolean }> = {
      p1: { dx: 0, dy: 0, placeBomb: false },
    };
    for (const p of world.players) {
      if (p.isBot) inputs[p.id] = computeBotInput(world, p);
    }
    stepWorld(world, inputs, 1 / 30, 'p1');
  }

  const aliveBots = world.players.filter((p) => p.isBot && p.alive).length;
  assert.equal(aliveBots >= 2, true, `Expected at least 2 bots alive after 12s, got ${aliveBots}`);
});

test('combo system increments multiplier on consecutive kills and resets after combo window expires', () => {
  const world = createWorld({
    seed: 77,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: 'B1', slot: 1, isBot: true },
      { id: 'b2', name: 'B2', slot: 2, isBot: true },
    ],
  });

  const p1 = world.players[0];
  const b1 = world.players[1];
  const b2 = world.players[2];

  // Clear row 0 and place bots near p1 bomb
  for (let x = 0; x <= 4; x++) {
    world.grid[0][x] = 'empty';
  }
  p1.flameRange = 3;
  p1.x = 2.5;
  p1.y = 0.5;
  b1.x = 3.5;
  b1.y = 0.5;
  b2.x = 4.5;
  b2.y = 0.5;

  placeBombForPlayer(world, p1, []);
  // Move p1 to safety vertically or far away
  world.grid[1][0] = 'empty';
  p1.x = 0.5;
  p1.y = 1.5;

  // Step until bomb explodes and hits both b1 and b2
  for (let i = 0; i < 95; i++) {
    stepWorld(world, {}, 1 / 30, 'p1');
  }

  assert.equal(b1.alive, false);
  assert.equal(b2.alive, false);
  assert.equal(p1.kills, 2);
  assert.equal(p1.comboCount, 2);
  assert.equal(p1.comboMultiplier, 1.5);
  assert.equal(p1.maxCombo, 2);
  // First kill = 300 * 1.0 = 300; second kill = 300 * 1.5 = 450 => 750 combo points (+ 25 per crate broken)
  assert.equal(p1.score, 750 + p1.cratesBroken * 25);

  // Advance beyond combo window without further kills -> active combo resets, maxCombo stays 2
  const stepsToExpire = Math.ceil((COMBO_WINDOW_SECONDS + 0.5) * 30);
  for (let i = 0; i < stepsToExpire; i++) {
    stepWorld(world, {}, 1 / 30, 'p1');
  }

  assert.equal(p1.comboCount, 0);
  assert.equal(p1.comboMultiplier, 1);
  assert.equal(p1.maxCombo, 2);
});

test('solo level config scales difficulty smoothly from easy wave 1 to harder waves', () => {
  const w1 = getSoloLevelConfig(1);
  const w2 = getSoloLevelConfig(2);
  const w3 = getSoloLevelConfig(3);
  const w4 = getSoloLevelConfig(4);
  const w25 = getSoloLevelConfig(25);
  const w100 = getSoloLevelConfig(100);
  const w300 = getSoloLevelConfig(300);

  assert.equal(w1.difficultyLabel, 'Kolay');
  assert.equal(w2.difficultyLabel, 'Orta');
  assert.equal(w3.difficultyLabel, 'Zor');
  assert.equal(w25.difficultyLabel, 'Usta');
  assert.equal(w100.difficultyLabel, 'Efsane');
  assert.equal(w300.difficultyLabel, 'Kabus');

  assert.equal(w1.botCount < w2.botCount, true);
  assert.equal(w1.botSpeedMultiplier < w2.botSpeedMultiplier, true);
  assert.equal(w2.botSpeedMultiplier < w4.botSpeedMultiplier, true);
  assert.equal(w1.crateDensity < w4.crateDensity, true);
});

test('solo mode hides exit door in furthest zone from spawn and advances on player entry', () => {
  const world = createWorld({
    wave: 1,
    seed: 2026,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: 'B1', slot: 1, isBot: true },
    ],
  });

  assert.ok(world.exitDoor, 'Solo world must create an exitDoor');
  const door = world.exitDoor!;
  assert.equal(door.revealed, false);
  assert.equal(world.grid[door.gy][door.gx], 'crate', 'Exit door must start hidden under a crate');
  const distFromStart = door.gx + door.gy;
  assert.equal(distFromStart >= 12, true, `Exit door must be far from (0,0), got dist=${distFromStart}`);

  // Place bomb next to the door crate to reveal it
  const p1 = world.players[0];
  p1.flameRange = 2;
  const bombGx = door.gx > 0 && world.grid[door.gy][door.gx - 1] !== 'wall' ? door.gx - 1 : door.gx;
  const bombGy = bombGx === door.gx ? (door.gy > 0 ? door.gy - 1 : door.gy + 1) : door.gy;
  world.grid[bombGy][bombGx] = 'empty';
  p1.x = bombGx + 0.5;
  p1.y = bombGy + 0.5;
  placeBombForPlayer(world, p1, []);

  // Move p1 out of explosion blast
  p1.x = 0.5;
  p1.y = 0.5;

  for (let i = 0; i < 95; i++) {
    stepWorld(world, {}, 1 / 30, 'p1');
  }

  assert.equal(world.grid[door.gy][door.gx], 'empty');
  assert.equal(world.exitDoor!.revealed, true, 'Exploding the hiding crate must reveal the exit door');
  assert.equal(world.matchFinished, false);

  // 1. Stepping onto revealed exit door while a bug is still alive does NOT complete level
  p1.x = door.gx + 0.5;
  p1.y = door.gy + 0.5;
  stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(world.matchFinished, false, 'Exit door must stay locked while bugs are alive');

  // 2. Killing all bugs while NOT on the door STILL does NOT complete level until door is entered
  p1.x = 0.5;
  p1.y = 0.5;
  world.players[1].alive = false;
  stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(world.matchFinished, false, 'Killing all bugs must not finish level until exit door is entered');

  // 3. Even if timer expires after all bugs died without entering the door, it is timeout (not victory)
  const timeoutWorld = createWorld({
    wave: 1,
    seed: 2026,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: 'B1', slot: 1, isBot: true },
    ],
  });
  timeoutWorld.players[1].alive = false;
  timeoutWorld.timeRemaining = 0.01;
  stepWorld(timeoutWorld, {}, 1 / 30, 'p1');
  assert.equal(timeoutWorld.matchFinished, true);
  assert.equal(timeoutWorld.endReason, 'timeout', 'Timeout without entering door must not be victory');
  assert.equal(timeoutWorld.winnerId, null);

  // 4. After all bugs are dead, moving human player onto revealed exit door triggers victory!
  p1.x = door.gx + 0.5;
  p1.y = door.gy + 0.5;
  const scoreBeforeDoor = p1.score;
  stepWorld(world, {}, 1 / 30, 'p1');

  assert.equal(world.matchFinished, true, 'Stepping onto unlocked exit door after all bugs die must finish level');
  assert.equal(world.winnerId, 'p1');
  assert.equal(world.endReason, 'victory');
  assert.equal(p1.score, scoreBeforeDoor + 400);
});

test('AI bots cannot place bombs and computeBotInput never returns placeBomb=true', () => {
  const world = createWorld({
    wave: 1,
    seed: 88,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: 'B1', slot: 1, isBot: true, botPolicy: 'stalker' },
    ],
  });

  const bot = world.players[1];
  const p1 = world.players[0];

  // Even when forced to adjacent tile with maxBombs bumped, engine rejects bot bombs
  bot.maxBombs = 2;
  bot.x = 2.5;
  bot.y = 0.5;
  world.grid[0][1] = 'empty';
  world.grid[0][2] = 'empty';
  const placed = placeBombForPlayer(world, bot, []);
  assert.equal(placed, false, 'Bots must never be allowed to place bombs');
  assert.equal(world.bombs.length, 0);

  // Even via stepWorld input with placeBomb=true, bot cannot drop a bomb
  stepWorld(world, { b1: { dx: 0, dy: 0, placeBomb: true } }, 1 / 30, 'p1');
  assert.equal(world.bombs.length, 0);

  // AI computeBotInput chases p1 and never requests placeBomb
  p1.x = 0.5;
  p1.y = 0.5;
  const aiInput = computeBotInput(world, bot);
  assert.equal(aiInput.placeBomb, false);
  assert.equal(aiInput.dx < 0, true, 'Chaser bot should move left toward p1');
});

test('AI chaser collision eats human player, and shield absorbs contact once', () => {
  const world = createWorld({
    wave: 1,
    seed: 123,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: 'B1', slot: 1, isBot: true },
    ],
  });

  const p1 = world.players[0];
  const bot = world.players[1];
  p1.hasShield = true;

  // Move bot onto p1 -> shield absorbs first collision
  bot.x = p1.x + 0.2;
  bot.y = p1.y;
  stepWorld(world, {}, 1 / 30, 'p1');

  assert.equal(p1.hasShield, false, 'Shield should absorb chaser collision once');
  assert.equal(p1.alive, true);
  assert.equal(p1.invulnTimer > 0, true);

  // Expire invulnerability and collide again -> human is eaten
  p1.invulnTimer = 0;
  bot.x = p1.x + 0.1;
  bot.y = p1.y;
  stepWorld(world, {}, 1 / 30, 'p1');

  assert.equal(p1.alive, false, 'Second chaser collision without shield must eliminate player');
  assert.equal(bot.kills, 1);

  // Advance KO timer to verify defeat state
  for (let i = 0; i < 20; i++) {
    stepWorld(world, {}, 1 / 30, 'p1');
  }
  assert.equal(world.matchFinished, true);
  assert.equal(world.endReason, 'defeat');
});

test('increased AI enemy counts and expanding arena dimensions scale across solo and huge hard multiplayer', () => {
  const w1 = getSoloLevelConfig(1);
  const w2 = getSoloLevelConfig(2);
  const w3 = getSoloLevelConfig(3);
  const w4 = getSoloLevelConfig(4);

  assert.equal(w1.botCount >= 6, true, 'Wave 1 should spawn at least 6 AI bugs');
  assert.equal(w1.botCount < w2.botCount, true);
  assert.equal(w2.botCount < w3.botCount, true);
  assert.equal(w3.botCount < w4.botCount, true);

  // Arena grows strictly larger on every solo level
  assert.equal(w1.cols < w2.cols && w1.rows < w2.rows, true);
  assert.equal(w2.cols < w3.cols && w2.rows < w3.rows, true);
  assert.equal(w3.cols < w4.cols && w3.rows < w4.rows, true);

  // Multiplayer uses huge maps and very hard bug counts & speed
  const mp1 = getArenaConfig(1, false);
  const mp2 = getArenaConfig(2, false);
  assert.equal(mp1.cols >= 27 && mp1.rows >= 19, true, 'Multiplayer wave 1 must be a huge map');
  assert.equal(mp1.botCount >= 16, true, 'Multiplayer wave 1 must have >= 16 bugs');
  assert.equal(
    mp1.botSpeedMultiplier < 1.0 && mp1.botSpeedMultiplier > mp1.slowBotSpeedMultiplier,
    true,
    'Multiplayer bugs should walk slightly slower than humans while fast bugs outpace slow bugs'
  );
  assert.equal(mp2.cols > mp1.cols && mp2.botCount > mp1.botCount, true);

  const world = createWorld({
    wave: 1,
    seed: 9001,
    isSoloMode: false,
    hasExitDoor: true,
    players: [
      { id: 'h1', name: 'H1', slot: 0, isBot: false },
      { id: 'h2', name: 'H2', slot: 1, isBot: false },
      ...Array.from({ length: mp1.botCount }, (_, i) => ({
        id: `b${i + 1}`,
        name: '',
        slot: i + 2,
        isBot: true,
      })),
    ],
  });

  assert.equal(world.cols, mp1.cols);
  assert.equal(world.rows, mp1.rows);
  assert.equal(world.players.length, 2 + mp1.botCount);
  assert.ok(world.exitDoor, 'Multiplayer world with hasExitDoor must include exitDoor');
  assert.equal(world.grid[world.exitDoor!.gy][world.exitDoor!.gx], 'crate');

  // Verify bots spawned on empty tiles, center-right, nameless, and split between slow & fast MP bug variants
  const mpBots = world.players.filter((p) => p.isBot);
  const slowBots = mpBots.filter((b) => b.botVariant === 'slow');
  const fastBots = mpBots.filter((b) => b.botVariant === 'fast');
  assert.equal(slowBots.length, mp1.botCount / 2, 'Half of MP bugs should be slow variant');
  assert.equal(fastBots.length, mp1.botCount / 2, 'Half of MP bugs should be fast variant');

  for (const b of mpBots) {
    const gx = Math.floor(b.x);
    const gy = Math.floor(b.y);
    assert.equal(world.grid[gy][gx], 'empty');
    assert.equal(gx >= 6, true, `Bot should spawn on center-right, got gx=${gx}`);
    assert.equal(b.name, '', 'AI bug enemies must have no name');
    if (b.botVariant === 'fast') {
      assert.equal(b.color, '#9333EA');
      assert.equal(b.speedMultiplier, mp1.botSpeedMultiplier);
    } else {
      assert.equal(b.color, '#E11D48');
      assert.equal(b.speedMultiplier, mp1.slowBotSpeedMultiplier);
    }
  }
});

test('multiplayer 4 human players spawn 2 top-left and 2 bottom-left with safe zones on huge maps', () => {
  const world = createWorld({
    wave: 1,
    seed: 5150,
    isSoloMode: false,
    hasExitDoor: true,
    players: [
      { id: 'h1', name: 'P1', slot: 0, isBot: false },
      { id: 'h2', name: 'P2', slot: 1, isBot: false },
      { id: 'h3', name: 'P3', slot: 2, isBot: false },
      { id: 'h4', name: 'P4', slot: 3, isBot: false },
      { id: 'b1', name: 'ShouldBeCleared', slot: 4, isBot: true },
      { id: 'b2', name: 'ShouldBeCleared2', slot: 5, isBot: true },
    ],
  });

  const humans = world.players.filter((p) => !p.isBot);
  assert.equal(humans.length, 4);

  const coords = humans.map((h) => ({ gx: Math.floor(h.x), gy: Math.floor(h.y) }));
  // 2 top-left: (0,0) and (2,0)
  assert.deepEqual(coords[0], { gx: 0, gy: 0 });
  assert.deepEqual(coords[1], { gx: 2, gy: 0 });
  // 2 bottom-left: (0, rows - 1) and (2, rows - 1)
  assert.deepEqual(coords[2], { gx: 0, gy: world.rows - 1 });
  assert.deepEqual(coords[3], { gx: 2, gy: world.rows - 1 });

  // All 4 spawns and adjacent walk tiles are empty
  for (const c of coords) {
    assert.equal(world.grid[c.gy][c.gx], 'empty');
    assert.equal(isSpawnSafeZone(c.gx, c.gy, world.rows), true);
  }

  // All bots are nameless even if input spec supplied a name
  for (const b of world.players.filter((p) => p.isBot)) {
    assert.equal(b.name, '');
  }
});

test('AI bug only sees and attacks humans in same unobstructed corridor, otherwise wanders randomly', () => {
  const world = createWorld({
    wave: 1,
    seed: 333,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: '', slot: 1, isBot: true },
    ],
  });

  const p1 = world.players[0];
  const bot = world.players[1];

  // 1. Different corridor (human row 0, bot row 2) -> CANNOT see human
  p1.x = 0.5;
  p1.y = 0.5;
  bot.x = 4.5;
  bot.y = 2.5;
  world.grid[2][4] = 'empty';
  world.grid[2][3] = 'empty';
  world.grid[2][5] = 'empty';
  assert.equal(findVisibleHumanInCorridor(world, bot), null, 'Different corridor must block sight');

  // 2. Same corridor (row 0) WITH crate obstacle between them -> CANNOT see human
  for (let x = 0; x <= 6; x++) world.grid[0][x] = 'empty';
  world.grid[0][2] = 'crate';
  bot.x = 4.5;
  bot.y = 0.5;
  assert.equal(findVisibleHumanInCorridor(world, bot), null, 'Crate in corridor must block sight');

  // Bot wanders onto adjacent open tile even when unable to see p1
  const wanderInput = computeBotInput(world, bot);
  assert.equal(wanderInput.placeBomb, false);
  assert.equal(wanderInput.dx !== 0 || wanderInput.dy !== 0, true, 'Bot should wander along open tiles');

  // 3. Remove crate -> same corridor with NO obstacle -> bot sees p1 and charges left!
  world.grid[0][2] = 'empty';
  const seen = findVisibleHumanInCorridor(world, bot);
  assert.equal(seen?.id, 'p1');
  const attackInput = computeBotInput(world, bot);
  assert.equal(attackInput.dx < 0, true, 'Bot should charge directly toward visible human in same corridor');
  assert.equal(attackInput.placeBomb, false);
});

test('AI bugs continuously move and never stop across 20s skirmish, stale targets, and boxed-in cells', () => {
  // 1. Simulate 20 seconds (600 ticks) on Solo Level 1 & Multiplayer Wave 1 with bombs exploding
  for (const isSoloMode of [true, false]) {
    const cfg = getArenaConfig(1, isSoloMode);
    const world = createWorld({
      wave: 1,
      seed: isSoloMode ? 777 : 888,
      isSoloMode,
      hasExitDoor: true,
      players: [
        { id: 'p1', name: 'P1', slot: 0, isBot: false },
        ...Array.from({ length: cfg.botCount }, (_, i) => ({
          id: `b${i + 1}`,
          name: '',
          slot: i + 1,
          isBot: true,
        })),
      ],
    });

    const p1 = world.players[0];
    p1.invulnTimer = 999; // Keep match running the full 20 seconds

    const prevPos = new Map<string, { x: number; y: number }>();
    const zeroMoveWindows = new Map<string, number>();

    for (let tick = 0; tick < 600; tick++) {
      if (world.matchFinished) break;
      const inputs: Record<string, { dx: number; dy: number; placeBomb: boolean }> = {
        p1: {
          dx: tick % 90 < 45 ? 1 : -1,
          dy: 0,
          placeBomb: tick === 30 || tick === 200 || tick === 400,
        },
      };
      for (const p of world.players) {
        if (p.isBot && p.alive) {
          const inp = computeBotInput(world, p);
          assert.equal(
            inp.dx !== 0 || inp.dy !== 0,
            true,
            `Alive bot ${p.id} (solo=${isSoloMode}) returned zero movement at tick ${tick}`
          );
          assert.equal(inp.placeBomb, false);
          inputs[p.id] = inp;
        }
      }

      stepWorld(world, inputs, 1 / 30, 'p1');

      if (!world.matchFinished && world.hitstopTimer === 0) {
        for (const p of world.players) {
          if (!p.isBot || !p.alive) continue;
          const last = prevPos.get(p.id);
          if (last) {
            const moved = Math.hypot(p.x - last.x, p.y - last.y);
            if (moved < 0.001) {
              const count = (zeroMoveWindows.get(p.id) ?? 0) + 1;
              zeroMoveWindows.set(p.id, count);
              assert.equal(
                count <= 3,
                true,
                `Alive bot ${p.id} (solo=${isSoloMode}) stalled for ${count} ticks at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`
              );
            } else {
              zeroMoveWindows.set(p.id, 0);
            }
          }
          prevPos.set(p.id, { x: p.x, y: p.y });
        }
      }
    }
  }

  // 2. Boxed-in 1x1 cell surrounded by crates/walls: bot still keeps pacing continuously without freezing
  const boxedWorld = createWorld({
    wave: 1,
    seed: 111,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: '', slot: 1, isBot: true },
    ],
  });
  const boxedBot = boxedWorld.players[1];
  boxedBot.x = 6.5;
  boxedBot.y = 4.5;
  boxedWorld.grid[4][6] = 'empty';
  boxedWorld.grid[4][5] = 'crate';
  boxedWorld.grid[4][7] = 'crate';
  boxedWorld.grid[3][6] = 'crate';
  boxedWorld.grid[5][6] = 'crate';

  let totalBoxedDisplacement = 0;
  let lastBx = boxedBot.x;
  let lastBy = boxedBot.y;
  for (let i = 0; i < 60; i++) {
    const inp = computeBotInput(boxedWorld, boxedBot);
    assert.equal(inp.dx !== 0 || inp.dy !== 0, true, 'Boxed-in bot must still receive non-zero movement input');
    stepWorld(boxedWorld, { b1: inp }, 1 / 30, 'p1');
    totalBoxedDisplacement += Math.hypot(boxedBot.x - lastBx, boxedBot.y - lastBy);
    lastBx = boxedBot.x;
    lastBy = boxedBot.y;
  }
  assert.equal(totalBoxedDisplacement > 1.0, true, `Boxed-in bot should keep pacing continuously, moved ${totalBoxedDisplacement}`);
});

test('every level has multiple bug species and every bug variant has a distinct speed', () => {
  for (const w of [1, 2, 3, 5, 25, 100]) {
    const soloCfg = getArenaConfig(w, true);
    const soloVariants = new Set(getBugRosterForLevel(w, true, soloCfg.botCount));
    assert.equal(soloVariants.size > 1, true, `Solo level ${w} must have >1 bug species`);

    const mpCfg = getArenaConfig(w, false);
    const mpVariants = new Set(getBugRosterForLevel(w, false, mpCfg.botCount));
    assert.equal(mpVariants.size > 1, true, `MP level ${w} must have >1 bug species`);
  }

  // Verify all 5 bug archetypes have strictly different speedMultipliers
  const world = createWorld({
    wave: 10,
    seed: 404,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b_armored', name: '', slot: 1, isBot: true, botVariant: 'armored' },
      { id: 'b_slow', name: '', slot: 2, isBot: true, botVariant: 'slow' },
      { id: 'b_ghost', name: '', slot: 3, isBot: true, botVariant: 'ghost' },
      { id: 'b_charger', name: '', slot: 4, isBot: true, botVariant: 'charger' },
      { id: 'b_fast', name: '', slot: 5, isBot: true, botVariant: 'fast' },
    ],
  });

  const bots = world.players.filter((p) => p.isBot);
  const uniqueSpeeds = new Set(bots.map((b) => b.speedMultiplier));
  assert.equal(uniqueSpeeds.size, 5, 'All 5 bug variants must have strictly distinct speeds');
  assert.equal(bots[0].speedMultiplier < bots[1].speedMultiplier, true); // armored < slow
  assert.equal(bots[1].speedMultiplier < bots[2].speedMultiplier, true); // slow < ghost
  assert.equal(bots[2].speedMultiplier < bots[3].speedMultiplier, true); // ghost < charger
  assert.equal(bots[3].speedMultiplier < bots[4].speedMultiplier, true); // charger < fast
});

test('all 9 crate power-ups (bomb, flame, speed, kick, shield, pierce, ghost, star, mega) apply real effects', () => {
  const world = createWorld({
    wave: 1,
    seed: 909,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: '', slot: 1, isBot: true },
    ],
  });

  const p1 = world.players[0];
  const bot = world.players[1];

  // Clear row 0 and column 0
  for (let x = 0; x <= 6; x++) world.grid[0][x] = 'empty';
  p1.x = 0.5;
  p1.y = 0.5;

  // Test basic + special pickups cleanly
  const typesToPickup: Array<'bomb' | 'flame' | 'speed' | 'kick' | 'shield' | 'mega'> = [
    'bomb',
    'flame',
    'speed',
    'kick',
    'shield',
    'mega',
  ];
  for (const t of typesToPickup) {
    world.powerUps.push({ id: `test_${t}`, gx: 0, gy: 0, type: t, spawnAnim: 1 });
    stepWorld(world, {}, 1 / 30, 'p1');
  }
  // Initial bomb=1 + bomb(+1) + mega(+1) = 3; flame=2 + flame(+1) + mega(+1) = 4; speed=0 + speed(+1) + mega(+1) = 2
  assert.equal(p1.maxBombs, 3);
  assert.equal(p1.flameRange, 4);
  assert.equal(p1.speedLevel, 2);
  assert.equal(p1.canKick, true);
  assert.equal(p1.hasShield, true);

  // Test PIERCE: flame destroys crate at (2,0) AND continues to break crate at (3,0)!
  world.powerUps.push({ id: 'test_pierce', gx: 0, gy: 0, type: 'pierce', spawnAnim: 1 });
  stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(p1.hasPierce, true);

  world.grid[0][2] = 'crate';
  world.grid[0][3] = 'crate';
  p1.x = 1.5;
  p1.y = 0.5;
  placeBombForPlayer(world, p1, []);
  detonateBomb(world, world.bombs[0].id, []);
  world.hitstopTimer = 0;
  assert.equal(world.grid[0][2], 'empty', 'First crate in piercing blast should break');
  assert.equal(world.grid[0][3], 'empty', 'Second crate behind first must also break with Pierce!');

  // Test GHOST: walk through a crate and stay un-wedged when ghost timer reaches 0 inside crate
  world.powerUps.push({ id: 'test_ghost', gx: 1, gy: 0, type: 'ghost', spawnAnim: 1 });
  stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(p1.ghostTimer > 10, true);

  world.grid[0][2] = 'crate';
  p1.x = 1.85;
  p1.y = 0.5;
  stepWorld(world, { p1: { dx: 1, dy: 0, placeBomb: false } }, 0.05, 'p1');
  assert.equal(p1.x > 2.0, true, 'Ghost mode must let player phase into crate tile');

  // Force ghostTimer near expiry while overlapping crate -> anti-wedge keeps ghostTimer alive until exit
  p1.ghostTimer = 0.01;
  p1.x = 2.5;
  stepWorld(world, {}, 0.05, 'p1');
  assert.equal(p1.ghostTimer > 0, true, 'Anti-wedge must keep ghostTimer active while inside a crate');

  // Test STAR: invulnerable + turbo speed + kills enemy bug on contact with combo!
  p1.ghostTimer = 0;
  p1.x = 0.5;
  p1.y = 0.5;
  world.powerUps.push({ id: 'test_star', gx: 0, gy: 0, type: 'star', spawnAnim: 1 });
  stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(p1.starTimer > 7, true);

  bot.x = 0.6;
  bot.y = 0.5;
  stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(p1.alive, true, 'Star-powered player must survive bug contact');
  assert.equal(bot.alive, false, 'Star-powered player must crush bug on contact');
  assert.equal(p1.comboCount >= 1, true, 'Crushing bug in Star mode must increment combo');
});

test('500 solo levels and 100 MP levels scale within caps with distinct biomes and grid patterns', () => {
  assert.equal(MAX_SOLO_LEVEL, 500);
  assert.equal(MAX_MP_LEVEL, 100);
  assert.equal(LEVEL_BIOMES.length >= 8, true);

  const solo1 = getArenaConfig(1, true);
  const solo250 = getArenaConfig(250, true);
  const solo500 = getArenaConfig(500, true);
  const soloOver = getArenaConfig(999, true);

  assert.equal(solo500.wave, 500);
  assert.equal(soloOver.wave, 500, 'Solo wave must clamp to MAX_SOLO_LEVEL=500');
  assert.equal(solo1.botCount < solo250.botCount, true);
  assert.equal(solo250.botCount <= solo500.botCount, true);
  assert.equal(solo1.botSpeedMultiplier < solo500.botSpeedMultiplier, true);

  const mp1 = getArenaConfig(1, false);
  const mp50 = getArenaConfig(50, false);
  const mp100 = getArenaConfig(100, false);
  const mpOver = getArenaConfig(200, false);

  assert.equal(mp100.wave, 100);
  assert.equal(mpOver.wave, 100, 'MP wave must clamp to MAX_MP_LEVEL=100');
  assert.equal(mp1.botCount < mp50.botCount, true);
  assert.equal(mp50.botCount <= mp100.botCount, true);
  assert.equal(mp1.botSpeedMultiplier < mp100.botSpeedMultiplier, true);

  // Distinct HUD/Arena biomes across consecutive levels
  const biomeIds = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((w) => getLevelBiome(w, true).id));
  assert.equal(biomeIds.size, 8, 'Levels 1..8 should cycle through 8 distinct UI/arena biomes');

  // Same seed produces structurally distinct grids for consecutive levels
  const g1 = createInitialGrid(42, 0.55, 21, 15, 1);
  const g2 = createInitialGrid(42, 0.55, 21, 15, 2);
  let diffs = 0;
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 21; x++) {
      if (g1[y][x] !== g2[y][x]) diffs++;
    }
  }
  assert.equal(diffs > 20, true, 'Different levels must produce visibly different crate layouts');
});

test('500-node solo campaign map winds in random directions without overlapping nodes', () => {
  const nodes = generateSoloCampaignNodes(MAX_SOLO_LEVEL);
  assert.equal(nodes.length, 500);
  assert.equal(nodes[0].level, 1);
  assert.equal(nodes[499].level, 500);

  let leftMoves = 0;
  let rightMoves = 0;
  for (let i = 1; i < nodes.length; i++) {
    assert.equal(nodes[i].level, i + 1);
    const dx = nodes[i].x - nodes[i - 1].x;
    if (dx < -5) leftMoves++;
    if (dx > 5) rightMoves++;

    // Ensure no neighboring nodes overlap (circle radius <= 26px -> distance >= 58px)
    for (let j = Math.max(0, i - 16); j < i; j++) {
      const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      assert.equal(dist >= 58, true, `Nodes ${nodes[j].level} and ${nodes[i].level} overlap (dist=${dist.toFixed(1)})`);
    }
  }

  assert.equal(leftMoves > 50 && rightMoves > 50, true, `Trail must wind left and right (left=${leftMoves}, right=${rightMoves})`);
});

test('specialized bug archetypes (armored 2-HP, ghost crate-phasing, charger dash) function properly', () => {
  // Progressive roster includes armored, ghost, charger at later solo levels
  const lateRoster = getBugRosterForLevel(16, true, 20);
  assert.equal(lateRoster.includes('armored'), true);
  assert.equal(lateRoster.includes('ghost'), true);
  assert.equal(lateRoster.includes('charger'), true);

  const world = createWorld({
    wave: 16,
    seed: 1234,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'arm', name: '', slot: 1, isBot: true, botVariant: 'armored' },
      { id: 'gh', name: '', slot: 2, isBot: true, botVariant: 'ghost' },
      { id: 'ch', name: '', slot: 3, isBot: true, botVariant: 'charger' },
    ],
  });

  const p1 = world.players[0];
  const armored = world.players[1];
  const ghost = world.players[2];
  const charger = world.players[3];

  assert.equal(armored.maxHp, 2);
  assert.equal(armored.hp, 2);

  // 1. Armored bug survives first explosion (armor cracks) and dies on second
  for (let x = 0; x <= 6; x++) world.grid[0][x] = 'empty';
  p1.x = 0.5;
  p1.y = 0.5;
  p1.invulnTimer = 999;
  armored.x = 3.5;
  armored.y = 0.5;
  ghost.x = 12.5;
  ghost.y = 12.5;
  charger.x = 12.5;
  charger.y = 10.5;

  p1.x = 2.5;
  placeBombForPlayer(world, p1, []);
  p1.x = 0.5;
  for (let i = 0; i < 95; i++) stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(armored.alive, true, 'Armored bug must survive first explosion');
  assert.equal(armored.hp, 1, 'Armored bug HP must drop from 2 to 1');

  armored.invulnTimer = 0;
  p1.x = 3.5;
  placeBombForPlayer(world, p1, []);
  p1.x = 0.5;
  for (let i = 0; i < 95; i++) stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(armored.alive, false, 'Second explosion must eliminate cracked armored bug');

  // 2. NO bug species (including ghost) can ever pass through wall or crate obstacles
  const allVariants: Array<'slow' | 'fast' | 'armored' | 'ghost' | 'charger'> = [
    'slow',
    'fast',
    'armored',
    'ghost',
    'charger',
  ];
  for (const variant of allVariants) {
    const obsWorld = createWorld({
      wave: 5,
      seed: 1234,
      isSoloMode: true,
      players: [
        { id: 'p1', name: 'P1', slot: 0, isBot: false },
        { id: 'bug', name: '', slot: 1, isBot: true, botVariant: variant },
      ],
    });
    const testBug = obsWorld.players[1];
    obsWorld.grid[2][2] = 'empty';
    obsWorld.grid[2][3] = 'crate';
    obsWorld.grid[1][2] = 'wall';
    testBug.x = 2.5;
    testBug.y = 2.5;
    // Push right into crate at (3,2)
    for (let i = 0; i < 15; i++) {
      stepWorld(obsWorld, { bug: { dx: 1, dy: 0, placeBomb: false } }, 1 / 30, 'p1');
    }
    assert.equal(testBug.x <= 2.68, true, `Bug variant ${variant} must stop at crate obstacle, x=${testBug.x}`);
    // Push up into steel wall at (2,1)
    testBug.x = 2.5;
    testBug.y = 2.5;
    for (let i = 0; i < 15; i++) {
      stepWorld(obsWorld, { bug: { dx: 0, dy: -1, placeBomb: false } }, 1 / 30, 'p1');
    }
    assert.equal(testBug.y >= 2.32, true, `Bug variant ${variant} must stop at wall obstacle, y=${testBug.y}`);
  }

  // 3. Charger bug triggers dash when seeing human in unobstructed corridor
  for (let x = 0; x <= 6; x++) world.grid[4][x] = 'empty';
  p1.x = 0.5;
  p1.y = 4.5;
  charger.x = 4.5;
  charger.y = 4.5;
  const chargerInput = computeBotInput(world, charger);
  assert.equal(chargerInput.dx < 0, true);
  assert.equal(chargerInput.dash, true, 'Charger must trigger dash along clear corridor LOS');
  const startX = charger.x;
  for (let i = 0; i < 3; i++) {
    stepWorld(world, { ch: chargerInput }, 1 / 30, 'p1');
  }
  const dashedDelta = startX - charger.x;
  assert.equal(charger.isDashing, true);

  charger.x = startX;
  for (let i = 0; i < 3; i++) {
    stepWorld(world, { ch: { dx: -1, dy: 0, placeBomb: false, dash: false } }, 1 / 30, 'p1');
  }
  const normalDelta = startX - charger.x;
  assert.equal(dashedDelta > normalDelta * 1.4, true, `Charger dash (${dashedDelta}) must boost speed over normal (${normalDelta})`);
});

test('bugs treat dropped bombs strictly as walls without dodging blast range', () => {
  const world = createWorld({
    wave: 5,
    seed: 2027,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'slowBot', name: '', slot: 1, isBot: true, botVariant: 'slow' },
      { id: 'ghostBot', name: '', slot: 2, isBot: true, botVariant: 'ghost' },
    ],
  });

  const p1 = world.players[0];
  const slowBot = world.players[1];
  const ghostBot = world.players[2];

  // Clear row 0 and place bomb at (3,0), p1 at (0,0), slowBot at (5,0)
  for (let x = 0; x <= 7; x++) world.grid[0][x] = 'empty';
  p1.flameRange = 4;
  p1.x = 3.5;
  p1.y = 0.5;
  placeBombForPlayer(world, p1, []);
  p1.x = 0.5;
  p1.y = 0.5;

  slowBot.x = 5.5;
  slowBot.y = 0.5;

  // Bomb at (3,0) blocks corridor LOS like a wall!
  assert.equal(findVisibleHumanInCorridor(world, slowBot), null, 'Bomb must block corridor sight like a wall');

  // Even ghost bug cannot walk into a bomb tile (treated as solid wall)
  world.grid[2][3] = 'empty';
  world.grid[2][4] = 'empty';
  p1.maxBombs = 3;
  p1.x = 3.5;
  p1.y = 2.5;
  placeBombForPlayer(world, p1, []);
  p1.x = 0.5;
  p1.y = 0.5;

  ghostBot.x = 4.5;
  ghostBot.y = 2.5;
  for (let i = 0; i < 12; i++) {
    stepWorld(world, { ghostBot: { dx: -1, dy: 0, placeBomb: false } }, 1 / 30, 'p1');
  }
  assert.equal(ghostBot.x >= 3.9, true, `Ghost bug must treat bomb as solid wall, x=${ghostBot.x}`);

  // When a bomb is at (3,0) and slowBot is pushed left into (3,0), physics blocks entry like a wall
  const beforeX = slowBot.x;
  for (let i = 0; i < 20; i++) {
    stepWorld(world, { slowBot: { dx: -1, dy: 0, placeBomb: false } }, 1 / 30, 'p1');
  }
  assert.equal(slowBot.x >= 3.9 && slowBot.x < beforeX, true, `Bug must walk up to bomb and stop at its border like a wall, x=${slowBot.x}`);
});

test('strict sequential level prerequisite blocks skipping ahead and persists contiguous progress', () => {
  // Tampered or gapped progress: completed [1, 5] without 2, 3, 4 only unlocks level 2!
  const normalized = normalizeLevelProgress(
    { highestUnlocked: 10, completed: [1, 5] },
    MAX_SOLO_LEVEL
  );
  assert.equal(normalized.highestUnlocked, 2);
  assert.equal(canPlayLevel(1, normalized, MAX_SOLO_LEVEL), true);
  assert.equal(canPlayLevel(2, normalized, MAX_SOLO_LEVEL), true);
  assert.equal(canPlayLevel(3, normalized, MAX_SOLO_LEVEL), false);
  assert.equal(canPlayLevel(5, normalized, MAX_SOLO_LEVEL), false);

  // Trying to record completion of locked level 3 is ignored
  const afterSkipAttempt = recordLevelCompletion(normalized, 3, MAX_SOLO_LEVEL);
  assert.equal(afterSkipAttempt.highestUnlocked, 2);

  // Completing level 2 unlocks level 3
  const afterClear2 = recordLevelCompletion(normalized, 2, MAX_SOLO_LEVEL);
  assert.equal(afterClear2.highestUnlocked, 3);
  assert.equal(canPlayLevel(3, afterClear2, MAX_SOLO_LEVEL), true);
});

test('multiplayer party level is capped by lowest-level friend in the room', () => {
  assert.equal(computePartyMaxLevel([12, 3, 8], MAX_MP_LEVEL), 3);
  assert.equal(computePartyMaxLevel([5, 1], MAX_MP_LEVEL), 1);
  assert.equal(computePartyMaxLevel([150, 120], MAX_MP_LEVEL), MAX_MP_LEVEL);
  assert.equal(computePartyMaxLevel([], MAX_MP_LEVEL), 1);
});

test('bugs cannot pick up power-ups and bomb explosions cannot destroy power-ups', () => {
  const world = createWorld({
    wave: 1,
    seed: 555,
    isSoloMode: true,
    players: [
      { id: 'p1', name: 'P1', slot: 0, isBot: false },
      { id: 'b1', name: '', slot: 1, isBot: true, botVariant: 'slow' },
    ],
  });

  const p1 = world.players[0];
  const bot = world.players[1];

  for (let x = 0; x <= 6; x++) world.grid[0][x] = 'empty';
  world.grid[1][0] = 'empty';
  world.grid[2][0] = 'empty';
  world.powerUps.push(
    { id: 'pu_shield', gx: 2, gy: 0, type: 'shield', spawnAnim: 1 },
    { id: 'pu_mega', gx: 4, gy: 0, type: 'mega', spawnAnim: 1 }
  );

  // 1. Bug walks directly over power-ups -> cannot collect them
  bot.x = 2.5;
  bot.y = 0.5;
  stepWorld(world, { b1: { dx: 1, dy: 0, placeBomb: false } }, 1 / 30, 'p1');
  assert.equal(world.powerUps.length, 2, 'Bug must not pick up power-up on its tile');
  assert.equal(bot.hasShield, false);
  assert.equal(bot.score, 0);

  // 2. Bomb explodes directly across both power-ups -> power-ups survive blast
  bot.x = 12.5;
  bot.y = 8.5;
  p1.flameRange = 4;
  p1.x = 3.5;
  p1.y = 0.5;
  placeBombForPlayer(world, p1, []);
  p1.x = 0.5;
  p1.y = 2.5;
  detonateBomb(world, world.bombs[0].id, []);
  assert.equal(
    world.powerUps.some((pu) => pu.id === 'pu_shield') &&
      world.powerUps.some((pu) => pu.id === 'pu_mega'),
    true,
    'Bomb explosions must NOT destroy power-ups'
  );

  // Step until flames clear -> power-ups still survive on the ground!
  world.hitstopTimer = 0;
  for (let i = 0; i < 20; i++) {
    stepWorld(world, {}, 1 / 30, 'p1');
  }
  assert.equal(world.explosions.length, 0);
  assert.equal(
    world.powerUps.some((pu) => pu.id === 'pu_shield') &&
      world.powerUps.some((pu) => pu.id === 'pu_mega'),
    true,
    'Power-ups must remain intact after explosion clears'
  );

  // 3. Human player walks onto preserved power-up and collects it
  p1.x = 2.5;
  p1.y = 0.5;
  stepWorld(world, {}, 1 / 30, 'p1');
  assert.equal(world.powerUps.some((pu) => pu.id === 'pu_shield'), false);
  assert.equal(p1.hasShield, true, 'Human player must collect preserved power-up');
});

test('first unpassed level is always selected after clearing or replaying levels', () => {
  let progress = normalizeLevelProgress({ highestUnlocked: 1, completed: [1, 2, 3] }, MAX_SOLO_LEVEL);
  assert.equal(progress.highestUnlocked, 4, 'First unpassed level after 1,2,3 must be 4');

  // Replaying and completing already-passed level 1 keeps first unpassed level at 4
  progress = recordLevelCompletion(progress, 1, MAX_SOLO_LEVEL);
  assert.equal(progress.highestUnlocked, 4, 'Replaying level 1 must still leave 4 as first unpassed level');

  // Clearing level 4 advances first unpassed level to 5
  progress = recordLevelCompletion(progress, 4, MAX_SOLO_LEVEL);
  assert.equal(progress.highestUnlocked, 5, 'Clearing level 4 must select 5 as first unpassed level');
});

test('cloud profile highestUnlocked reconstructs contiguous local progress cleanly', async () => {
  const { buildProgressFromHighestUnlocked } = await import('./levels.ts');
  const solo = buildProgressFromHighestUnlocked(7, MAX_SOLO_LEVEL);
  assert.equal(solo.highestUnlocked, 7);
  assert.deepEqual(solo.completed, [1, 2, 3, 4, 5, 6]);
  assert.equal(canPlayLevel(7, solo, MAX_SOLO_LEVEL), true);
  assert.equal(canPlayLevel(8, solo, MAX_SOLO_LEVEL), false);
});



