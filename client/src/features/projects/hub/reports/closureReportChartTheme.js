/**
 * Map design-system CSS variables into Recharts-friendly colors.
 */

function readCssVar(name, fallback) {
  if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!raw) return fallback;
    if (raw.includes(' ') || raw.includes('%')) return `hsl(${raw})`;
    return raw;
  } catch {
    return fallback;
  }
}

export function getClosureReportChartTheme() {
  return {
    primary: readCssVar('--primary', 'hsl(222 47% 31%)'),
    primaryFg: readCssVar('--primary-foreground', '#fff'),
    muted: readCssVar('--muted-foreground', 'hsl(215 16% 47%)'),
    border: readCssVar('--border', 'hsl(214 32% 91%)'),
    card: readCssVar('--card', '#fff'),
    foreground: readCssVar('--foreground', 'hsl(222 47% 11%)'),
    destructive: readCssVar('--destructive', 'hsl(0 72% 51%)'),
    secondary: readCssVar('--secondary', 'hsl(210 40% 96%)'),
    // Tabler-like pair: primary blue + soft teal for done/actual contrast
    chartDone: readCssVar('--primary', 'hsl(211 60% 45%)'),
    chartIncomplete: readCssVar('--muted-foreground', 'hsl(215 16% 70%)'),
    chartPlanned: 'hsl(160 45% 42%)',
    chartActual: readCssVar('--primary', 'hsl(211 60% 45%)'),
    dimOpacity: 0.35,
  };
}

export const CHART_ANIMATION_MS = 800;
export const LINE_ANIMATION_MS = 900;
