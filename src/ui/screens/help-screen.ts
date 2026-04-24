// Help Screen for Openspacemarin
// Requirements: 19.1–19.4
//
// Scrollable help content with 5 sections: Game Basics, Workstations,
// Upgrades, Achievements, Controls.

import { localization } from '../../systems/localization.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HELP_SCREEN_STYLES = `
.screen--help {
  display: flex;
  flex-direction: column;
  background: #0d0d1a;
  overflow: hidden;
}

.help__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #333355;
  background: #0d0d1a;
}

.help__title {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(1rem, 3vw, 1.4rem);
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #ffd700;
  text-transform: uppercase;
  flex: 1;
}

.help__back-btn {
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

.help__back-btn:hover {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

.help__content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 640px;
}

.help__section-heading {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85rem;
  font-weight: bold;
  color: #ffd700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
}

.help__section-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  color: #aaaacc;
  line-height: 1.7;
  letter-spacing: 0.03em;
}
`;

function injectHelpStyles(): void {
  if (document.getElementById('help-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'help-screen-styles';
  style.textContent = HELP_SCREEN_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Section configuration
// ---------------------------------------------------------------------------

interface HelpSection {
  headingKey: string;
  textKey: string;
  fallbackHeading: string;
  fallbackText: string;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    headingKey: 'help.section.basics',
    textKey: 'help.basics.text',
    fallbackHeading: 'Game Basics',
    fallbackText:
      'Openspacemarin is an idle game where you manage an office full of cat employees. Your cats generate currency every tick. Use that currency to buy more desks and upgrade existing ones.',
  },
  {
    headingKey: 'help.section.workstations',
    textKey: 'help.workstations.text',
    fallbackHeading: 'Workstations',
    fallbackText:
      'Each workstation holds one cat employee. Cats generate currency automatically every tick. The more desks you have, the more currency you earn. New desks cost more as your office grows.',
  },
  {
    headingKey: 'help.section.upgrades',
    textKey: 'help.upgrades.text',
    fallbackHeading: 'Upgrades',
    fallbackText:
      'Upgrading a workstation increases its currency generation. Higher upgrade levels cost more but produce exponentially more currency.',
  },
  {
    headingKey: 'help.section.achievements',
    textKey: 'help.achievements.text',
    fallbackHeading: 'Achievements',
    fallbackText:
      'Achievements reward milestones with permanent (or temporary) bonus multipliers applied to all currency generation. Check the Achievements screen to see your progress.',
  },
  {
    headingKey: 'help.section.controls',
    textKey: 'help.controls.text',
    fallbackHeading: 'Controls',
    fallbackText:
      'Desktop: click to select desks, drag to scroll. Mobile: tap to select, swipe to scroll. Use the speed buttons (1×/2×/4×) to control game pace. Pause stops all generation.',
  },
];

// ---------------------------------------------------------------------------
// HelpScreen
// ---------------------------------------------------------------------------

export class HelpScreen {
  readonly element: HTMLDivElement;

  /** Called when the player clicks the Back button. */
  onBack: () => void = () => undefined;

  constructor() {
    injectHelpStyles();
    this.element = this.buildDOM();
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const root = document.createElement('div');

    // Header
    const header = document.createElement('div');
    header.className = 'help__header';

    const backBtn = document.createElement('button');
    backBtn.className = 'help__back-btn';
    backBtn.setAttribute('type', 'button');
    backBtn.textContent = localization.t('ui.back');
    backBtn.addEventListener('click', () => this.onBack());

    const title = document.createElement('div');
    title.className = 'help__title';
    title.textContent = localization.t('help.title');

    header.appendChild(backBtn);
    header.appendChild(title);

    // Content
    const content = document.createElement('div');
    content.className = 'help__content';

    for (const section of HELP_SECTIONS) {
      content.appendChild(this.buildSection(section));
    }

    root.appendChild(header);
    root.appendChild(content);

    return root;
  }

  private buildSection(section: HelpSection): HTMLDivElement {
    const div = document.createElement('div');

    const heading = document.createElement('div');
    heading.className = 'help__section-heading';
    const headingText = localization.t(section.headingKey);
    heading.textContent =
      headingText === section.headingKey ? section.fallbackHeading : headingText;

    const text = document.createElement('p');
    text.className = 'help__section-text';
    const textContent = localization.t(section.textKey);
    text.textContent =
      textContent === section.textKey ? section.fallbackText : textContent;

    div.appendChild(heading);
    div.appendChild(text);
    return div;
  }
}
