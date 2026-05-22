/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';
import {
  GameStatus, GamePhase, RUN_SPEED_BASE, PowerUpType, SkinType,
  DailyMission, Achievement, SPEED_PER_LETTER, SPEED_PER_LEVEL,
  MAX_RUNNER_LEVEL, MAX_LEVEL, AircraftId, AircraftDef, AIRCRAFT_DEFS,
} from './types';

const getAudio = () => (require('./components/System/Audio') as any).audio;

// ─── Timer registry ────────────────────────────────────────────────────────
const activeTimers = new Set<ReturnType<typeof setTimeout>>();
function safeTimeout(fn: () => void, ms: number) {
  const id = setTimeout(() => { activeTimers.delete(id); fn(); }, ms);
  activeTimers.add(id); return id;
}
function clearAllTimers() { activeTimers.forEach(clearTimeout); activeTimers.clear(); }

// ─── Persisted ────────────────────────────────────────────────────────────
const savedHighScore      = Number(localStorage.getItem('gr_highscore'))  || 0;
const savedMuted          = localStorage.getItem('gr_muted') === 'true';
const savedGems           = Number(localStorage.getItem('gr_gems'))        || 0;
const savedXP             = Number(localStorage.getItem('gr_xp'))          || 0;
const savedSkins          = JSON.parse(localStorage.getItem('gr_skins')    || '["DEFAULT"]') as SkinType[];
const savedAircrafts      = JSON.parse(localStorage.getItem('gr_aircraft') || '[]') as AircraftId[];

// ─── Mission pool ─────────────────────────────────────────────────────────
const MISSION_POOL: Omit<DailyMission,'current'|'completed'>[] = [
  { id:'m1', label:'Gem Hunter',     target:30,   reward:200, type:'gems'     },
  { id:'m2', label:'Long Runner',    target:1000, reward:300, type:'distance' },
  { id:'m3', label:'Word Wizard',    target:6,    reward:250, type:'letters'  },
  { id:'m4', label:'Ghost Mode',     target:1,    reward:400, type:'noHit'    },
  { id:'m5', label:'Ace Pilot',      target:20,   reward:350, type:'kills'    },
  { id:'m6', label:'Speed Demon',    target:2000, reward:500, type:'distance' },
];
function pickDailyMissions(): DailyMission[] {
  const key = new Date().toDateString();
  try {
    const c = JSON.parse(localStorage.getItem('gr_missions') || '{}');
    if (c.date === key) return c.missions;
  } catch {}
  const m = [...MISSION_POOL].sort(()=>Math.random()-.5).slice(0,3).map(x=>({...x,current:0,completed:false}));
  localStorage.setItem('gr_missions', JSON.stringify({date:key,missions:m}));
  return m;
}
function saveMissions(m: DailyMission[]) {
  localStorage.setItem('gr_missions', JSON.stringify({date:new Date().toDateString(),missions:m}));
}

// ─── Achievements ─────────────────────────────────────────────────────────
const ALL_ACH: Achievement[] = [
  {id:'first_run', label:'First Steps',   description:'Complete first run',       unlocked:false, icon:'🏃'},
  {id:'dist_500',  label:'Marathoner',    description:'Travel 500 light years',   unlocked:false, icon:'🚀'},
  {id:'level5',    label:'Phase Break',   description:'Complete Level 5 Runner',  unlocked:false, icon:'🌌'},
  {id:'level10',   label:'Galaxy Ace',   description:'Complete all 10 levels',   unlocked:false, icon:'🏆'},
  {id:'gems_100',  label:'Gem Hunter',   description:'Collect 100 gems one run', unlocked:false, icon:'💎'},
  {id:'no_hit',    label:'Untouchable',  description:'Finish without damage',    unlocked:false, icon:'🛡️'},
  {id:'score_10k', label:'High Scorer',  description:'Score 10,000 in one run',  unlocked:false, icon:'⭐'},
  {id:'combo_10',  label:'Combo King',   description:'Reach ×10 combo',          unlocked:false, icon:'🔥'},
  {id:'ace_20',    label:'Ace Pilot',    description:'Destroy 20 enemies',       unlocked:false, icon:'✈️'},
  {id:'rocket_ace',label:'Rocket Ace',   description:'Kill enemy with rocket',   unlocked:false, icon:'🚀'},
];
function loadAch(): Achievement[] {
  try {
    const s = JSON.parse(localStorage.getItem('gr_achievements')||'[]') as {id:string;unlocked:boolean}[];
    return ALL_ACH.map(a=>({...a,unlocked:s.find(x=>x.id===a.id)?.unlocked??false}));
  } catch { return ALL_ACH; }
}
function saveAch(list: Achievement[]) {
  localStorage.setItem('gr_achievements', JSON.stringify(list.map(a=>({id:a.id,unlocked:a.unlocked}))));
}

// ─── Reset state ──────────────────────────────────────────────────────────
const runnerReset = () => ({
  status:            GameStatus.PLAYING as GameStatus,
  phase:             GamePhase.RUNNER   as GamePhase,
  score:             0,
  lives:             3,
  maxLives:          3,
  speed:             RUN_SPEED_BASE,
  collectedLetters:  [] as number[],
  level:             1,
  laneCount:         3,
  gemsCollected:     0,
  distance:          0,
  hasDoubleJump:     false,
  hasImmortality:    false,
  isImmortalityActive: false,
  shieldActive:      false,
  magnetActive:      false,
  speedBoostActive:  false,
  comboMultiplier:   1,
  comboStreak:       0,
  isSliding:         false,
  screenShake:       0,
  noHitRun:          true,
  newAchievements:   [] as string[],
  enemyKills:        0,
  rocketsLeft:       3,
  selectedAircraft:  null as AircraftId | null,
  shooterActive:     false,
});

// ─── Store interface ──────────────────────────────────────────────────────
interface GameState {
  status:            GameStatus;
  phase:             GamePhase;
  score:             number;
  highScore:         number;
  lives:             number;
  maxLives:          number;
  speed:             number;
  collectedLetters:  number[];
  level:             number;
  laneCount:         number;
  gemsCollected:     number;
  totalGems:         number;
  distance:          number;
  xp:                number;
  playerLevel:       number;

  shieldActive:      boolean;
  magnetActive:      boolean;
  speedBoostActive:  boolean;

  currentSkin:       SkinType;
  unlockedSkins:     SkinType[];

  hasDoubleJump:     boolean;
  hasImmortality:    boolean;
  isImmortalityActive: boolean;

  isMuted:           boolean;
  comboMultiplier:   number;
  comboStreak:       number;
  isSliding:         boolean;
  screenShake:       number;
  noHitRun:          boolean;
  newAchievements:   string[];

  dailyMissions:     DailyMission[];
  achievements:      Achievement[];

  // Shooter phase
  selectedAircraft:  AircraftId | null;
  unlockedAircrafts: AircraftId[];
  enemyKills:        number;
  rocketsLeft:       number;
  shooterActive:     boolean;

  // Actions
  startGame:         () => void;
  restartGame:       () => void;
  pauseGame:         () => void;
  resumeGame:        () => void;
  togglePause:       () => void;
  takeDamage:        () => void;
  addScore:          (n: number) => void;
  collectGem:        (v: number) => void;
  collectLetter:     (i: number) => void;
  collectPowerUp:    (t: PowerUpType) => void;
  setStatus:         (s: GameStatus) => void;
  setDistance:       (d: number) => void;
  setSkin:           (s: SkinType) => void;
  unlockSkin:        (s: SkinType, cost: number) => boolean;
  buyItem:           (t: 'DOUBLE_JUMP'|'MAX_LIFE'|'HEAL'|'IMMORTAL', cost: number) => boolean;
  advanceLevel:      () => void;
  openShop:          () => void;
  closeShop:         () => void;
  activateImmortality: () => void;
  toggleMute:        () => void;
  startSlide:        () => void;
  endSlide:          () => void;
  breakCombo:        () => void;
  applyScreenShake:  (t: number) => void;
  decayScreenShake:  (d: number) => void;
  dismissAchievements: () => void;
  claimMissionReward:  (id: string) => void;
  // Shooter
  selectAircraft:    (id: AircraftId) => void;
  unlockAircraft:    (id: AircraftId) => boolean;
  enterShooterPhase: () => void;
  fireRocket:        () => void;
  addKill:           (points: number) => void;
}

const xpForLevel = (l: number) => l * l * 500;
const getPlayerLevel = (xp: number) => { let l=1; while(xp>=xpForLevel(l+1))l++; return l; };

export const useStore = create<GameState>((set, get) => ({
  status:            GameStatus.MENU,
  phase:             GamePhase.RUNNER,
  score:             0,
  highScore:         savedHighScore,
  lives:             3,
  maxLives:          3,
  speed:             0,
  collectedLetters:  [],
  level:             1,
  laneCount:         3,
  gemsCollected:     0,
  totalGems:         savedGems,
  distance:          0,
  xp:                savedXP,
  playerLevel:       getPlayerLevel(savedXP),

  shieldActive:      false,
  magnetActive:      false,
  speedBoostActive:  false,

  currentSkin:       SkinType.DEFAULT,
  unlockedSkins:     savedSkins,

  hasDoubleJump:     false,
  hasImmortality:    false,
  isImmortalityActive: false,

  isMuted:           savedMuted,
  comboMultiplier:   1,
  comboStreak:       0,
  isSliding:         false,
  screenShake:       0,
  noHitRun:          true,
  newAchievements:   [],

  dailyMissions:     pickDailyMissions(),
  achievements:      loadAch(),

  selectedAircraft:  null,
  unlockedAircrafts: [AircraftId.FALCON, ...savedAircrafts],
  enemyKills:        0,
  rocketsLeft:       3,
  shooterActive:     false,

  // ── Basic actions ───────────────────────────────────────────────────────
  startGame:   () => { clearAllTimers(); set(runnerReset()); },
  restartGame: () => { clearAllTimers(); set(runnerReset()); },
  pauseGame:   () => { if(get().status===GameStatus.PLAYING) set({status:GameStatus.PAUSED}); },
  resumeGame:  () => { if(get().status===GameStatus.PAUSED)  set({status:GameStatus.PLAYING}); },
  togglePause: () => {
    const {status}=get();
    if(status===GameStatus.PLAYING) set({status:GameStatus.PAUSED});
    else if(status===GameStatus.PAUSED) set({status:GameStatus.PLAYING});
  },
  setStatus: (status) => set({ status }),
  startSlide: () => { set({isSliding:true}); safeTimeout(()=>set({isSliding:false}),600); },
  endSlide:   () => {},
  breakCombo: () => set({comboMultiplier:1,comboStreak:0}),
  applyScreenShake: (t) => set(s=>({screenShake:Math.min(1,s.screenShake+t)})),
  decayScreenShake: (d) => set(s=>({screenShake:Math.max(0,s.screenShake-d*2.5)})),
  dismissAchievements: () => set({newAchievements:[]}),
  addScore: (n) => set(s=>({score:s.score+n})),

  // ── takeDamage ──────────────────────────────────────────────────────────
  takeDamage: () => {
    const {lives,isImmortalityActive,shieldActive}=get();
    if(isImmortalityActive) return;
    if(shieldActive){set({shieldActive:false});return;}
    get().applyScreenShake(0.6);
    get().breakCombo();
    set(s=>({noHitRun:false}));
    if(lives>1){ set({lives:lives-1}); return; }

    const {score,highScore,distance,gemsCollected,level,noHitRun,achievements,xp,totalGems,enemyKills}=get();
    const newHigh = Math.max(score,highScore);
    if(score>highScore) localStorage.setItem('gr_highscore',String(score));
    const xpEarned = Math.floor(score/10)+Math.floor(distance)+level*100+enemyKills*50;
    const newXP    = xp+xpEarned;
    localStorage.setItem('gr_xp',String(newXP));
    const newTotal = totalGems+gemsCollected;
    localStorage.setItem('gr_gems',String(newTotal));

    const unlocked:string[]=[];
    const newAch = achievements.map(a=>{
      if(a.unlocked) return a;
      let u=false;
      if(a.id==='first_run')  u=true;
      if(a.id==='dist_500'  && distance>=500)      u=true;
      if(a.id==='level5'    && level>=5)            u=true;
      if(a.id==='gems_100'  && gemsCollected>=100)  u=true;
      if(a.id==='no_hit'    && noHitRun)            u=true;
      if(a.id==='score_10k' && score>=10000)        u=true;
      if(a.id==='ace_20'    && enemyKills>=20)      u=true;
      if(u) {unlocked.push(a.id); return {...a,unlocked:true};}
      return a;
    });
    saveAch(newAch);

    const missions=get().dailyMissions.map(m=>{
      let cur=m.current;
      if(m.type==='distance'&&!m.completed) cur=Math.min(m.target,Math.floor(distance));
      if(m.type==='letters' &&!m.completed) cur=Math.min(m.target,get().collectedLetters.length+cur);
      if(m.type==='noHit'   &&!m.completed&&noHitRun) cur=1;
      if(m.type==='kills'   &&!m.completed) cur=Math.min(m.target,enemyKills);
      return {...m,current:cur,completed:cur>=m.target};
    });
    saveMissions(missions);

    set({lives:0,status:GameStatus.GAME_OVER,speed:0,highScore:newHigh,xp:newXP,
      playerLevel:getPlayerLevel(newXP),totalGems:newTotal,achievements:newAch,
      newAchievements:unlocked,dailyMissions:missions});
  },

  // ── collectGem ──────────────────────────────────────────────────────────
  collectGem: (value) => {
    const {comboStreak,comboMultiplier,dailyMissions}=get();
    const newStreak=comboStreak+1;
    const newMult=Math.min(10,1+Math.floor(newStreak/5));
    const earned=value*newMult;
    const newAch=newMult>=10?get().achievements.map(a=>a.id==='combo_10'&&!a.unlocked?{...a,unlocked:true}:a):get().achievements;
    if(newMult>=10) saveAch(newAch);
    const missions=dailyMissions.map(m=>m.type==='gems'&&!m.completed?{...m,current:Math.min(m.target,m.current+1),completed:m.current+1>=m.target}:m);
    set(s=>({score:s.score+earned,gemsCollected:s.gemsCollected+1,comboStreak:newStreak,comboMultiplier:newMult,achievements:newAch,dailyMissions:missions}));
  },

  // ── collectPowerUp ──────────────────────────────────────────────────────
  collectPowerUp: (type) => {
    if(type===PowerUpType.SHIELD){getAudio().playShieldActivate();set({shieldActive:true});}
    else if(type===PowerUpType.MAGNET){getAudio().playPowerUp();set({magnetActive:true});safeTimeout(()=>set({magnetActive:false}),10000);}
    else if(type===PowerUpType.SPEED_BOOST){getAudio().playPowerUp();set(s=>({speedBoostActive:true,speed:s.speed*1.4}));safeTimeout(()=>set(s=>({speedBoostActive:false,speed:s.speed/1.4})),5000);}
  },

  // ── collectLetter ───────────────────────────────────────────────────────
  collectLetter: (index) => {
    const {collectedLetters,level,speed}=get();
    if(collectedLetters.includes(index)) return;
    const newLetters=[...collectedLetters,index];
    const newSpeed=speed+RUN_SPEED_BASE*SPEED_PER_LETTER;
    const missions=get().dailyMissions.map(m=>m.type==='letters'&&!m.completed?{...m,current:Math.min(m.target,m.current+1),completed:m.current+1>=m.target}:m);
    set({collectedLetters:newLetters,speed:newSpeed,dailyMissions:missions});

    if(newLetters.length===6){
      if(level<MAX_RUNNER_LEVEL) get().advanceLevel();
      else {
        // Level 5 complete → aircraft selection!
        const {score,highScore,achievements}=get();
        const newHigh=Math.max(score+5000,highScore);
        if(newHigh>highScore) localStorage.setItem('gr_highscore',String(newHigh));
        const newAch=achievements.map(a=>a.id==='level5'&&!a.unlocked?{...a,unlocked:true}:a);
        saveAch(newAch);
        set({score:score+5000,highScore:newHigh,achievements:newAch,status:GameStatus.AIRCRAFT_SELECT});
      }
    }
  },

  // ── advanceLevel — handles runner (1-5) and shooter (6-10) ─────────────
  advanceLevel: () => {
    const {level,laneCount,speed,achievements,phase}=get();
    const next=level+1;

    // Shooter phase level advance
    if(phase===GamePhase.SHOOTER){
      if(next>MAX_LEVEL){ set({status:GameStatus.VICTORY}); return; }
      const newAch=achievements.map(a=>{
        if(a.id==='level10'&&next>=10&&!a.unlocked) return {...a,unlocked:true};
        return a;
      });
      saveAch(newAch);
      set({level:next,achievements:newAch,collectedLetters:[]});
      return;
    }

    // Runner phase level advance
    const newSpeed=speed+RUN_SPEED_BASE*SPEED_PER_LEVEL;
    const newLanes=Math.min(laneCount+2,9);
    const newAch=achievements.map(a=>{
      if(a.id==='level5'&&next>=5&&!a.unlocked) return {...a,unlocked:true};
      return a;
    });
    saveAch(newAch);
    set({level:next,laneCount:newLanes,status:GameStatus.PLAYING,speed:newSpeed,collectedLetters:[],achievements:newAch});
  },

  setDistance: (dist) => {
    const missions=get().dailyMissions.map(m=>m.type==='distance'&&!m.completed?{...m,current:Math.min(m.target,Math.floor(dist)),completed:Math.floor(dist)>=m.target}:m);
    set({distance:dist,dailyMissions:missions});
  },

  setSkin:    (skin)  => set({currentSkin:skin}),
  openShop:   ()      => set({status:GameStatus.SHOP}),
  closeShop:  ()      => set({status:GameStatus.PLAYING}),

  unlockSkin: (skin,cost) => {
    const {totalGems,unlockedSkins}=get();
    if(totalGems>=cost&&!unlockedSkins.includes(skin)){
      const ng=totalGems-cost; const ns=[...unlockedSkins,skin];
      localStorage.setItem('gr_gems',String(ng));
      localStorage.setItem('gr_skins',JSON.stringify(ns));
      set({totalGems:ng,unlockedSkins:ns}); return true;
    } return false;
  },

  buyItem: (type,cost) => {
    const {score,maxLives,lives}=get();
    if(score<cost) return false;
    set({score:score-cost});
    if(type==='DOUBLE_JUMP') set({hasDoubleJump:true});
    if(type==='MAX_LIFE')    set({maxLives:maxLives+1,lives:lives+1});
    if(type==='HEAL')        set({lives:Math.min(lives+1,maxLives)});
    if(type==='IMMORTAL')    set({hasImmortality:true});
    return true;
  },

  activateImmortality: () => {
    const {hasImmortality,isImmortalityActive}=get();
    if(!hasImmortality||isImmortalityActive) return;
    set({isImmortalityActive:true});
    safeTimeout(()=>set({isImmortalityActive:false}),5000);
  },

  toggleMute: () => {
    const next=!get().isMuted;
    set({isMuted:next});
    localStorage.setItem('gr_muted',String(next));
    getAudio().setMuted(next);
  },

  claimMissionReward: (id) => {
    const {dailyMissions,totalGems}=get();
    const m=dailyMissions.find(x=>x.id===id);
    if(!m||!m.completed) return;
    const newM=dailyMissions.map(x=>x.id===id?{...x,current:-1}:x);
    const ng=totalGems+m.reward;
    localStorage.setItem('gr_gems',String(ng));
    saveMissions(newM);
    set({dailyMissions:newM,totalGems:ng});
  },

  // ── Shooter phase actions ────────────────────────────────────────────────
  selectAircraft: (id) => {
    const {unlockedAircrafts}=get();
    if(unlockedAircrafts.includes(id)){
      const def=AIRCRAFT_DEFS.find(a=>a.id===id)!;
      set({selectedAircraft:id,lives:def.health,maxLives:def.health,rocketsLeft:3});
    }
  },

  unlockAircraft: (id) => {
    const {totalGems,unlockedAircrafts}=get();
    const def=AIRCRAFT_DEFS.find(a=>a.id===id)!;
    if(totalGems>=def.cost&&!unlockedAircrafts.includes(id)){
      const ng=totalGems-def.cost;
      const na=[...unlockedAircrafts,id];
      localStorage.setItem('gr_gems',String(ng));
      localStorage.setItem('gr_aircraft',JSON.stringify(na));
      set({totalGems:ng,unlockedAircrafts:na}); return true;
    } return false;
  },

  enterShooterPhase: () => {
    const {selectedAircraft}=get();
    const def=AIRCRAFT_DEFS.find(a=>a.id===selectedAircraft)||AIRCRAFT_DEFS[0];
    clearAllTimers();
    set({
      status:       GameStatus.PLAYING,
      phase:        GamePhase.SHOOTER,
      level:        6,
      lives:        def.health,
      maxLives:     def.health,
      rocketsLeft:  3,
      enemyKills:   0,
      shooterActive:true,
      speed:        0,
      collectedLetters:[],
    });
  },

  fireRocket: () => {
    const {rocketsLeft}=get();
    if(rocketsLeft>0){
      set({rocketsLeft:rocketsLeft-1});
      window.dispatchEvent(new Event('fire-rocket'));
      getAudio().playBoost();
    }
  },

  addKill: (points) => {
    const {enemyKills,achievements,dailyMissions}=get();
    const newKills=enemyKills+1;
    const newAch=achievements.map(a=>{
      if(a.id==='ace_20'&&newKills>=20&&!a.unlocked) return {...a,unlocked:true};
      return a;
    });
    saveAch(newAch);
    const missions=dailyMissions.map(m=>m.type==='kills'&&!m.completed?{...m,current:Math.min(m.target,m.current+1),completed:m.current+1>=m.target}:m);
    set(s=>({score:s.score+points,enemyKills:newKills,achievements:newAch,dailyMissions:missions}));
  },
}));
