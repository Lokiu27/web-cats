// Color palettes for Openspacemarin
// Requirements: 21.1, 25.8 (≤32 colors per sprite category)
// All palettes use vibrant, modern pixel-art colors

import type { DeskTier } from '../types/index.js';

export const COLORS = {
  office: {
    wall: ['#2d3561', '#3d4a7a', '#4a5a8a', '#5a6a9a', '#6a7aaa', '#7a8aba'],
    floor: ['#1a1a2e', '#16213e', '#0f3460', '#1a2a4a', '#2a3a5a', '#3a4a6a'],
    furniture: ['#4a3728', '#5a4738', '#6a5748', '#7a6758', '#8a7768', '#9a8778'],
  },
  cats: {
    orange: ['#ff6b35', '#ff8c42', '#ffa552', '#ffbe6a', '#ffd080', '#ffe8a0'],
    gray: ['#6b7280', '#7d8a96', '#8f9aaa', '#a1aab8', '#b3bac6', '#c5cad4'],
    white: ['#e8e8e8', '#f0f0f0', '#f5f5f5', '#fafafa', '#ffffff', '#d0d0d0'],
    black: ['#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4a4a', '#5a5a5a', '#6a6a6a'],
    brown: ['#8b4513', '#a0522d', '#b5651d', '#cd853f', '#d2691e', '#daa520'],
    tabby: ['#c8a96e', '#d4b87a', '#e0c786', '#b89060', '#a07850', '#886040'],
  },
  ui: {
    primary: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#ffffff'],
    accent: ['#ffd700', '#ffaa00', '#ff8800', '#ff6600', '#ff4400', '#ff2200'],
    success: ['#00c851', '#00a843', '#008a35', '#006c27', '#004e19', '#00300b'],
    error: ['#ff4444', '#cc0000', '#aa0000', '#880000', '#660000', '#440000'],
    gold: ['#ffd700', '#ffcc00', '#ffbb00', '#ffaa00', '#ff9900', '#ff8800'],
  },
  effects: {
    sparkle: ['#ffffff', '#ffffaa', '#ffff55', '#ffdd00', '#ffaa00', '#ff7700'],
    confetti: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff', '#ff9f43'],
    glow: ['#ffffff', '#ffffee', '#ffffcc', '#ffff99', '#ffff66', '#ffff33'],
  },
} as const;

/**
 * Returns a color set for a given desk tier.
 * Used for rendering desk sprites with tier-appropriate colors.
 *
 * @param tier - The desk tier (basic, improved, modern, premium)
 * @returns Object with primary, secondary, and accent color strings
 */
export function getDeskTierColors(tier: DeskTier): {
  primary: string;
  secondary: string;
  accent: string;
} {
  switch (tier) {
    case 'basic':
      return {
        primary: COLORS.office.furniture[0],   // '#4a3728' — dark wood
        secondary: COLORS.office.furniture[2], // '#6a5748' — mid wood
        accent: COLORS.ui.primary[3],          // '#533483' — purple accent
      };
    case 'improved':
      return {
        primary: COLORS.office.furniture[2],   // '#6a5748' — mid wood
        secondary: COLORS.ui.primary[2],       // '#0f3460' — dark blue
        accent: COLORS.ui.accent[0],           // '#ffd700' — gold accent
      };
    case 'modern':
      return {
        primary: COLORS.ui.primary[2],         // '#0f3460' — dark blue
        secondary: COLORS.ui.primary[3],       // '#533483' — purple
        accent: COLORS.ui.accent[1],           // '#ffaa00' — amber accent
      };
    case 'premium':
      return {
        primary: COLORS.ui.primary[3],         // '#533483' — deep purple
        secondary: COLORS.ui.gold[0],          // '#ffd700' — gold
        accent: COLORS.effects.glow[0],        // '#ffffff' — white glow
      };
  }
}
