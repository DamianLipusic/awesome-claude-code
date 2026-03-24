export const COLORS = {
  // Brand
  primary:    '#0EA5E9', // sky-500
  primaryDark:'#0284C7', // sky-600
  accent:     '#14B8A6', // teal-500

  // Backgrounds
  bgLight:    '#F8FAFC',
  bgDark:     '#0F172A',
  cardLight:  '#FFFFFF',
  cardDark:   '#1E293B',
  surfaceLight:'#F1F5F9',
  surfaceDark: '#263348',

  // Text
  textLight:  '#0F172A',
  textDark:   '#F1F5F9',
  mutedLight: '#64748B',
  mutedDark:  '#94A3B8',

  // Border
  borderLight:'#E2E8F0',
  borderDark: '#334155',

  // Status
  success:    '#22C55E',
  warning:    '#F59E0B',
  danger:     '#EF4444',

  // AA groups
  acidic:     '#EF4444', // red
  basic:      '#3B82F6', // blue
  polar:      '#22C55E', // green
  hydrophobic:'#F59E0B', // amber
  special:    '#A855F7', // purple
};

export const SPACING = {
  xs: 4,  sm: 8,  md: 16, lg: 24, xl: 32, xxl: 48,
};

export const FONT_SIZE = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 26, xxxl: 32,
};

export const RADIUS = {
  sm: 6, md: 12, lg: 16, xl: 24, full: 999,
};

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};

export function getAAColor(group: string): string {
  switch (group) {
    case 'acidic':      return COLORS.acidic;
    case 'basic':       return COLORS.basic;
    case 'polar':       return COLORS.polar;
    case 'hydrophobic': return COLORS.hydrophobic;
    default:            return COLORS.special;
  }
}

export function getThemeColors(dark?: boolean) {
  return {
    bg:      dark ? COLORS.bgDark      : COLORS.bgLight,
    card:    dark ? COLORS.cardDark    : COLORS.cardLight,
    text:    dark ? COLORS.textDark    : COLORS.textLight,
    muted:   dark ? COLORS.mutedDark   : COLORS.mutedLight,
    border:  dark ? COLORS.borderDark  : COLORS.borderLight,
    surface: dark ? COLORS.surfaceDark : COLORS.surfaceLight,
  };
}
