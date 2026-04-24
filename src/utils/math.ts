// Hex coordinate math utilities using axial coordinates (flat-top layout)
// Requirements: 1.1

import type { HexCoord } from '../types/index.js';

/**
 * Converts axial hex coordinates to pixel center position.
 * Uses flat-top hexagon layout:
 *   pixel_x = size * (3/2 * q)
 *   pixel_y = size * (sqrt(3)/2 * q + sqrt(3) * r)
 *
 * @param coord - Axial hex coordinate {q, r}
 * @param size  - Hex size (center to corner distance)
 * @returns Pixel position of the hex center
 */
export function hexToPixel(coord: HexCoord, size: number): { x: number; y: number } {
  const x = size * (1.5 * coord.q);
  const y = size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

/**
 * Converts a pixel position to the nearest axial hex coordinate.
 * Inverts the flat-top hex layout formula and rounds to the nearest hex.
 *
 * @param x    - Pixel x position
 * @param y    - Pixel y position
 * @param size - Hex size (center to corner distance)
 * @returns Nearest axial hex coordinate
 */
export function pixelToHex(x: number, y: number, size: number): HexCoord {
  // Inverse of flat-top hex layout
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;

  // Convert to cube coordinates for rounding
  const s = -q - r;

  // Round to nearest cube coordinate
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  // Fix the largest rounding error to maintain cube constraint q+r+s=0
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // else rs is the largest error — rq and rr are already correct

  return { q: rq, r: rr };
}

/**
 * Computes the Manhattan distance between two hex coordinates in axial space.
 * Uses the cube coordinate formula: max(|dq|, |dr|, |ds|) where s = -q - r.
 *
 * @param a - First hex coordinate
 * @param b - Second hex coordinate
 * @returns Integer distance in hex steps
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr; // cube coordinate s = -q - r
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/**
 * Returns the 6 neighboring hex coordinates for a given axial coordinate.
 * Flat-top hex neighbors in axial coordinates.
 *
 * @param coord - Center hex coordinate
 * @returns Array of 6 neighboring hex coordinates
 */
export function hexNeighbors(coord: HexCoord): HexCoord[] {
  // Flat-top axial direction vectors
  const directions: HexCoord[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  return directions.map(dir => ({
    q: coord.q + dir.q,
    r: coord.r + dir.r,
  }));
}
