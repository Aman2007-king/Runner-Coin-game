/**
 * Single source of truth for the mobile/low-power device check.
 * Previously this exact regex+width check was copy-pasted as a
 * module-level const in App.tsx, Player.tsx, LevelManager.tsx,
 * Environment.tsx, and Effects.tsx — five places to keep in sync
 * if the threshold or detection logic ever needs to change.
 *
 * Evaluated once at module load, same as the original per-file consts.
 */
export const IS_MOBILE =
  /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
