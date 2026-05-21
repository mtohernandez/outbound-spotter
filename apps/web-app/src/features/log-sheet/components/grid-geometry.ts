// Pixel geometry for the §395.8 24-hour graph grid. Exported so tests can
// assert positions without re-deriving the math, and so the layout can be
// retuned in one place without combing the renderer.
export const HOUR_WIDTH = 32;
export const ROW_HEIGHT = 24;
export const GRID_X = 96;
export const GRID_Y = 200;
export const TICKS_PER_HOUR = 4;
export const MINUTES_PER_DAY = 1440;
export const GRID_WIDTH = HOUR_WIDTH * 24;
export const GRID_HEIGHT = ROW_HEIGHT * 4;
export const TOTALS_X = GRID_X + GRID_WIDTH + 8;
export const TOTALS_WIDTH = 80;
export const REMARKS_Y = GRID_Y + GRID_HEIGHT + 20;
export const REMARKS_HEIGHT = 160;
export const SHEET_WIDTH = TOTALS_X + TOTALS_WIDTH + 16;
export const SHEET_HEIGHT = REMARKS_Y + REMARKS_HEIGHT + 220;
