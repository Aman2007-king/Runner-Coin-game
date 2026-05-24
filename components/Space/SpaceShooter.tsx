/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Space Shooter — Levels 6-10
 * Top-down 2D canvas game inspired by classic arcade space shooters.
 * Player ship at bottom, enemies scroll down from top, auto-fire bullets,
 * tap rocket button for powerful rockets (3 per level).
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { GameStatus, AircraftModel, AIRCRAFT_SPECS, PowerUpType, ROCKETS_PER_LEVEL } from '../../types';

/* ─── Virtual canvas dimensions ─────────────────────────────────────────── */
const VW = 390;
const VH = 700;
const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

/* ─── Scrolling star layers ──────────────────────────────────────────────── */
interface Star { x: number; y: number; r: number; spd: number; alpha: number }
const STARS: Star[] = Array.from({ length: IS_MOBILE ? 70 : 140 }, () => ({
  x: Math.random() * VW,
  y: Math.random() * VH,
  r: Math.random() * 1.6 + 0.3,
  spd: 0.8 + Math.random() * 3,
  alpha: 0.25 + Math.random() * 0.75,
}));

/* ─── Entity types ───────────────────────────────────────────────────────── */
type Kind = 'bullet' | 'rocket' | 'enemy' | 'enemyBullet' | 'gem' | 'powerup' | 'asteroid' | 'boss';
interface Entity {
  id: number; kind: Kind;
  x: number; y: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  active: boolean;
  color: string;
  pts: number;
  r: number;           // collision radius
  fireCD: number;      // enemy fire cooldown
  powerUpType?: PowerUpType;
  // boss rotation state
  angle?: number;
  wave?: number;       // sine wave offset
  phase?: number;      // movement phase
}

let _eid = 0;
const eid = () => ++_eid;

/* ─── Explosion particles ────────────────────────────────────────────────── */
interface Spark { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; r:number; color:string }

/* ─── Level config ───────────────────────────────────────────────────────── */
const LVL = (level: number) => {
  const d = level - 5; // 1-5
  return {
    d,
    enemyHp:     (t: 'small'|'medium'|'boss') => t==='boss' ? 15+d*8 : t==='medium' ? 3+d : 1,
    enemySpd:    60 + d * 22,
    spawnRate:   Math.max(0.4, 1.8 - d * 0.28),
    bossChance:  d >= 3 ? 0.06 : 0,
    medChance:   0.22 + d * 0.06,
    bulletSpd:   180 + d * 30,
    enemyFireCD: Math.max(0.8, 2.2 - d * 0.3),
    killTarget:  10 + d * 8,   // kills to advance to next level
    asteroidRate:Math.max(1.0, 3.0 - d * 0.35),
  };
};

/* ─── Aircraft drawing ───────────────────────────────────────────────────── */
function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number,
  id: AircraftModel, col: string, acc: string, t: number) {

  ctx.save(); ctx.translate(x, y);

  // Engine exhaust glow
  const eg = ctx.createRadialGradient(0, 24, 0, 0, 24, 26);
  eg.addColorStop(0, acc + 'cc'); eg.addColorStop(1, 'transparent');
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(0, 24, 22, 0, Math.PI * 2); ctx.fill();

  // Flickering thrust flames
  const fh = 8 + Math.sin(t * 18) * 3;
  const fg = ctx.createLinearGradient(0, 18, 0, 18 + fh);
  fg.addColorStop(0, '#ff8800'); fg.addColorStop(1, 'transparent');
  ctx.fillStyle = fg;

  ctx.fillStyle = col;
  if (id === AircraftModel.ALPHA) {
    // Sleek delta
    ctx.beginPath(); ctx.moveTo(0,-30); ctx.lineTo(-18,12); ctx.lineTo(-6,4); ctx.lineTo(0,16); ctx.lineTo(6,4); ctx.lineTo(18,12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = acc;
    ctx.beginPath(); ctx.moveTo(0,-25); ctx.lineTo(-4,2); ctx.lineTo(0,9); ctx.lineTo(4,2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6600'; ctx.fillRect(-14,10,6,9,); ctx.fillRect(8,10,6,9);
    ctx.fillStyle = '#ff9900';
    ctx.beginPath(); ctx.moveTo(-11,19); ctx.lineTo(-11,19+fh); ctx.lineTo(-8,19); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(11,19); ctx.lineTo(11,19+fh); ctx.lineTo(8,19); ctx.closePath(); ctx.fill();
  } else if (id === AircraftModel.BETA) {
    // Phantom stealth
    ctx.beginPath(); ctx.moveTo(0,-27); ctx.lineTo(-25,8); ctx.lineTo(-14,2); ctx.lineTo(-10,16); ctx.lineTo(0,10); ctx.lineTo(10,16); ctx.lineTo(14,2); ctx.lineTo(25,8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = acc;
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(-4,4); ctx.lineTo(0,12); ctx.lineTo(4,4); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.35 + Math.sin(t * 2.5) * 0.1;
    ctx.strokeStyle = acc; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-25,8); ctx.lineTo(25,8); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff6600'; ctx.fillRect(-8,12,16,7);
  } else if (id === AircraftModel.GAMMA) {
    // Titan heavy
    ctx.fillRect(-15,-30,30,54);
    ctx.fillRect(-25,-8,10,24); ctx.fillRect(15,-8,10,24);
    ctx.fillStyle = acc; ctx.fillRect(-8,-26,16,42);
    ctx.fillStyle = '#555'; ctx.fillRect(-19,-34,5,14); ctx.fillRect(14,-34,5,14);
    ctx.fillStyle = '#ff2200'; ctx.fillRect(-19,-38,5,7); ctx.fillRect(14,-38,5,7);
    ctx.fillStyle = '#ff6600'; ctx.fillRect(-12,20,24,7);
    // double exhaust
    for (let i = -1; i <= 1; i += 2) {
      const ff = ctx.createLinearGradient(i*6,26,i*6,26+fh+4);
      ff.addColorStop(0,'#ff8800'); ff.addColorStop(1,'transparent');
      ctx.fillStyle = ff;
      ctx.beginPath(); ctx.moveTo(i*6-4,26); ctx.lineTo(i*6+4,26); ctx.lineTo(i*6,26+fh+4); ctx.closePath(); ctx.fill();
    }
  } else {
    // Delta aurora
    ctx.beginPath(); ctx.ellipse(0,-8,12,28,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-17,2,7,14,0.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(17,2,7,14,-0.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = acc;
    ctx.beginPath(); ctx.ellipse(0,-6,6,18,0,0,Math.PI*2); ctx.fill();
    // Energy rings
    ctx.save(); ctx.rotate(t);
    ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.globalAlpha = 0.3 + Math.sin(t*4)*0.15;
    ctx.beginPath(); ctx.ellipse(0,0,22,8,0,0,Math.PI*2); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff6600'; ctx.fillRect(-6,18,12,8);
  }

  ctx.restore();
}

/* ─── Draw enemy ─────────────────────────────────────────────────────────── */
function drawEnemy(ctx: CanvasRenderingContext2D, en: Entity, t: number) {
  ctx.save(); ctx.translate(en.x, en.y);
  const pulse = 1 + Math.sin(t * 5 + en.id) * 0.04;
  ctx.scale(pulse, pulse);

  if (en.kind === 'enemy') {
    ctx.fillStyle = en.color;
    ctx.beginPath(); ctx.moveTo(0,20); ctx.lineTo(-13,-12); ctx.lineTo(0,-7); ctx.lineTo(13,-12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ff9999'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0,15); ctx.lineTo(-8,-6); ctx.lineTo(0,-2); ctx.lineTo(8,-6); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ff8888'; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
  } else if (en.kind === 'asteroid') {
    ctx.fillStyle = '#665544';
    // irregular asteroid polygon
    const pts = 9; const base = en.r * 1.1;
    ctx.beginPath();
    for (let i=0;i<pts;i++){
      const a = (i/pts)*Math.PI*2;
      const r = base * (0.75 + Math.sin(en.id * 1.3 + i * 2.1) * 0.25);
      i===0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#998866'; ctx.lineWidth = 1.5; ctx.stroke();
    // crater detail
    ctx.fillStyle = '#443322';
    ctx.beginPath(); ctx.arc(en.r*0.3, -en.r*0.2, en.r*0.22, 0, Math.PI*2); ctx.fill();
  } else if (en.kind === 'boss') {
    // BOSS ship — large, intimidating
    ctx.fillStyle = en.color;
    ctx.beginPath(); ctx.moveTo(0,46); ctx.lineTo(-34,-16); ctx.lineTo(-22,-8); ctx.lineTo(-18,-32); ctx.lineTo(18,-32); ctx.lineTo(22,-8); ctx.lineTo(34,-16); ctx.closePath(); ctx.fill();
    // Core glow
    const cg = ctx.createRadialGradient(0,4,0,0,4,18);
    cg.addColorStop(0,'#ffffff'); cg.addColorStop(0.4,en.color); cg.addColorStop(1,'transparent');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0,4,18,0,Math.PI*2); ctx.fill();
    // Rotating gun pods
    ctx.save(); ctx.rotate(t * 0.9);
    ctx.fillStyle = '#880088';
    for (let i=0;i<4;i++){
      ctx.save(); ctx.rotate(i*Math.PI/2);
      ctx.fillRect(-3,-30,6,14);
      ctx.restore();
    }
    ctx.restore();
    // HP bar below
    const bw = 80;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw/2,52,bw,8);
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(-bw/2,52,bw*(en.hp/en.maxHp),8);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(-bw/2,52,bw,8);
    // Medium enemy hp bar
  } else {
    // medium
    ctx.fillStyle = en.color;
    ctx.beginPath(); ctx.moveTo(0,28); ctx.lineTo(-18,-10); ctx.lineTo(-8,-5); ctx.lineTo(-5,-20); ctx.lineTo(5,-20); ctx.lineTo(8,-5); ctx.lineTo(18,-10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,2,8,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#ffcc44'; ctx.beginPath(); ctx.arc(0,2,4,0,Math.PI*2); ctx.fill();
    // hp bar
    if (en.hp < en.maxHp) {
      const bw = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-bw/2,-34,bw,5);
      ctx.fillStyle = '#ff8800'; ctx.fillRect(-bw/2,-34,bw*(en.hp/en.maxHp),5);
    }
  }
  ctx.restore();
}

/* ─── Draw power-up ──────────────────────────────────────────────────────── */
function drawPowerUp(ctx: CanvasRenderingContext2D, p: Entity, t: number) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t);
  const col = p.powerUpType===PowerUpType.SHIELD?'#00ffff':p.powerUpType===PowerUpType.MAGNET?'#ff00ff':'#ffff00';
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
  const inner = ctx.createRadialGradient(0,0,2,0,0,12);
  inner.addColorStop(0, col+'44'); inner.addColorStop(1,'transparent');
  ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = col; ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const icon = p.powerUpType===PowerUpType.SHIELD?'🛡':p.powerUpType===PowerUpType.MAGNET?'⚡':'🚀';
  ctx.fillText(icon,0,0);
  ctx.restore();
}

/* ─── Main SpaceShooter component ────────────────────────────────────────── */
export const SpaceShooter: React.FC = () => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const entities    = useRef<Entity[]>([]);
  const sparks      = useRef<Spark[]>([]);
  const playerX     = useRef(VW / 2);
  const targetX     = useRef(VW / 2);
  const invTimer    = useRef(0);
  const spawnT      = useRef(0);
  const astT        = useRef(0);
  const lastFire    = useRef(0);
  const killCount   = useRef(0);
  const raf         = useRef(0);
  const prevTime    = useRef(performance.now());
  const elapsed     = useRef(0);
  const scorePopups = useRef<{x:number;y:number;text:string;life:number}[]>([]);

  const { status, level, selectedAircraft, takeDamageSpace, collectSpaceGem,
          advanceSpaceLevel, addScore, collectPowerUp, fireRocket: storeFireRocket,
          rocketsRemaining, spaceGemsCollected } = useStore();

  const aircraftId = (selectedAircraft ?? AircraftModel.ALPHA) as AircraftModel;
  const spec       = AIRCRAFT_SPECS[aircraftId];
  const cfg        = LVL(level);

  /* ── Explosion helper ──────────────────────────────────────────────────── */
  const explode = useCallback((x: number, y: number, color: string, count=22) => {
    for (let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2, s = 30+Math.random()*160;
      sparks.current.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
        life:0.5+Math.random()*0.6, maxLife:0.5+Math.random()*0.6, r:2+Math.random()*4, color });
    }
  }, []);

  /* ── Fire rocket ───────────────────────────────────────────────────────── */
  const handleRocket = useCallback(() => {
    if (useStore.getState().rocketsRemaining <= 0) return;
    storeFireRocket();
    // spawn rocket entity
    const px = playerX.current;
    entities.current.push({ id:eid(), kind:'rocket', x:px, y:VH*0.82-30,
      vx:0, vy:-680, hp:10, maxHp:10, active:true, color:'#ff6600', pts:0, r:12, fireCD:0 });
    explode(px, VH*0.82-30, '#ff8800', 8);
  }, [storeFireRocket, explode]);

  /* ── Rocket button event ───────────────────────────────────────────────── */
  useEffect(() => {
    window.addEventListener('fire-rocket-ui', handleRocket);
    return () => window.removeEventListener('fire-rocket-ui', handleRocket);
  }, [handleRocket]);

  /* ── Input handlers ────────────────────────────────────────────────────── */
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      targetX.current = ((e.clientX - rect.left) / rect.width) * VW;
    };
    const tMove = (e: TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      targetX.current = ((e.touches[0].clientX - rect.left) / rect.width) * VW;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', tMove, { passive: false });
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', tMove); };
  }, []);

  /* ── Main game loop ────────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let alive = true;

    // reset on mount
    entities.current = [];
    sparks.current   = [];
    playerX.current  = VW / 2;
    targetX.current  = VW / 2;
    invTimer.current = 0;
    spawnT.current   = 0;
    astT.current     = cfg.asteroidRate;
    lastFire.current = 0;
    killCount.current= 0;
    elapsed.current  = 0;
    prevTime.current = performance.now();

    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min((now - prevTime.current) / 1000, 0.05);
      prevTime.current = now;
      elapsed.current += dt;
      const t = elapsed.current;

      const st = useStore.getState();
      if (st.status === GameStatus.PAUSED) { raf.current = requestAnimationFrame(loop); return; }
      if (st.status !== GameStatus.PLAYING) { raf.current = requestAnimationFrame(loop); return; }

      /* ── Player movement ─────────────────────────────────────────────── */
      const spd = spec.enhancedAgility ? 340 : 280;
      const dx  = targetX.current - playerX.current;
      playerX.current += Math.sign(dx) * Math.min(Math.abs(dx), spd * dt);
      playerX.current  = Math.max(22, Math.min(VW - 22, playerX.current));

      /* ── Auto-fire ───────────────────────────────────────────────────── */
      const fireRate = aircraftId === AircraftModel.GAMMA ? 7 : 5;
      if (now - lastFire.current > 1000 / fireRate) {
        lastFire.current = now;
        const py = VH * 0.82 - 36;
        if (spec.doubleBlasters) {
          entities.current.push(
            { id:eid(), kind:'bullet', x:playerX.current-12, y:py, vx:0, vy:-520, hp:1,maxHp:1,active:true,color:spec.color,pts:0,r:5,fireCD:0 },
            { id:eid(), kind:'bullet', x:playerX.current+12, y:py, vx:0, vy:-520, hp:1,maxHp:1,active:true,color:spec.color,pts:0,r:5,fireCD:0 },
          );
        } else {
          entities.current.push({ id:eid(), kind:'bullet', x:playerX.current, y:py, vx:0, vy:-520, hp:1,maxHp:1,active:true,color:spec.color,pts:0,r:5,fireCD:0 });
        }
      }

      /* ── Spawn enemies ───────────────────────────────────────────────── */
      spawnT.current -= dt;
      if (spawnT.current <= 0) {
        spawnT.current = cfg.spawnRate + Math.random() * 0.35;
        const r = Math.random();
        const isBoss   = r < cfg.bossChance && killCount.current > 0 && killCount.current % cfg.killTarget === 0;
        const isMedium = !isBoss && r < cfg.bossChance + cfg.medChance;
        const kind: Kind = isBoss ? 'boss' : isMedium ? 'enemy' : 'enemy';
        const hp   = isBoss ? cfg.enemyHp('boss') : isMedium ? cfg.enemyHp('medium') : cfg.enemyHp('small');
        const col  = isBoss ? '#ff00ff' : isMedium ? '#ff8800' : '#ff3333';
        const r_val = isBoss ? 38 : isMedium ? 22 : 13;
        const count = isBoss ? 1 : Math.random() < 0.35 + cfg.d*0.07 ? 2 : 1;

        for (let k=0;k<count;k++) {
          const ex = 30 + Math.random() * (VW - 60);
          const wave = Math.random() * Math.PI * 2;
          const vy_base = isBoss ? cfg.enemySpd * 0.45 : isMedium ? cfg.enemySpd * 0.7 : cfg.enemySpd;
          entities.current.push({
            id:eid(), kind: isBoss ? 'boss' : kind,
            x:ex, y:-r_val-10,
            vx: isMedium ? (Math.random()-.5)*50 : 0,
            vy: vy_base * (0.9 + Math.random()*0.2),
            hp, maxHp:hp, active:true, color:col, pts: isBoss?2000:isMedium?300:100,
            r:r_val, fireCD: cfg.enemyFireCD + Math.random()*0.8,
            wave, angle:0,
          });
        }
      }

      /* ── Spawn asteroids ─────────────────────────────────────────────── */
      astT.current -= dt;
      if (astT.current <= 0) {
        astT.current = cfg.asteroidRate + Math.random() * 0.5;
        const big = Math.random() < 0.28;
        entities.current.push({
          id:eid(), kind:'asteroid',
          x: 30 + Math.random()*(VW-60),
          y: -50,
          vx: (Math.random()-.5)*40,
          vy: 55 + cfg.d * 18 + Math.random()*25,
          hp: big?4:1, maxHp:big?4:1, active:true, color:'#887755',
          pts:80, r:big?22:13, fireCD:0,
        });
      }

      /* ── Spawn gems ──────────────────────────────────────────────────── */
      if (Math.random() < 0.025) {
        entities.current.push({ id:eid(), kind:'gem', x:30+Math.random()*(VW-60), y:-14, vx:(Math.random()-.5)*25, vy:65+Math.random()*30, hp:1,maxHp:1,active:true,color:'#00ffcc',pts:150,r:12,fireCD:0 });
      }
      // Power-up rare spawn
      if (Math.random() < 0.004) {
        const pu = [PowerUpType.SHIELD, PowerUpType.MAGNET, PowerUpType.SPEED_BOOST][Math.floor(Math.random()*3)];
        entities.current.push({ id:eid(), kind:'powerup', x:30+Math.random()*(VW-60), y:-14, vx:0, vy:55, hp:1,maxHp:1,active:true,color:'#ffffff',pts:0,r:16,fireCD:0,powerUpType:pu });
      }

      /* ── Move & enemy AI ─────────────────────────────────────────────── */
      const py_ship = VH * 0.82;
      entities.current.forEach(en => {
        if (!en.active) return;
        en.x += en.vx * dt;
        en.y += en.vy * dt;

        // Boss wave pattern
        if (en.kind === 'boss') {
          en.angle = (en.angle??0) + dt * 1.2;
          en.x = VW/2 + Math.sin(en.angle) * (VW * 0.3);
          if (en.y > VH * 0.25) en.vy = Math.max(0, en.vy - 30 * dt);
        }
        // Medium sine drift
        if (en.kind === 'enemy' && en.maxHp > 1) {
          en.x += Math.sin(elapsed.current * 2.5 + (en.wave??0)) * 55 * dt;
        }

        // Enemy fire
        if ((en.kind === 'enemy' || en.kind === 'boss') && en.y > 0) {
          en.fireCD -= dt;
          if (en.fireCD <= 0) {
            en.fireCD = cfg.enemyFireCD * (en.kind==='boss' ? 0.4 : 1) + Math.random()*0.5;
            const dx2 = playerX.current - en.x, dy2 = py_ship - en.y;
            const mag = Math.sqrt(dx2*dx2 + dy2*dy2) || 1;
            const bs  = cfg.bulletSpd * (en.kind==='boss' ? 1.3 : 1);
            // Boss fires spread
            const shots = en.kind==='boss' ? 5 : 1;
            for (let s=0;s<shots;s++){
              const spread = en.kind==='boss' ? (s - 2) * 0.25 : 0;
              const vx2 = (dx2/mag + Math.sin(spread)) * bs;
              const vy2 = (dy2/mag + Math.cos(spread) - 1) * bs * 0.5 + dy2/mag * bs * 0.5;
              entities.current.push({ id:eid(), kind:'enemyBullet', x:en.x, y:en.y+en.r,
                vx:vx2, vy:vy2, hp:1,maxHp:1,active:true,color: en.kind==='boss'?'#ff00ff':'#ff3300',pts:0,r:6,fireCD:0 });
            }
          }
        }
        // Clamp enemies horizontally
        if (en.x < en.r) { en.x = en.r; en.vx = Math.abs(en.vx); }
        if (en.x > VW-en.r) { en.x = VW-en.r; en.vx = -Math.abs(en.vx); }
      });

      /* ── Update sparks ───────────────────────────────────────────────── */
      sparks.current.forEach(s => {
        s.x += s.vx*dt; s.y += s.vy*dt;
        s.vy += 100*dt; s.vx *= 0.97;
        s.life -= dt;
      });

      /* ── Collisions ──────────────────────────────────────────────────── */
      // Player bullets vs enemies/asteroids
      entities.current.filter(b=>b.active&&(b.kind==='bullet'||b.kind==='rocket')).forEach(bul=>{
        const isRocket = bul.kind === 'rocket';
        const hitR     = isRocket ? 28 : bul.r;
        entities.current.filter(en=>en.active&&(en.kind==='enemy'||en.kind==='asteroid'||en.kind==='boss')).forEach(en=>{
          if (Math.abs(bul.x-en.x)<en.r+hitR && Math.abs(bul.y-en.y)<en.r+hitR) {
            const dmg = isRocket ? 6 : 1;
            en.hp -= dmg;
            if (!isRocket) bul.active = false;
            explode(en.x, en.y, en.color, isRocket ? 18 : 6);
            if (en.hp <= 0) {
              en.active = false;
              const earned = en.pts * Math.max(1, useStore.getState().comboMultiplier);
              addScore(earned);
              killCount.current++;
              scorePopups.current.push({ x:en.x, y:en.y, text:`+${earned}`, life:1.2 });
              explode(en.x, en.y, en.color, isRocket ? 40 : 22);
              // Level advance check
              if (killCount.current >= cfg.killTarget && level < 10) {
                killCount.current = 0;
                useStore.getState().advanceSpaceLevel();
              } else if (level >= 10 && killCount.current >= cfg.killTarget) {
                useStore.getState().advanceSpaceLevel(); // triggers VICTORY
              }
            }
          }
        });
      });

      // Enemy bullets & enemies vs player
      if (invTimer.current <= 0) {
        entities.current.filter(en=>en.active&&(en.kind==='enemyBullet'||en.kind==='enemy'||en.kind==='asteroid'||en.kind==='boss')).forEach(en=>{
          if (Math.abs(en.x-playerX.current)<en.r+16 && Math.abs(en.y-py_ship)<en.r+20) {
            en.active = false;
            takeDamageSpace();
            invTimer.current = 2.0;
            explode(playerX.current, py_ship, '#ffffff', 15);
          }
        });
      } else {
        invTimer.current -= dt;
      }

      // Gems & powerups vs player
      entities.current.filter(en=>en.active&&(en.kind==='gem'||en.kind==='powerup')).forEach(en=>{
        // Magnet hull
        if (spec.magnetizedHull && en.kind === 'gem') {
          const mdx = playerX.current - en.x, mdy = py_ship - en.y;
          const md  = Math.sqrt(mdx*mdx+mdy*mdy);
          if (md < 100) { en.x += (mdx/md)*85*dt; en.y += (mdy/md)*85*dt; }
        }
        if (Math.abs(en.x-playerX.current)<en.r+16 && Math.abs(en.y-py_ship)<en.r+22) {
          en.active = false;
          if (en.kind==='gem') {
            collectSpaceGem(en.pts);
            explode(en.x,en.y,'#00ffcc',10);
            scorePopups.current.push({x:en.x,y:en.y,text:`+${en.pts}`,life:1});
          } else if (en.powerUpType) {
            collectPowerUp(en.powerUpType);
            explode(en.x,en.y,en.color,8);
          }
        }
      });

      /* ── Remove off-screen ───────────────────────────────────────────── */
      entities.current = entities.current.filter(en => en.active && en.y < VH+80 && en.y > -150 && en.x > -80 && en.x < VW+80);
      sparks.current   = sparks.current.filter(s => s.life > 0);
      scorePopups.current = scorePopups.current.filter(p => p.life > 0);
      scorePopups.current.forEach(p => p.life -= dt);

      /* ── RENDER ──────────────────────────────────────────────────────── */
      const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
      const sx = cw/VW, sy = ch/VH;

      ctx.save(); ctx.scale(sx, sy);

      // Background
      ctx.fillStyle = '#000010'; ctx.fillRect(0,0,VW,VH);

      // Space nebula glow (level-tinted)
      const nebulaColors = ['#0a0030','#200010','#080020','#001820','#100000'];
      const ng = ctx.createRadialGradient(VW/2,VH/2,50,VW/2,VH/2,340);
      ng.addColorStop(0, nebulaColors[Math.min(level-6,4)] || '#0a0030');
      ng.addColorStop(1,'transparent');
      ctx.fillStyle = ng; ctx.fillRect(0,0,VW,VH);

      // Stars scroll
      STARS.forEach(s => {
        s.y += s.spd * (0.9 + cfg.d * 0.25) * dt * 60;
        if (s.y > VH) { s.y = -4; s.x = Math.random()*VW; }
        ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      });

      // Sparks
      sparks.current.forEach(s => {
        const a = s.life / s.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r*a,0,Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Enemy bullets
      entities.current.filter(e=>e.kind==='enemyBullet').forEach(b => {
        const bg = ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,10);
        bg.addColorStop(0,b.color+'cc'); bg.addColorStop(1,'transparent');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(b.x,b.y,10,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x,b.y,5,0,Math.PI*2); ctx.fill();
      });

      // Player bullets
      entities.current.filter(e=>e.kind==='bullet').forEach(b => {
        ctx.strokeStyle = b.color; ctx.lineWidth = 3;
        ctx.shadowColor = b.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x,b.y-18); ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // Rockets
      entities.current.filter(e=>e.kind==='rocket').forEach(r => {
        ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(r.x,r.y); ctx.lineTo(r.x,r.y-32); ctx.stroke();
        ctx.fillStyle = '#ff8800'; ctx.beginPath(); ctx.arc(r.x,r.y,7,0,Math.PI*2); ctx.fill();
        const rg=ctx.createRadialGradient(r.x,r.y+5,0,r.x,r.y+5,16);
        rg.addColorStop(0,'rgba(255,150,0,0.9)'); rg.addColorStop(1,'transparent');
        ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(r.x,r.y+5,14,0,Math.PI*2); ctx.fill();
      });

      // Gems
      entities.current.filter(e=>e.kind==='gem').forEach(g => {
        ctx.save(); ctx.translate(g.x,g.y); ctx.rotate(t*2.2);
        const gg=ctx.createRadialGradient(0,0,0,0,0,g.r);
        gg.addColorStop(0,'#ffffff'); gg.addColorStop(0.35,'#00ffcc'); gg.addColorStop(1,'transparent');
        ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(0,0,g.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#00ffcc'; ctx.lineWidth=1.5;
        ctx.beginPath();
        for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.lineTo(Math.cos(a)*9,Math.sin(a)*9);}
        ctx.closePath(); ctx.stroke();
        ctx.restore();
      });

      // Power-ups
      entities.current.filter(e=>e.kind==='powerup').forEach(p => drawPowerUp(ctx,p,t));

      // Enemies & asteroids
      entities.current.filter(e=>e.kind==='enemy'||e.kind==='asteroid'||e.kind==='boss').forEach(en => drawEnemy(ctx,en,t));

      // Player ship
      const inv = invTimer.current > 0 && Math.floor(t*10)%2===0;
      if (!inv) {
        drawShip(ctx, playerX.current, VH*0.82, aircraftId, spec.color, spec.color==='#00ffff'?'#88ffff':spec.color==='#ff44ff'?'#ffaaff':spec.color==='#ffff00'?'#ffffaa':'#88ffcc', t);
        // Shield ring
        const storeState = useStore.getState();
        if (storeState.shieldActive) {
          ctx.strokeStyle = spec.color; ctx.lineWidth = 2.5;
          ctx.shadowColor = spec.color; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(playerX.current, VH*0.82, 38, 0, Math.PI*2); ctx.stroke();
          ctx.shadowBlur = 0;
          const sg=ctx.createRadialGradient(playerX.current,VH*0.82,18,playerX.current,VH*0.82,38);
          sg.addColorStop(0,'transparent'); sg.addColorStop(1,spec.color+'33');
          ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(playerX.current,VH*0.82,38,0,Math.PI*2); ctx.fill();
        }
      }

      // Kill progress bar (top of screen)
      const killPct = Math.min(1, killCount.current / cfg.killTarget);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(10,8,VW-20,8);
      const pg=ctx.createLinearGradient(10,8,VW-10,8);
      pg.addColorStop(0,'#00ffff'); pg.addColorStop(0.5,'#aa00ff'); pg.addColorStop(1,'#ff00aa');
      ctx.fillStyle=pg; ctx.fillRect(10,8,(VW-20)*killPct,8);
      ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.strokeRect(10,8,VW-20,8);

      // Score popups
      scorePopups.current.forEach(p => {
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = '#ffff00'; ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y - (1.2 - p.life) * 40);
      });
      ctx.globalAlpha = 1; ctx.textAlign = 'left';

      ctx.restore();
      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf.current); };
  }, [level, aircraftId, spec, cfg]); // eslint-disable-line

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full touch-none"
      style={{ cursor: 'none', background: '#000010' }}
    />
  );
};
