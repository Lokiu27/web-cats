// Easing functions for animations in Openspacemarin
// Used for: particle movement, modal transitions, viewport scrolling, upgrade bar fills

export type EasingFunction = (t: number) => number;

export const Easing = {
  linear: (t: number): number => t,

  easeOutQuad: (t: number): number => t * (2 - t),

  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  easeOutBack: (t: number): number => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },

  easeInQuad: (t: number): number => t * t,

  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),

  bounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
} as const;
