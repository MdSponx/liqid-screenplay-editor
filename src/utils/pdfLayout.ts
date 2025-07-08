export const FONT_SIZE = 12;
export const LINE_HEIGHT_MULTIPLIER = 1.25;
export const LINE_HEIGHT = FONT_SIZE * LINE_HEIGHT_MULTIPLIER;

// Page dimensions in points (1/72 inch)
export const PAGE_WIDTH = 612; // 8.5 inches
export const PAGE_HEIGHT = 792; // 11 inches

// Margins in points
export const MARGIN_TOP = 72; // 1 inch
export const MARGIN_BOTTOM = 72; // 1 inch
export const MARGIN_LEFT = 108; // 1.5 inches
export const MARGIN_RIGHT = 72; // 1 inch

// Content area dimensions
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
export const CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

// Maximum lines per page (approximate)
export const MAX_LINES_PER_PAGE = Math.floor(CONTENT_HEIGHT / LINE_HEIGHT);

// Layout configuration for each block type
export const layoutConfig = {
  'scene-heading': {
    indent: 0,
    fontStyle: 'bold',
    textTransform: 'uppercase',
    spaceBefore: FONT_SIZE * 1.5,
    spaceAfter: FONT_SIZE,
    maxWidth: CONTENT_WIDTH
  },
  'action': {
    indent: 0,
    fontStyle: 'normal',
    spaceAfter: FONT_SIZE,
    maxWidth: CONTENT_WIDTH
  },
  'character': {
    indent: 2.1 * 72, // ~2.1 inches from left margin
    fontStyle: 'normal',
    textTransform: 'uppercase',
    spaceAfter: 0,
    maxWidth: CONTENT_WIDTH - (2.1 * 72)
  },
  'parenthetical': {
    indent: 1.5 * 72, // ~1.5 inches from left margin
    fontStyle: 'normal',
    spaceAfter: 0,
    maxWidth: CONTENT_WIDTH - (1.5 * 72) - (1.0 * 72) // Indent from left and right
  },
  'dialogue': {
    indent: 1.0 * 72, // ~1.0 inch from left margin
    fontStyle: 'normal',
    spaceAfter: FONT_SIZE,
    maxWidth: CONTENT_WIDTH - (1.0 * 72) - (1.5 * 72) // Indent from left and right
  },
  'transition': {
    indent: 0,
    fontStyle: 'normal',
    textTransform: 'uppercase',
    alignment: 'right',
    spaceAfter: FONT_SIZE,
    maxWidth: CONTENT_WIDTH
  },
  'shot': {
    indent: 0,
    fontStyle: 'bold',
    textTransform: 'uppercase',
    spaceAfter: FONT_SIZE,
    maxWidth: CONTENT_WIDTH
  },
  'text': {
    indent: 0,
    fontStyle: 'normal',
    spaceAfter: FONT_SIZE,
    maxWidth: CONTENT_WIDTH
  }
};

// Helper function to get layout for a specific block type
export const getLayoutForBlockType = (blockType: string) => {
  return layoutConfig[blockType as keyof typeof layoutConfig] || layoutConfig['text'];
};