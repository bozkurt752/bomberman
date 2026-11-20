import {
  AvatarId,
  PlayerState,
  PowerUpType,
  SimEvent,
  WorldState,
} from './types';
import { getLevelBiome, LevelBiome } from './levels';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingPopup {
  active: boolean;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

type BiomeTheme = LevelBiome;

const MAX_PARTICLES = 180;
const MAX_POPUPS = 16;
const DEFAULT_FLOOR_IMG = '/src/assets/images/arena_stone_texture_1795156780003.jpg';

export class BombermanRenderer {
  private particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 4,
    color: '#F97316',
  }));
  private particleCursor = 0;

  private popups: FloatingPopup[] = Array.from({ length: MAX_POPUPS }, () => ({
    active: false,
    x: 0,
    y: 0,
    text: '',
    color: '#FACC15',
    life: 0,
    maxLife: 1,
  }));
  private popupCursor = 0;

  private trauma = 0;
  private floorImg: HTMLImageElement | null = null;
  private floorPattern: CanvasPattern | null = null;
  private floorLoadedUrl = '';
  private time = 0;
  private camX = 0;
  private camY = 0;
  private camInit = false;

  constructor(customFloorUrl?: string) {
    this.setFloorTexture(customFloorUrl || DEFAULT_FLOOR_IMG);
  }

  public setFloorTexture(url: string): void {
    const targetUrl = url || DEFAULT_FLOOR_IMG;
    if (this.floorLoadedUrl === targetUrl) return;
    this.floorLoadedUrl = targetUrl;
    this.floorPattern = null;
    if (typeof Image === 'undefined') return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.floorImg = img;
      this.floorPattern = null;
    };
    img.onerror = () => {
      this.floorImg = null;
      this.floorPattern = null;
    };
    img.src = targetUrl;
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
  }

  private spawnPopup(x: number, y: number, text: string, color: string): void {
    const pop = this.popups[this.popupCursor];
    this.popupCursor = (this.popupCursor + 1) % MAX_POPUPS;
    pop.active = true;
    pop.x = x;
    pop.y = y;
    pop.text = text;
    pop.color = color;
    pop.life = 1.15;
    pop.maxLife = 1.15;
  }

  public ingestEvents(events: SimEvent[]): void {
    for (const ev of events) {
      const cx = ev.gx + 0.5;
      const cy = ev.gy + 0.5;
      if (ev.type === 'explode') {
        this.trauma = Math.min(1, this.trauma + 0.42 + (ev.intensity ?? 2) * 0.06);
        for (let i = 0; i < 20; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 1.6 + Math.random() * 5.0;
          this.spawnParticle(
            cx,
            cy,
            Math.cos(ang) * spd,
            Math.sin(ang) * spd,
            0.25 + Math.random() * 0.35,
            0.12 + Math.random() * 0.14,
            i % 4 === 0 ? '#FEF08A' : i % 3 === 0 ? '#F97316' : i % 2 === 0 ? '#FB7185' : '#38BDF8'
          );
        }
      } else if (ev.type === 'crate_break') {
        for (let i = 0; i < 10; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 1.2 + Math.random() * 3.2;
          this.spawnParticle(
            cx,
            cy,
            Math.cos(ang) * spd,
            Math.sin(ang) * spd,
            0.28 + Math.random() * 0.25,
            0.11 + Math.random() * 0.08,
            i % 2 === 0 ? '#F59E0B' : '#B45309'
          );
        }
      } else if (ev.type === 'powerup_pickup') {
        const labels: Record<PowerUpType, { text: string; color: string }> = {
          bomb: { text: '+1 BOMBA', color: '#67E8F9' },
          flame: { text: '+1 ALEV', color: '#FDBA74' },
          speed: { text: '+HIZ', color: '#86EFAC' },
          kick: { text: 'TEKME!', color: '#E879F9' },
          shield: { text: 'KALKAN!', color: '#93C5FD' },
          pierce: { text: 'DELİCİ ALEV!', color: '#FDA4AF' },
          ghost: { text: 'HAYALET!', color: '#5EEAD4' },
          star: { text: 'SÜPER YILDIZ!', color: '#FDE047' },
          mega: { text: 'MEGA PAKET!', color: '#F472B6' },
        };
        if (ev.powerUpType) {
          const info = labels[ev.powerUpType];
          this.spawnPopup(cx, cy - 0.3, info.text, info.color);
        }
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          this.spawnParticle(
            cx,
            cy,
            Math.cos(ang) * 2.6,
            Math.sin(ang) * 2.6,
            0.38,
            0.1,
            i % 2 === 0 ? '#FACC15' : '#34D399'
          );
        }
      } else if (ev.type === 'combo_up') {
        const mult = ev.comboMultiplier ?? 1;
        const pts = ev.bonusPoints ?? 300;
        const text =
          (ev.comboCount ?? 1) >= 2
            ? `${mult.toFixed(1)}x COMBO! +${pts}`
            : `+${pts}`;
        this.spawnPopup(cx, cy - 0.4, text, (ev.comboCount ?? 1) >= 2 ? '#FDE047' : '#FB923C');
      } else if (ev.type === 'door_revealed') {
        this.spawnPopup(cx, cy - 0.3, 'KAPI BULUNDU!', '#4ADE80');
        for (let i = 0; i < 18; i++) {
          const ang = (i / 18) * Math.PI * 2;
          this.spawnParticle(
            cx,
            cy,
            Math.cos(ang) * 3.0,
            Math.sin(ang) * 3.0,
            0.55,
            0.12,
            i % 2 === 0 ? '#4ADE80' : '#FACC15'
          );
        }
      } else if (ev.type === 'shield_break') {
        this.trauma = Math.min(1, this.trauma + 0.25);
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2;
          this.spawnParticle(
            cx,
            cy,
            Math.cos(ang) * 3.2,
            Math.sin(ang) * 3.2,
            0.38,
            0.1,
            '#38BDF8'
          );
        }
      } else if (ev.type === 'armor_crack') {
        this.trauma = Math.min(1, this.trauma + 0.2);
        this.spawnPopup(cx, cy - 0.35, 'ZIRH KIRILDI!', '#FBBF24');
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          this.spawnParticle(
            cx,
            cy,
            Math.cos(ang) * 2.9,
            Math.sin(ang) * 2.9,
            0.36,
            0.11,
            i % 2 === 0 ? '#F59E0B' : '#FEF08A'
          );
        }
      } else if (ev.type === 'player_ko') {
        this.trauma = Math.min(1, this.trauma + 0.65);
        for (let i = 0; i < 24; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 2.0 + Math.random() * 5.0;
          this.spawnParticle(
            cx,
            cy,
            Math.cos(ang) * spd,
            Math.sin(ang) * spd,
            0.45 + Math.random() * 0.35,
            0.13,
            i % 3 === 0 ? '#F43F5E' : i % 2 === 0 ? '#FDE047' : '#C084FC'
          );
        }
      }
    }
  }

  public updateEffects(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    for (let i = 0; i < MAX_POPUPS; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      pop.life -= dt;
      pop.y -= dt * 0.65;
      if (pop.life <= 0) pop.active = false;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    world: WorldState,
    localPlayerId: string,
    isMobileLayout: boolean
  ): void {
    const theme = getLevelBiome(world.wave, world.isSoloMode);
    const cols = world.cols || world.grid[0]?.length || 17;
    const rows = world.rows || world.grid.length || 13;

    ctx.save();
    ctx.fillStyle = theme.bgOuter;
    ctx.fillRect(0, 0, width, height);

    const isLandscape = width > height;
    const topSafe = isMobileLayout
      ? isLandscape
        ? Math.min(62, Math.max(52, Math.round(height * 0.125)))
        : 90
      : 66;
    const bottomSafe = isMobileLayout ? (isLandscape ? 20 : 166) : 22;
    const sideSafe = isMobileLayout
      ? isLandscape
        ? Math.max(134, Math.round(width * 0.165))
        : 18
      : 24;

    const bezelMargin = 20;
    const availW = Math.max(180, width - sideSafe * 2 - bezelMargin);
    const availH = Math.max(160, height - topSafe - bottomSafe - bezelMargin);

    // Keep full early arenas framed inside HUD + thumb controls on 16:9 & 9:16 Android screens, scrolling smoothly on huge arenas
    const fitCols = isLandscape ? Math.min(cols, 15) : Math.min(cols, 13);
    const fitRows = isLandscape ? Math.min(rows, 11) : Math.min(rows, 13);
    const tile = isMobileLayout
      ? isLandscape
        ? Math.max(24, Math.min(44, Math.floor(Math.min(availW / fitCols, availH / fitRows))))
        : Math.max(24, Math.min(44, Math.floor(Math.min(availW / fitCols, availH / fitRows))))
      : Math.max(38, Math.min(54, Math.floor(Math.min(availW / Math.min(cols, 17), availH / Math.min(rows, 13)))));

    const boardW = cols * tile;
    const boardH = rows * tile;
    const viewW = Math.min(availW, boardW);
    const viewH = Math.min(availH, boardH);

    const focusPlayer = world.players.find((p) => p.id === localPlayerId) ?? world.players[0];
    const maxCamX = Math.max(0, boardW - viewW);
    const maxCamY = Math.max(0, boardH - viewH);
    const targetCamX = focusPlayer
      ? Math.max(0, Math.min(maxCamX, focusPlayer.x * tile - viewW / 2))
      : maxCamX / 2;
    const targetCamY = focusPlayer
      ? Math.max(0, Math.min(maxCamY, focusPlayer.y * tile - viewH / 2))
      : maxCamY / 2;

    if (!this.camInit || world.tick <= 2 || Math.hypot(targetCamX - this.camX, targetCamY - this.camY) > tile * 8) {
      this.camX = targetCamX;
      this.camY = targetCamY;
      this.camInit = true;
    } else {
      this.camX += (targetCamX - this.camX) * 0.22;
      this.camY += (targetCamY - this.camY) * 0.22;
    }

    const shakeMag = this.trauma * this.trauma * (tile * 0.24);
    const shakeX = (Math.random() * 2 - 1) * shakeMag;
    const shakeY = (Math.random() * 2 - 1) * shakeMag;

    const frameX = Math.floor((width - viewW) / 2 + shakeX);
    const frameY = Math.floor(topSafe + (availH - viewH) / 2 + shakeY);
    const originX = frameX - Math.round(this.camX);
    const originY = frameY - Math.round(this.camY);

    // Outer fortress bezel shadow & colorful frame
    const framePad = Math.max(8, Math.floor(tile * 0.25));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    this.roundRect(ctx, frameX - framePad - 4, frameY - framePad - 4, viewW + framePad * 2 + 8, viewH + framePad * 2 + 12, 16);
    ctx.fill();

    ctx.fillStyle = theme.frameBg;
    ctx.strokeStyle = theme.frameBorder;
    ctx.lineWidth = 2.5;
    this.roundRect(ctx, frameX - framePad, frameY - framePad, viewW + framePad * 2, viewH + framePad * 2, 12);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(frameX, frameY, viewW, viewH);
    ctx.clip();

    if (this.floorImg && this.floorImg.complete && this.floorImg.naturalWidth > 0) {
      if (!this.floorPattern) {
        this.floorPattern = ctx.createPattern(this.floorImg, 'repeat');
      }
      if (this.floorPattern) {
        ctx.save();
        const patScale = (tile * 4) / Math.max(256, this.floorImg.naturalWidth);
        ctx.translate(originX, originY);
        ctx.scale(patScale, patScale);
        ctx.fillStyle = this.floorPattern;
        ctx.fillRect(0, 0, boardW / patScale, boardH / patScale);
        ctx.restore();
        ctx.fillStyle = theme.floorTint;
        ctx.fillRect(frameX, frameY, viewW, viewH);
      }
    } else {
      ctx.fillStyle = theme.bgOuter;
      ctx.fillRect(frameX, frameY, viewW, viewH);
    }

    // Culled visible tile window
    const startCol = Math.max(0, Math.floor((this.camX - tile) / tile));
    const endCol = Math.min(cols - 1, Math.ceil((this.camX + viewW + tile) / tile));
    const startRow = Math.max(0, Math.floor((this.camY - tile) / tile));
    const endRow = Math.min(rows - 1, Math.ceil((this.camY + viewH + tile) / tile));

    // Colorful checkerboard tiles
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = theme.checkerTint;
          ctx.fillRect(originX + x * tile, originY + y * tile, tile, tile);
        }
      }
    }

    // Revealed Exit Portal Door on floor (locked while bugs remain, glowing open once all bugs die)
    const allBugsDead = world.players.every((p) => !p.isBot || !p.alive);
    if (world.exitDoor && world.exitDoor.revealed) {
      this.drawExitDoor(ctx, originX, originY, tile, world.exitDoor.gx, world.exitDoor.gy, allBugsDead);
    }

    // Subtle beacon shimmer if all bots defeated & exitDoor still hidden
    if (
      world.exitDoor &&
      !world.exitDoor.revealed &&
      world.players.filter((p) => p.isBot && p.alive).length === 0
    ) {
      const pulse = 0.25 + Math.sin(this.time * 6) * 0.2;
      ctx.strokeStyle = `rgba(74, 222, 128, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(
        originX + world.exitDoor.gx * tile + 2,
        originY + world.exitDoor.gy * tile + 2,
        tile - 4,
        tile - 4
      );
    }

    // Power-ups on floor
    for (const pu of world.powerUps) {
      if (pu.gx < startCol || pu.gx > endCol || pu.gy < startRow || pu.gy > endRow) continue;
      this.drawPowerUp(ctx, originX, originY, tile, pu.gx, pu.gy, pu.type, pu.spawnAnim);
    }

    // Grid walls & colorful crates (culled)
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const cell = world.grid[y][x];
        if (cell === 'wall') {
          this.drawSteelPillar(ctx, originX + x * tile, originY + y * tile, tile, theme);
        } else if (cell === 'crate') {
          this.drawWoodCrate(ctx, originX + x * tile, originY + y * tile, tile, theme);
        }
      }
    }

    // Bombs
    for (const bomb of world.bombs) {
      this.drawBomb(ctx, originX, originY, tile, bomb.x, bomb.y, bomb.fuseTimer, bomb.maxFuse);
    }

    // Explosions
    for (const exp of world.explosions) {
      const progress = 1 - exp.timer / exp.maxTimer;
      const alpha = progress < 0.7 ? 1 : Math.max(0, 1 - (progress - 0.7) / 0.3);
      for (const cell of exp.cells) {
        if (cell.gx < startCol || cell.gx > endCol || cell.gy < startRow || cell.gy > endRow) continue;
        this.drawExplosionCell(ctx, originX + cell.gx * tile, originY + cell.gy * tile, tile, cell.kind, alpha);
      }
    }

    // Players sorted by Y
    const sortedPlayers = [...world.players].sort((a, b) => a.y - b.y);
    for (const p of sortedPlayers) {
      if (!p.alive && p.koTimer <= 0) continue;
      this.drawPlayer(ctx, originX, originY, tile, p, p.id === localPlayerId);
    }

    // Pooled Particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const px = originX + p.x * tile;
      const py = originY + p.y * tile;
      const r = Math.max(1.5, p.size * tile * alpha);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating Combo & Pickup Popups
    for (let i = 0; i < MAX_POPUPS; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      const alpha = Math.min(1, pop.life / 0.35);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.max(12, Math.floor(tile * 0.32))}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      const px = originX + pop.x * tile;
      const py = originY + pop.y * tile;
      ctx.strokeStyle = '#090D16';
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, px, py);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, px, py);
      ctx.restore();
    }

    // Sudden Death warning border pulse
    if (world.timeRemaining <= 35 && !world.matchFinished) {
      const pulse = 0.16 + Math.sin(this.time * 7) * 0.08;
      ctx.strokeStyle = `rgba(244, 63, 94, ${pulse})`;
      ctx.lineWidth = Math.max(4, tile * 0.15);
      ctx.strokeRect(frameX + 2, frameY + 2, viewW - 4, viewH - 4);
    }

    ctx.restore();

    ctx.restore();
  }

  private drawExitDoor(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    tile: number,
    gx: number,
    gy: number,
    isUnlocked: boolean
  ): void {
    const cx = originX + (gx + 0.5) * tile;
    const cy = originY + (gy + 0.5) * tile;
    const r = tile * 0.42;
    const spin = this.time * 2.8;

    if (!isUnlocked) {
      // Locked exit door while bugs remain alive
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      this.roundRect(ctx, cx - r * 0.8, cy - r * 0.85, r * 1.6, r * 1.7, r * 0.55);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.45, cy + r * 0.45);
      ctx.moveTo(cx + r * 0.45, cy - r * 0.45);
      ctx.lineTo(cx - r * 0.45, cy + r * 0.45);
      ctx.stroke();
      return;
    }

    // Outer radiant aura
    const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.25);
    grad.addColorStop(0, 'rgba(250, 204, 21, 0.85)');
    grad.addColorStop(0.55, 'rgba(34, 197, 94, 0.55)');
    grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Archway stone portal frame
    ctx.fillStyle = '#064E3B';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2.5;
    this.roundRect(ctx, cx - r * 0.8, cy - r * 0.85, r * 1.6, r * 1.7, r * 0.55);
    ctx.fill();
    ctx.stroke();

    // Swirling inner energy
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.strokeStyle = '#6EE7B7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.48, 0, Math.PI * 1.4);
    ctx.stroke();
    ctx.strokeStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.26, Math.PI, Math.PI * 2.4);
    ctx.stroke();
    ctx.restore();
  }

  private drawSteelPillar(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    tile: number,
    theme: BiomeTheme
  ): void {
    const pad = Math.max(1, Math.floor(tile * 0.04));
    const x = px + pad;
    const y = py + pad;
    const w = tile - pad * 2;
    const h = tile - pad * 2;
    const lip = Math.max(3, Math.floor(tile * 0.14));

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this.roundRect(ctx, x + 2, y + 4, w, h, 6);
    ctx.fill();

    ctx.fillStyle = theme.pillarBase;
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    ctx.fillStyle = theme.pillarTop;
    this.roundRect(ctx, x, y, w, h - lip, 6);
    ctx.fill();

    ctx.strokeStyle = theme.pillarStroke;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x + 2, y + 2, w - 4, h - lip - 4, 4);
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    const r = Math.max(1.2, tile * 0.04);
    const off = Math.max(5, tile * 0.16);
    ctx.beginPath();
    ctx.arc(x + off, y + off, r, 0, Math.PI * 2);
    ctx.arc(x + w - off, y + off, r, 0, Math.PI * 2);
    ctx.arc(x + off, y + h - lip - off, r, 0, Math.PI * 2);
    ctx.arc(x + w - off, y + h - lip - off, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawWoodCrate(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    tile: number,
    theme: BiomeTheme
  ): void {
    const pad = Math.max(2, Math.floor(tile * 0.06));
    const x = px + pad;
    const y = py + pad;
    const w = tile - pad * 2;
    const h = tile - pad * 2;
    const lip = Math.max(3, Math.floor(tile * 0.12));

    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    this.roundRect(ctx, x + 1, y + 3, w, h, 5);
    ctx.fill();

    ctx.fillStyle = theme.crateDark;
    this.roundRect(ctx, x, y, w, h, 5);
    ctx.fill();

    ctx.fillStyle = theme.crateMid;
    this.roundRect(ctx, x, y, w, h - lip, 5);
    ctx.fill();

    const inset = Math.max(3, Math.floor(tile * 0.12));
    ctx.fillStyle = theme.crateInner;
    this.roundRect(ctx, x + inset, y + inset, w - inset * 2, h - lip - inset * 2, 3);
    ctx.fill();

    ctx.strokeStyle = theme.crateStrap;
    ctx.lineWidth = Math.max(2, tile * 0.07);
    ctx.beginPath();
    ctx.moveTo(x + inset + 2, y + inset + 2);
    ctx.lineTo(x + w - inset - 2, y + h - lip - inset - 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + 1, y + 1, w - 2, h - lip - 2, 4);
    ctx.stroke();
  }

  private drawPowerUp(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    tile: number,
    gx: number,
    gy: number,
    type: PowerUpType,
    spawnAnim: number
  ): void {
    const cx = originX + (gx + 0.5) * tile;
    const bob = Math.sin(this.time * 5.2 + gx * 0.7 + gy) * (tile * 0.06);
    const cy = originY + (gy + 0.5) * tile + bob;
    const scale = 0.65 + 0.35 * Math.min(1, spawnAnim);
    const sz = tile * 0.38 * scale;

    const palette: Record<
      PowerUpType,
      { base: string; top: string; border: string; glow: string; tag: string }
    > = {
      bomb: { base: '#0E7490', top: '#06B6D4', border: '#A5F3FC', glow: 'rgba(34, 211, 238, 0.34)', tag: '+B' },
      flame: { base: '#C2410C', top: '#F97316', border: '#FDE047', glow: 'rgba(249, 115, 22, 0.34)', tag: '+A' },
      speed: { base: '#15803D', top: '#22C55E', border: '#BBF7D0', glow: 'rgba(74, 222, 128, 0.34)', tag: 'HIZ' },
      kick: { base: '#6D28D9', top: '#9333EA', border: '#F0ABFC', glow: 'rgba(192, 132, 252, 0.34)', tag: 'TKM' },
      shield: { base: '#1D4ED8', top: '#3B82F6', border: '#BFDBFE', glow: 'rgba(96, 165, 250, 0.34)', tag: 'KLK' },
      pierce: { base: '#BE123C', top: '#F43F5E', border: '#FDE047', glow: 'rgba(244, 63, 94, 0.38)', tag: 'DEL' },
      ghost: { base: '#0F766E', top: '#14B8A6', border: '#99F6E4', glow: 'rgba(45, 212, 191, 0.38)', tag: 'HYL' },
      star: { base: '#B45309', top: '#EAB308', border: '#FEF08A', glow: 'rgba(250, 204, 21, 0.44)', tag: 'YLD' },
      mega: { base: '#A21CAF', top: '#D946EF', border: '#FDE047', glow: 'rgba(232, 121, 249, 0.42)', tag: 'MGA' },
    };
    const style = palette[type];
    const pulse = 1 + Math.sin(this.time * 6 + gx + gy) * 0.08;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(cx, originY + (gy + 0.86) * tile, sz * 0.88, sz * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer radiant halo + rotating sparkle orbit
    ctx.fillStyle = style.glow;
    ctx.beginPath();
    ctx.arc(cx, cy, sz * 1.38 * pulse, 0, Math.PI * 2);
    ctx.fill();

    const orbitAng = this.time * 3.4 + gx + gy;
    ctx.fillStyle = style.border;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(orbitAng) * sz * 1.15, cy + Math.sin(orbitAng) * sz * 1.15, Math.max(1.5, tile * 0.055), 0, Math.PI * 2);
    ctx.fill();

    // 3D Raised Arcade Gem Pedestal
    const lip = Math.max(2.5, sz * 0.22);
    ctx.fillStyle = style.base;
    this.roundRect(ctx, cx - sz, cy - sz + lip * 0.4, sz * 2, sz * 2, 8);
    ctx.fill();

    ctx.fillStyle = style.top;
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 2;
    this.roundRect(ctx, cx - sz, cy - sz - lip * 0.25, sz * 2, sz * 1.85, 8);
    ctx.fill();
    ctx.stroke();

    // Top specular glass highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
    this.roundRect(ctx, cx - sz * 0.82, cy - sz * 0.92, sz * 1.64, sz * 0.56, 5);
    ctx.fill();

    // Crisp custom vector icon centered slightly above bottom tag
    const iy = cy - sz * 0.16;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1.6, tile * 0.048);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'bomb') {
      ctx.beginPath();
      ctx.arc(cx - sz * 0.04, iy + sz * 0.1, sz * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + sz * 0.16, iy - sz * 0.22);
      ctx.lineTo(cx + sz * 0.42, iy - sz * 0.46);
      ctx.stroke();
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(cx + sz * 0.44, iy - sz * 0.48, sz * 0.13, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'flame') {
      ctx.beginPath();
      ctx.moveTo(cx, iy - sz * 0.52);
      ctx.quadraticCurveTo(cx + sz * 0.5, iy + sz * 0.02, cx, iy + sz * 0.46);
      ctx.quadraticCurveTo(cx - sz * 0.5, iy + sz * 0.02, cx, iy - sz * 0.52);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.moveTo(cx, iy - sz * 0.18);
      ctx.quadraticCurveTo(cx + sz * 0.22, iy + sz * 0.12, cx, iy + sz * 0.36);
      ctx.quadraticCurveTo(cx - sz * 0.22, iy + sz * 0.12, cx, iy - sz * 0.18);
      ctx.fill();
    } else if (type === 'speed') {
      ctx.beginPath();
      ctx.moveTo(cx + sz * 0.16, iy - sz * 0.5);
      ctx.lineTo(cx - sz * 0.32, iy + sz * 0.04);
      ctx.lineTo(cx + sz * 0.02, iy + sz * 0.04);
      ctx.lineTo(cx - sz * 0.16, iy + sz * 0.5);
      ctx.lineTo(cx + sz * 0.34, iy - sz * 0.06);
      ctx.lineTo(cx, iy - sz * 0.06);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'kick') {
      ctx.beginPath();
      ctx.moveTo(cx - sz * 0.42, iy + sz * 0.12);
      ctx.lineTo(cx + sz * 0.36, iy + sz * 0.12);
      ctx.lineTo(cx + sz * 0.08, iy - sz * 0.24);
      ctx.moveTo(cx + sz * 0.36, iy + sz * 0.12);
      ctx.lineTo(cx + sz * 0.08, iy + sz * 0.42);
      ctx.stroke();
    } else if (type === 'shield') {
      ctx.beginPath();
      ctx.moveTo(cx, iy - sz * 0.46);
      ctx.lineTo(cx + sz * 0.4, iy - sz * 0.24);
      ctx.lineTo(cx + sz * 0.3, iy + sz * 0.22);
      ctx.lineTo(cx, iy + sz * 0.48);
      ctx.lineTo(cx - sz * 0.3, iy + sz * 0.22);
      ctx.lineTo(cx - sz * 0.4, iy - sz * 0.24);
      ctx.closePath();
      ctx.stroke();
    } else if (type === 'pierce') {
      // Piercing spear beam cutting through a box
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.strokeRect(cx - sz * 0.26, iy - sz * 0.26, sz * 0.52, sz * 0.52);
      ctx.strokeStyle = '#FEF08A';
      ctx.beginPath();
      ctx.moveTo(cx - sz * 0.54, iy);
      ctx.lineTo(cx + sz * 0.52, iy);
      ctx.moveTo(cx + sz * 0.26, iy - sz * 0.24);
      ctx.lineTo(cx + sz * 0.54, iy);
      ctx.lineTo(cx + sz * 0.26, iy + sz * 0.24);
      ctx.stroke();
    } else if (type === 'ghost') {
      // Spectral phantom body + glowing eyes
      ctx.beginPath();
      ctx.arc(cx, iy - sz * 0.08, sz * 0.36, Math.PI, 0);
      ctx.lineTo(cx + sz * 0.36, iy + sz * 0.4);
      ctx.lineTo(cx + sz * 0.18, iy + sz * 0.26);
      ctx.lineTo(cx, iy + sz * 0.4);
      ctx.lineTo(cx - sz * 0.18, iy + sz * 0.26);
      ctx.lineTo(cx - sz * 0.36, iy + sz * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(cx - sz * 0.13, iy - sz * 0.08, sz * 0.08, 0, Math.PI * 2);
      ctx.arc(cx + sz * 0.13, iy - sz * 0.08, sz * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'star') {
      // Radiant 5-point Golden Star
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? sz * 0.48 : sz * 0.21;
        const px = cx + Math.cos(ang) * rad;
        const py = iy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      // Mega Jackpot Crown/Diamond
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.moveTo(cx - sz * 0.44, iy + sz * 0.26);
      ctx.lineTo(cx - sz * 0.48, iy - sz * 0.22);
      ctx.lineTo(cx - sz * 0.18, iy + sz * 0.04);
      ctx.lineTo(cx, iy - sz * 0.4);
      ctx.lineTo(cx + sz * 0.18, iy + sz * 0.04);
      ctx.lineTo(cx + sz * 0.48, iy - sz * 0.22);
      ctx.lineTo(cx + sz * 0.44, iy + sz * 0.26);
      ctx.closePath();
      ctx.fill();
    }

    // Crisp mini badge label at bottom of capsule
    ctx.fillStyle = 'rgba(10, 15, 26, 0.78)';
    this.roundRect(ctx, cx - sz * 0.72, cy + sz * 0.34, sz * 1.44, sz * 0.54, 4);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `800 ${Math.max(8, Math.floor(tile * 0.21))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.tag, cx, cy + sz * 0.62);
    ctx.textBaseline = 'alphabetic';
  }

  private drawBomb(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    tile: number,
    bx: number,
    by: number,
    fuseTimer: number,
    maxFuse: number
  ): void {
    const cx = originX + bx * tile;
    const cy = originY + by * tile;
    const urgency = 1 - Math.max(0, Math.min(1, fuseTimer / maxFuse));
    const pulseFreq = 6 + urgency * 18;
    const pulse = Math.sin(this.time * pulseFreq);
    const scaleX = 1 + pulse * (0.06 + urgency * 0.09);
    const scaleY = 1 - pulse * (0.05 + urgency * 0.07);
    const r = tile * 0.34;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.85, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, scaleY);

    const bodyColor = urgency > 0.72 && pulse > 0 ? '#DC2626' : '#1E293B';
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = urgency > 0.72 ? '#FEF08A' : '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.24, r * 0.26, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.fillRect(-r * 0.22, -r * 1.05, r * 0.44, r * 0.28);

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = Math.max(2, tile * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.0);
    ctx.quadraticCurveTo(r * 0.35, -r * 1.35, r * 0.58, -r * 1.15);
    ctx.stroke();

    const sparkR = r * (0.24 + Math.abs(pulse) * 0.18);
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(r * 0.58, -r * 1.15, sparkR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(r * 0.58, -r * 1.15, sparkR * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawExplosionCell(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    tile: number,
    kind: string,
    alpha: number
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = px + tile / 2;
    const cy = py + tile / 2;
    const outerW = tile * 0.88;
    const midW = tile * 0.64;
    const innerW = tile * 0.38;

    ctx.fillStyle = '#EF4444';
    if (kind === 'center') {
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'h' || kind === 'end-left' || kind === 'end-right') {
      this.roundRect(ctx, px + 1, cy - outerW / 2, tile - 2, outerW, kind === 'h' ? 2 : 12);
      ctx.fill();
      ctx.fillStyle = '#F97316';
      this.roundRect(ctx, px + 1, cy - midW / 2, tile - 2, midW, kind === 'h' ? 2 : 10);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      this.roundRect(ctx, px + 1, cy - innerW / 2, tile - 2, innerW, kind === 'h' ? 2 : 8);
      ctx.fill();
    } else {
      this.roundRect(ctx, cx - outerW / 2, py + 1, outerW, tile - 2, kind === 'v' ? 2 : 12);
      ctx.fill();
      ctx.fillStyle = '#F97316';
      this.roundRect(ctx, cx - midW / 2, py + 1, midW, tile - 2, kind === 'v' ? 2 : 10);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      this.roundRect(ctx, cx - innerW / 2, py + 1, innerW, tile - 2, kind === 'v' ? 2 : 8);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    tile: number,
    p: PlayerState,
    isLocal: boolean
  ): void {
    if (p.invulnTimer > 0 && p.starTimer <= 0 && Math.floor(this.time * 16) % 2 === 0) {
      return;
    }

    if (p.isBot) {
      this.drawBug(ctx, originX, originY, tile, p);
      return;
    }

    const cx = originX + p.x * tile;
    const cy = originY + p.y * tile;
    const r = tile * 0.36;
    const avatarId: AvatarId = p.avatarId ?? 'knight';

    const koScale = p.alive ? 1 : Math.max(0.1, p.koTimer / 0.45);
    const koSpin = p.alive ? 0 : (1 - koScale) * Math.PI * 2.5;

    if (p.alive) {
      if (isLocal) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.85, r * 1.12, r * 0.44, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.82, r * 0.85, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const bob =
      p.alive && (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1)
        ? Math.abs(Math.sin(p.walkPhase)) * (tile * 0.08)
        : 0;

    ctx.save();
    if (p.ghostTimer > 0 && p.alive) {
      ctx.globalAlpha = 0.68;
    }
    ctx.translate(cx, cy - bob);
    ctx.rotate(koSpin);
    ctx.scale(koScale, koScale);

    if (p.starTimer > 0 && p.alive) {
      const starPulse = 1 + Math.sin(this.time * 14) * 0.12;
      ctx.strokeStyle = Math.floor(this.time * 12) % 2 === 0 ? '#FACC15' : '#F472B6';
      ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.44 * starPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (p.ghostTimer > 0 && p.alive) {
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.9)';
      ctx.fillStyle = 'rgba(45, 212, 191, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (p.hasShield && p.alive) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const isFlash = p.hitFlashTimer > 0;
    const footSwing = Math.sin(p.walkPhase) * (r * 0.25);

    // Distinct Ninja flowing scarf or Mage cape behind body
    if (avatarId === 'ninja') {
      const wave = Math.sin(this.time * 9 + p.walkPhase) * (r * 0.18);
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#A3E635';
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.05);
      ctx.lineTo(-r * 1.05, -r * 0.2 + wave);
      ctx.lineTo(-r * 0.9, r * 0.25 + wave);
      ctx.closePath();
      ctx.fill();
    } else if (avatarId === 'mage') {
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#581C87';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.05);
      ctx.lineTo(-r * 0.85, r * 0.72);
      ctx.lineTo(r * 0.85, r * 0.72);
      ctx.lineTo(r * 0.55, -r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Boots
    ctx.fillStyle = isFlash ? '#FFFFFF' : p.accentColor;
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, r * 0.72 + footSwing * 0.4, r * 0.26, r * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.36, r * 0.72 - footSwing * 0.4, r * 0.26, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Torso & Shoulder armor
    ctx.fillStyle = isFlash ? '#FFFFFF' : p.accentColor;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    this.roundRect(ctx, -r * 0.64, -r * 0.08, r * 1.28, r * 0.76, r * 0.32);
    ctx.fill();
    ctx.stroke();

    // Chest emblem stripe
    ctx.fillStyle = isFlash ? '#FFFFFF' : avatarId === 'samurai' ? '#FACC15' : avatarId === 'mage' ? '#FDE047' : '#F8FAFC';
    ctx.fillRect(-r * 0.24, r * 0.12, r * 0.48, r * 0.18);

    // Head Base
    ctx.fillStyle = isFlash ? '#FFFFFF' : p.color;
    ctx.beginPath();
    ctx.arc(0, -r * 0.32, r * 0.74, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Distinct Headgear Silhouette per Avatar
    if (avatarId === 'samurai') {
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#FACC15';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.9);
      ctx.lineTo(-r * 0.85, -r * 1.38);
      ctx.lineTo(-r * 0.5, -r * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.9);
      ctx.lineTo(r * 0.85, -r * 1.38);
      ctx.lineTo(r * 0.5, -r * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (avatarId === 'mage') {
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#9333EA';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, -r * 0.46);
      ctx.lineTo(0, -r * 1.45);
      ctx.lineTo(r * 0.72, -r * 0.46);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (avatarId === 'ninja') {
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#BEF264';
      ctx.fillRect(-r * 0.7, -r * 0.72, r * 1.4, r * 0.2);
    } else {
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#FACC15';
      this.roundRect(ctx, -r * 0.14, -r * 1.24, r * 0.28, r * 0.4, 4);
      ctx.fill();
      ctx.stroke();
    }

    // Visor & Eyes
    let eyeOffsetX = 0;
    let eyeOffsetY = 0;
    if (p.facing === 'left') eyeOffsetX = -r * 0.18;
    if (p.facing === 'right') eyeOffsetX = r * 0.18;
    if (p.facing === 'up') eyeOffsetY = -r * 0.16;
    if (p.facing === 'down') eyeOffsetY = r * 0.08;

    if (p.facing !== 'up') {
      ctx.fillStyle = '#0B1120';
      this.roundRect(
        ctx,
        -r * 0.46 + eyeOffsetX,
        -r * 0.52 + eyeOffsetY,
        r * 0.92,
        r * 0.44,
        r * 0.18
      );
      ctx.fill();

      ctx.fillStyle =
        avatarId === 'samurai'
          ? '#FACC15'
          : avatarId === 'ninja'
            ? '#FB923C'
            : avatarId === 'mage'
              ? '#38BDF8'
              : '#F8FAFC';

      if (avatarId === 'ninja') {
        ctx.beginPath();
        ctx.moveTo(-r * 0.34 + eyeOffsetX, -r * 0.44 + eyeOffsetY);
        ctx.lineTo(eyeOffsetX, -r * 0.2 + eyeOffsetY);
        ctx.lineTo(r * 0.34 + eyeOffsetX, -r * 0.44 + eyeOffsetY);
        ctx.lineTo(r * 0.22 + eyeOffsetX, -r * 0.44 + eyeOffsetY);
        ctx.lineTo(eyeOffsetX, -r * 0.3 + eyeOffsetY);
        ctx.lineTo(-r * 0.22 + eyeOffsetX, -r * 0.44 + eyeOffsetY);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-r * 0.26 + eyeOffsetX, -r * 0.42 + eyeOffsetY, r * 0.16, r * 0.24);
        ctx.fillRect(r * 0.1 + eyeOffsetX, -r * 0.42 + eyeOffsetY, r * 0.16, r * 0.24);
      }
    }

    ctx.restore();

    if (p.alive && p.name) {
      ctx.font = `700 ${Math.max(10, Math.floor(tile * 0.25))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0B0F17';
      ctx.fillText(p.name, cx + 1, cy - r * 1.48 + 1);
      ctx.fillStyle = isLocal ? '#FDE047' : '#E2E8F0';
      ctx.fillText(p.name, cx, cy - r * 1.48);
    }
  }

  private drawBug(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    tile: number,
    p: PlayerState
  ): void {
    const cx = originX + p.x * tile;
    const cy = originY + p.y * tile;
    const r = tile * 0.37;
    const variant = p.botVariant ?? 'slow';
    const koScale = p.alive ? 1 : Math.max(0.1, p.koTimer / 0.45);
    const koSpin = p.alive ? 0 : (1 - koScale) * Math.PI * 2.5;
    const isFlash = p.hitFlashTimer > 0;

    // Ground shadow / species indicator ring
    if (p.alive) {
      const ringColor =
        variant === 'fast'
          ? 'rgba(192, 132, 252, 0.85)'
          : variant === 'armored'
            ? 'rgba(251, 191, 36, 0.88)'
            : variant === 'ghost'
              ? 'rgba(45, 212, 191, 0.85)'
              : variant === 'charger'
                ? 'rgba(251, 146, 60, 0.90)'
                : 'rgba(244, 63, 94, 0.72)';
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = variant === 'fast' || variant === 'charger' ? 2.1 : 1.7;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.78, r * 1.02, r * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = variant === 'ghost' ? 'rgba(20, 184, 166, 0.25)' : 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.76, r * 0.82, r * 0.30, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    let angle = Math.PI / 2;
    if (p.facing === 'right') angle = 0;
    else if (p.facing === 'left') angle = Math.PI;
    else if (p.facing === 'up') angle = -Math.PI / 2;

    const bob = p.alive
      ? variant === 'ghost'
        ? Math.sin(this.time * 5.5 + p.walkPhase) * (r * 0.14)
        : Math.sin(this.time * (variant === 'fast' || p.isDashing ? 16 : 9) + p.walkPhase) * (r * 0.06)
      : 0;

    ctx.save();
    if (variant === 'ghost' && p.alive) {
      ctx.globalAlpha = 0.76;
    }
    ctx.translate(cx, cy + bob);
    ctx.rotate(angle + koSpin);
    ctx.scale(koScale, koScale);

    if (variant === 'fast') {
      // --- SPECIES 2: MOR ARİ (Sleek Striped Hornet with Flapping Wings & Stinger) ---
      if (p.alive) {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
        ctx.lineWidth = Math.max(1.5, tile * 0.045);
        ctx.beginPath();
        ctx.moveTo(-r * 1.05, -r * 0.22);
        ctx.lineTo(-r * 1.52, -r * 0.22);
        ctx.moveTo(-r * 1.05, r * 0.22);
        ctx.lineTo(-r * 1.52, r * 0.22);
        ctx.stroke();
      }

      // Sharp rear stinger
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#FDE047';
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r * 0.12);
      ctx.lineTo(-r * 1.24, 0);
      ctx.lineTo(-r * 0.85, r * 0.12);
      ctx.closePath();
      ctx.fill();

      // Narrow segmented wasp abdomen + thorax
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#6B21A8';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(-r * 0.34, 0, r * 0.56, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Golden warning stripes
      ctx.strokeStyle = isFlash ? '#FFFFFF' : '#FACC15';
      ctx.lineWidth = Math.max(2, tile * 0.06);
      ctx.beginPath();
      ctx.moveTo(-r * 0.54, -r * 0.26);
      ctx.lineTo(-r * 0.54, r * 0.26);
      ctx.moveTo(-r * 0.24, -r * 0.30);
      ctx.lineTo(-r * 0.24, r * 0.30);
      ctx.stroke();

      // Rapidly flapping translucent cyan wings
      const wingFlap = Math.sin(this.time * 34 + p.walkPhase) * 0.32;
      ctx.save();
      ctx.fillStyle = 'rgba(103, 232, 249, 0.72)';
      ctx.strokeStyle = '#ECFEFF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(-r * 0.08, -r * 0.58, r * 0.48, r * 0.22, -0.45 + wingFlap, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-r * 0.08, r * 0.58, r * 0.48, r * 0.22, 0.45 - wingFlap, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Wasp thorax + sharp head + glowing cyan eyes
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#9333EA';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(r * 0.26, 0, r * 0.30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.62, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22D3EE';
      ctx.beginPath();
      ctx.arc(r * 0.72, -r * 0.16, r * 0.11, 0, Math.PI * 2);
      ctx.arc(r * 0.72, r * 0.16, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 'armored') {
      // --- SPECIES 3: ZIRHLI GERGEDAN (Bulky Hexagonal Tank Beetle + Rhino Horn) ---
      // Heavy stubby armored legs
      ctx.strokeStyle = '#FCD34D';
      ctx.lineWidth = Math.max(2.4, tile * 0.075);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const lx = r * (-0.42 + i * 0.42);
        const swing = Math.sin(p.walkPhase * 1.4 + i * 2) * (r * 0.14);
        ctx.beginPath();
        ctx.moveTo(lx, -r * 0.65);
        ctx.lineTo(lx + swing, -r * 1.02);
        ctx.moveTo(lx, r * 0.65);
        ctx.lineTo(lx - swing, r * 1.02);
        ctx.stroke();
      }

      // Giant central Rhinoceros Horn jutting forward
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#FEF08A';
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(r * 0.56, -r * 0.22);
      ctx.lineTo(r * 1.28, 0);
      ctx.lineTo(r * 0.56, r * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wide octagonal iron-bronze armored shell
      ctx.fillStyle = isFlash ? '#FFFFFF' : p.hp > 1 ? '#B45309' : '#78350F';
      ctx.strokeStyle = p.hp > 1 ? '#FDE047' : '#FCA5A5';
      ctx.lineWidth = p.hp > 1 ? 2.6 : 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.88, -r * 0.44);
      ctx.lineTo(-r * 0.35, -r * 0.84);
      ctx.lineTo(r * 0.42, -r * 0.78);
      ctx.lineTo(r * 0.72, -r * 0.36);
      ctx.lineTo(r * 0.72, r * 0.36);
      ctx.lineTo(r * 0.42, r * 0.78);
      ctx.lineTo(-r * 0.35, r * 0.84);
      ctx.lineTo(-r * 0.88, r * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner bronze shield plate
      ctx.fillStyle = isFlash ? '#FFFFFF' : p.hp > 1 ? '#D97706' : '#92400E';
      this.roundRect(ctx, -r * 0.62, -r * 0.52, r * 1.02, r * 1.04, r * 0.2);
      ctx.fill();

      if (p.hp > 1) {
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = Math.max(2, tile * 0.06);
        ctx.beginPath();
        ctx.moveTo(-r * 0.25, -r * 0.48);
        ctx.lineTo(-r * 0.25, r * 0.48);
        ctx.moveTo(r * 0.12, -r * 0.48);
        ctx.lineTo(r * 0.12, r * 0.48);
        ctx.stroke();
      } else {
        // Cracked armor fissure when at 1 HP
        ctx.strokeStyle = '#090D16';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.48, -r * 0.36);
        ctx.lineTo(-r * 0.1, -r * 0.06);
        ctx.lineTo(-r * 0.28, r * 0.18);
        ctx.lineTo(r * 0.18, r * 0.38);
        ctx.stroke();
      }

      // Armored visor eyes
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(r * 0.46, -r * 0.32, r * 0.16, r * 0.18);
      ctx.fillRect(r * 0.46, r * 0.14, r * 0.16, r * 0.18);
    } else if (variant === 'ghost') {
      // --- SPECIES 4: HAYALET GÜVE (Wavy Spectral Phantom Moth with Mist Tails) ---
      const wave = Math.sin(this.time * 7 + p.walkPhase) * (r * 0.18);

      // Ethereal wavy phantom moth cloak / wings
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#0D9488';
      ctx.strokeStyle = '#99F6E4';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(r * 0.72, 0);
      ctx.quadraticCurveTo(r * 0.35, -r * 0.98, -r * 0.52, -r * 0.82 + wave * 0.5);
      ctx.lineTo(-r * 0.98, -r * 0.38 - wave);
      ctx.lineTo(-r * 0.72, 0);
      ctx.lineTo(-r * 0.98, r * 0.38 + wave);
      ctx.lineTo(-r * 0.52, r * 0.82 - wave * 0.5);
      ctx.quadraticCurveTo(r * 0.35, r * 0.98, r * 0.72, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner luminous spectral core
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#2DD4BF';
      ctx.beginPath();
      ctx.ellipse(r * 0.08, 0, r * 0.5, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();

      // Feathered moth antennae
      ctx.strokeStyle = '#CCFBF1';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r * 0.54, -r * 0.22);
      ctx.quadraticCurveTo(r * 0.94, -r * 0.58, r * 1.12, -r * 0.48);
      ctx.moveTo(r * 0.54, r * 0.22);
      ctx.quadraticCurveTo(r * 0.94, r * 0.58, r * 1.12, r * 0.48);
      ctx.stroke();

      // Hollow glowing spirit eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(r * 0.44, -r * 0.20, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.44, r * 0.20, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#134E4A';
      ctx.beginPath();
      ctx.arc(r * 0.48, -r * 0.20, r * 0.05, 0, Math.PI * 2);
      ctx.arc(r * 0.48, r * 0.20, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 'charger') {
      // --- SPECIES 5: ATILGAN BOYNUZ (Angular Horned Stag-Scorpion Charger) ---
      if (p.isDashing && p.alive) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = Math.max(2, tile * 0.06);
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, -r * 0.32);
        ctx.lineTo(-r * 1.56, -r * 0.32);
        ctx.moveTo(-r * 1.05, 0);
        ctx.lineTo(-r * 1.68, 0);
        ctx.moveTo(-r * 0.95, r * 0.32);
        ctx.lineTo(-r * 1.56, r * 0.32);
        ctx.stroke();
      }

      // Jagged spider/scorpion legs
      ctx.strokeStyle = '#FDBA74';
      ctx.lineWidth = Math.max(1.8, tile * 0.055);
      for (let i = 0; i < 3; i++) {
        const lx = r * (-0.36 + i * 0.36);
        const swing = Math.sin(p.walkPhase * 2 + i * 1.9) * (r * 0.2);
        ctx.beginPath();
        ctx.moveTo(lx, -r * 0.5);
        ctx.lineTo(lx - r * 0.1, -r * 0.85);
        ctx.lineTo(lx + swing, -r * 1.08);
        ctx.moveTo(lx, r * 0.5);
        ctx.lineTo(lx - r * 0.1, r * 0.85);
        ctx.lineTo(lx - swing, r * 1.08);
        ctx.stroke();
      }

      // Twin Giant Curved Bull/Stag Horns in front
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#FACC15';
      ctx.strokeStyle = '#7C2D12';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r * 0.45, -r * 0.22);
      ctx.quadraticCurveTo(r * 1.08, -r * 0.62, r * 1.32, -r * 0.12);
      ctx.quadraticCurveTo(r * 0.96, -r * 0.34, r * 0.52, -r * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(r * 0.45, r * 0.22);
      ctx.quadraticCurveTo(r * 1.08, r * 0.62, r * 1.32, r * 0.12);
      ctx.quadraticCurveTo(r * 0.96, r * 0.34, r * 0.52, r * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Angular diamond carapace
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#C2410C';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.96, 0);
      ctx.lineTo(-r * 0.25, -r * 0.68);
      ctx.lineTo(r * 0.58, -r * 0.42);
      ctx.lineTo(r * 0.58, r * 0.42);
      ctx.lineTo(-r * 0.25, r * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Blazing chevron stripe on back
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = Math.max(2, tile * 0.06);
      ctx.beginPath();
      ctx.moveTo(-r * 0.52, -r * 0.32);
      ctx.lineTo(r * 0.06, 0);
      ctx.lineTo(-r * 0.52, r * 0.32);
      ctx.stroke();

      // Glowing amber predator eyes
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(r * 0.46, -r * 0.22, r * 0.11, 0, Math.PI * 2);
      ctx.arc(r * 0.46, r * 0.22, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // --- SPECIES 1: KIZIL UĞUR (Plump Round Spotted Ladybug) ---
      ctx.strokeStyle = '#FDA4AF';
      ctx.lineWidth = Math.max(1.8, tile * 0.052);
      ctx.lineCap = 'round';
      const legPairs = [-0.38, 0, 0.38];
      for (let i = 0; i < legPairs.length; i++) {
        const lx = r * legPairs[i];
        const swing = Math.sin(p.walkPhase * 1.5 + i * 2.1) * (r * 0.18);
        ctx.beginPath();
        ctx.moveTo(lx, -r * 0.56);
        ctx.lineTo(lx + swing, -r * 0.98);
        ctx.moveTo(lx, r * 0.56);
        ctx.lineTo(lx - swing, r * 0.98);
        ctx.stroke();
      }

      // Stubby rounded antennae
      ctx.strokeStyle = '#FB7185';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r * 0.54, -r * 0.26);
      ctx.lineTo(r * 0.92, -r * 0.56);
      ctx.moveTo(r * 0.54, r * 0.26);
      ctx.lineTo(r * 0.92, r * 0.56);
      ctx.stroke();

      // Round plump ladybug body
      ctx.fillStyle = isFlash ? '#FFFFFF' : '#E11D48';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-r * 0.06, 0, r * 0.74, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Wing split seam
      ctx.strokeStyle = '#4C0519';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, 0);
      ctx.lineTo(r * 0.42, 0);
      ctx.stroke();

      // Classic 4 dark ladybug spots
      ctx.fillStyle = '#4C0519';
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 0.30, r * 0.14, 0, Math.PI * 2);
      ctx.arc(-r * 0.34, r * 0.30, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.08, -r * 0.38, r * 0.11, 0, Math.PI * 2);
      ctx.arc(r * 0.08, r * 0.38, r * 0.11, 0, Math.PI * 2);
      ctx.fill();

      // Black head cap & bright yellow eyes
      ctx.fillStyle = '#4C0519';
      ctx.beginPath();
      ctx.arc(r * 0.50, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(r * 0.62, -r * 0.17, r * 0.10, 0, Math.PI * 2);
      ctx.arc(r * 0.62, r * 0.17, r * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}
