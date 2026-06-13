// Silent, per-phone tactile feedback. No audio on purpose: at a party everyone
// is on their own phone side-by-side, so shared sound would just be noise.
// Vibration only buzzes the phone in that person's hand.

export function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* unsupported — ignore */
  }
}

export const HAPTIC = {
  tap: 25, // a word guessed
  stamp: 35, // marking a board square
  start: [0, 60] as number[], // the 60s begins
  warn: [0, 30, 60, 30] as number[], // 10s left
  timeUp: [0, 140] as number[], // time's up
  win: [0, 70, 50, 70, 50, 130] as number[], // victory
};
