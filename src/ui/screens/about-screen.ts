// About Screen for Openspacemarin
// Requirements: 19.1–19.4
//
// Displays game name, version, developer info, and year.

import { localization } from '../../systems/localization.js';
import { GAME_VERSION } from './splash-screen.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ABOUT_SCREEN_STYLES = `
.screen--about {
  display: flex;
  flex-direction: column;
  background: #0d0d1a;
  overflow: hidden;
}

.about__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #333355;
  background: #0d0d1a;
}

.about__title {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(1rem, 3vw, 1.4rem);
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #ffd700;
  text-transform: uppercase;
  flex: 1;
}

.about__back-btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  color: #ccccdd;
  background: #0d0d1a;
  border: 1px solid #333355;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.about__back-btn:hover {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

.about__content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 1.5rem;
  text-align: center;
}

.about__game-name {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(1.5rem, 5vw, 2.5rem);
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #ffd700;
  text-shadow:
    0 0 10px rgba(255, 215, 0, 0.5),
    0 0 20px rgba(255, 215, 0, 0.25);
  text-transform: uppercase;
}

.about__slogan {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(0.6rem, 2vw, 0.8rem);
  color: #666688;
  letter-spacing: 0.15em;
  max-width: 400px;
}

.about__info-table {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border: 1px solid #222244;
  border-radius: 4px;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.02);
  min-width: 240px;
}

.about__info-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.about__info-label {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.65rem;
  color: #666688;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.about__info-value {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.78rem;
  color: #ccccdd;
  letter-spacing: 0.05em;
  text-align: right;
}

.about__info-value--highlight {
  color: #ffd700;
}

.about__divider {
  width: 60px;
  height: 1px;
  background: #333355;
}
`;

function injectAboutStyles(): void {
  if (document.getElementById('about-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'about-screen-styles';
  style.textContent = ABOUT_SCREEN_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// AboutScreen
// ---------------------------------------------------------------------------

export class AboutScreen {
  readonly element: HTMLDivElement;

  /** Called when the player clicks the Back button. */
  onBack: () => void = () => undefined;

  constructor() {
    injectAboutStyles();
    this.element = this.buildDOM();
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const root = document.createElement('div');

    // Header
    const header = document.createElement('div');
    header.className = 'about__header';

    const backBtn = document.createElement('button');
    backBtn.className = 'about__back-btn';
    backBtn.setAttribute('type', 'button');
    backBtn.textContent = localization.t('ui.back');
    backBtn.addEventListener('click', () => this.onBack());

    const title = document.createElement('div');
    title.className = 'about__title';
    title.textContent = localization.t('about.title');

    header.appendChild(backBtn);
    header.appendChild(title);

    // Content
    const content = document.createElement('div');
    content.className = 'about__content';

    // Game name
    const gameName = document.createElement('div');
    gameName.className = 'about__game-name';
    gameName.textContent = localization.t('about.game_name');

    // Slogan
    const slogan = document.createElement('div');
    slogan.className = 'about__slogan';
    slogan.textContent = localization.t('about.slogan');

    // Divider
    const divider = document.createElement('div');
    divider.className = 'about__divider';

    // Info table
    const infoTable = document.createElement('div');
    infoTable.className = 'about__info-table';

    infoTable.appendChild(
      this.buildInfoRow(
        localization.t('about.version_label'),
        `v${GAME_VERSION}`,
        true,
      ),
    );
    infoTable.appendChild(
      this.buildInfoRow(
        localization.t('about.developer_label'),
        localization.t('about.developer_name'),
        false,
      ),
    );
    infoTable.appendChild(
      this.buildInfoRow(
        '',
        '2025',
        false,
      ),
    );

    content.appendChild(gameName);
    content.appendChild(slogan);
    content.appendChild(divider);
    content.appendChild(infoTable);

    root.appendChild(header);
    root.appendChild(content);

    return root;
  }

  private buildInfoRow(
    label: string,
    value: string,
    highlight: boolean,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'about__info-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'about__info-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = highlight
      ? 'about__info-value about__info-value--highlight'
      : 'about__info-value';
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }
}
