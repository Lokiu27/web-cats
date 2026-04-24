// Shared TypeScript interfaces and type definitions for Openspacemarin

// --- Union Types ---

export type FurColor = 'orange' | 'gray' | 'white' | 'black' | 'brown' | 'tabby';
export type FurPattern = 'solid' | 'spotted' | 'striped' | 'gradient';
export type Expression = 'focused' | 'smiling' | 'serious';
export type Accessory = 'glasses' | 'tie' | 'bow' | 'none';
export type Pose = 'upright' | 'leaning';

// DeskTier: basic (level 0), improved (level 1), modern (level 2), premium (level 3)
export type DeskTier = 'basic' | 'improved' | 'modern' | 'premium';

export type AchievementCategory =
  | 'office_expansion'
  | 'upgrades'
  | 'currency_generation'
  | 'play_time'
  | 'special';

export type ScreenType =
  | 'splash'
  | 'welcome'
  | 'main_menu'
  | 'game'
  | 'achievements'
  | 'statistics'
  | 'settings'
  | 'help'
  | 'about';

export type AnimationFrame = { action: 'idle' | 'working'; frame: number };

export type ParticleType = 'coin' | 'upgrade_sparkle' | 'confetti' | 'glow';

export type SFXType =
  | 'button_click'
  | 'window_open'
  | 'window_close'
  | 'purchase'
  | 'upgrade'
  | 'error'
  | 'achievement'
  | 'currency_tick'
  | 'meow';

export type IconType =
  | 'currency'
  | 'desk'
  | 'achievement_star'
  | 'settings_gear'
  | 'menu'
  | 'pause'
  | 'play';

export type UIElement = 'button' | 'panel' | 'progress_bar' | 'modal_frame' | 'tab';

export type UIElementState = 'normal' | 'hover' | 'pressed' | 'disabled' | 'active';

// --- Core Data Interfaces ---

export interface HexCoord {
  q: number; // Axial coordinate q (column)
  r: number; // Axial coordinate r (row)
}

export interface CatAppearance {
  furColor: FurColor;
  pattern: FurPattern;
  expression: Expression;
  accessory: Accessory;
  pose: Pose;
}

export interface Cat {
  name: string;
  appearance: CatAppearance;
  biography: string;
}

export interface Desk {
  id: string;
  hexCoord: HexCoord;
  upgradeLevel: number;
  cat: Cat;
}

// --- Achievement Types ---

export type AchievementCondition =
  | { type: 'desk_count'; target: number }
  | { type: 'single_desk_level'; target: number }
  | { type: 'total_upgrades'; target: number }
  | { type: 'total_currency'; target: number }
  | { type: 'play_time_hours'; target: number }
  | { type: 'all_desks_same_level'; minDesks: number }
  | { type: 'specialist'; levelGap: number }
  | { type: 'equilibrium'; minDesks: number }
  | { type: 'speed_start'; desksTarget: number; ticksLimit: number }
  | { type: 'all_desks_min_level'; minLevel: number; minDesks: number };

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  nameKey: string;
  descriptionKey: string;
  bonusPercent: number;
  isTemporary: boolean;
  durationTicks?: number;
  condition: AchievementCondition;
}

export interface AchievementState {
  id: string;
  unlocked: boolean;
  unlockedAtTick?: number;
  progress: number;
  temporaryBonusExpiresTick?: number;
}

export interface Achievement {
  definition: AchievementDefinition;
  state: AchievementState;
}

export interface AchievementProgress {
  definition: AchievementDefinition;
  state: AchievementState;
  progressPercent: number;
}

// --- Settings and Statistics ---

export interface GameSettings {
  language: 'en' | 'ru';
  musicVolume: number; // 0-10
  sfxVolume: number; // 0-10
  defaultSpeed: 1 | 2 | 4;
  tickIntervalSeconds: 1 | 3 | 5;
}

export interface GameStatistics {
  totalDesksEverPurchased: number;
  highestDeskLevel: number;
  totalAchievementsUnlocked: number;
  recentAchievements: string[]; // Last 10 achievement IDs
  gameStartTick: number;
}

// --- Core Game State ---

export interface GameState {
  version: number;
  desks: Desk[];
  currency: number;
  totalGeneratedCurrency: number;
  totalUpgradeCount: number;
  playTimeTicks: number;
  achievements: AchievementState[];
  settings: GameSettings;
  statistics: GameStatistics;
  firstLaunchDone: boolean;
}

// --- Rendering Types ---

export interface Viewport {
  offsetX: number;
  width: number;
  height: number;
  scale: number;
  parallaxLayers: number[];
}

export interface PurchaseResult {
  success: boolean;
  desk?: Desk;
  newCurrency?: number;
  error?: 'insufficient_currency';
}

export interface UpgradeResult {
  success: boolean;
  newLevel?: number;
  newGeneration?: number;
  newCurrency?: number;
  error?: 'insufficient_currency' | 'desk_not_found' | 'max_level_reached';
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

// --- GameEvent Discriminated Union ---

export type GameEvent =
  | { type: 'tick'; tickCount: number; deltaMs: number }
  | { type: 'desk_purchased'; desk: Desk }
  | { type: 'desk_upgraded'; desk: Desk; newLevel: number }
  | { type: 'currency_changed'; oldValue: number; newValue: number; delta: number }
  | { type: 'achievement_unlocked'; achievement: Achievement }
  | { type: 'game_saved' }
  | { type: 'game_loaded'; state: GameState }
  | { type: 'language_changed'; lang: 'en' | 'ru' }
  | { type: 'speed_changed'; multiplier: number }
  | { type: 'pause_toggled'; paused: boolean }
  | { type: 'screen_changed'; from: ScreenType; to: ScreenType }
  | { type: 'hex_clicked'; coord: HexCoord; occupied: boolean }
  | { type: 'viewport_scrolled'; offsetX: number };

// --- Core System Interfaces ---

export interface IGameLoop {
  start(): void;
  stop(): void;
  isPaused(): boolean;
  getFrameRate(): number;
}

export interface ITimeController {
  setSpeed(multiplier: 1 | 2 | 4): void;
  getSpeed(): number;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  getTickCount(): number;
  getTickIntervalMs(): number;
  setTickInterval(seconds: 1 | 3 | 5): void;
  onTick(callback: () => void): void;
}

export interface IEconomyCalculator {
  getDeskPurchaseCost(totalDesks: number): number;
  getUpgradeCost(upgradeLevel: number): number;
  getDeskGeneration(upgradeLevel: number): number;
  getFinalGeneration(baseGeneration: number, achievementBonusSum: number): number;
  getTotalGenerationPerTick(desks: Desk[], achievementBonusSum: number): number;
  getDeskPaybackTime(totalDesks: number, achievementBonusSum: number): number;
  getUpgradePaybackTime(upgradeLevel: number, achievementBonusSum: number): number;
  formatCurrency(value: number): string;
}

export interface IDeskManager {
  getDesks(): Desk[];
  getDeskAt(hexCoord: HexCoord): Desk | null;
  purchaseDesk(state: GameState): PurchaseResult;
  upgradeDesk(deskId: string, state: GameState): UpgradeResult;
  getTotalDesks(): number;
}

export interface IAchievementManager {
  getAchievements(achievementStates?: AchievementState[]): Achievement[];
  getAchievementsByCategory(category: AchievementCategory, achievementStates?: AchievementState[]): Achievement[];
  checkAndUnlock(state: GameState): Achievement[];
  getTotalBonusSum(achievementStates: AchievementState[], currentTick: number): number;
  getUnlockedCount(achievementStates: AchievementState[]): number;
  getTotalCount(): number;
  getNextClosestAchievement(state: GameState): AchievementProgress | null;
}

export interface ISaveSystem {
  save(state: GameState): SaveResult;
  load(): GameState | null;
  hasSaveData(): boolean;
  deleteSave(): void;
  getSaveVersion(): number;
}

export interface ILocalizationSystem {
  setLanguage(lang: 'en' | 'ru'): void;
  getLanguage(): 'en' | 'ru';
  t(key: string, params?: Record<string, string | number>): string;
  getCatName(index: number): string;
}

export interface ICatAppearanceGenerator {
  generate(): CatAppearance;
  generateName(existingNames: string[], language: 'en' | 'ru'): string;
  generateBiography(language: 'en' | 'ru'): string;
}

export interface IPixelArtGenerator {
  generateHexSprite(state: 'empty' | 'occupied' | 'highlighted'): OffscreenCanvas;
  generateHexFloorTile(): OffscreenCanvas;
  generateDeskSprite(tier: DeskTier): OffscreenCanvas;
  generateDeskGlow(tier: DeskTier): OffscreenCanvas;
  generateCatSprite(appearance: CatAppearance, frame: AnimationFrame): OffscreenCanvas;
  generateCatShadow(): OffscreenCanvas;
  generateUISprite(element: UIElement, state: UIElementState): OffscreenCanvas;
  generateIcon(type: IconType): OffscreenCanvas;
  generateParticleSprite(type: ParticleType): OffscreenCanvas;
  generateBackgroundLayer(layer: 'wall' | 'floor' | 'decorations', width: number): OffscreenCanvas;
  getFromCache(key: string): OffscreenCanvas | null;
  clearCache(): void;
}

export interface IColorPalette {
  office: { wall: string[]; floor: string[]; furniture: string[] };
  cats: Record<FurColor, string[]>;
  ui: { primary: string[]; accent: string[]; success: string[]; error: string[]; gold: string[] };
  effects: { sparkle: string[]; confetti: string[]; glow: string[] };
}

export interface IAudioSystem {
  playMusic(pattern: number): void;
  stopMusic(): void;
  setMusicVolume(level: number): void;
  playSFX(effect: SFXType): void;
  setSFXVolume(level: number): void;
}

export interface IHexGridRenderer {
  render(ctx: CanvasRenderingContext2D, viewport: Viewport, desks: Desk[]): void;
  screenToHex(screenX: number, screenY: number): HexCoord | null;
  hexToScreen(coord: HexCoord): { x: number; y: number };
  setHighlighted(coord: HexCoord | null): void;
  scrollBy(dx: number): void;
  getViewport(): Viewport;
}

export interface IEventBus {
  emit<T extends GameEvent>(event: T): void;
  on<K extends GameEvent['type']>(
    type: K,
    handler: (event: Extract<GameEvent, { type: K }>) => void,
  ): () => void;
  off<K extends GameEvent['type']>(
    type: K,
    handler: (event: Extract<GameEvent, { type: K }>) => void,
  ): void;
  once<K extends GameEvent['type']>(
    type: K,
    handler: (event: Extract<GameEvent, { type: K }>) => void,
  ): void;
}
