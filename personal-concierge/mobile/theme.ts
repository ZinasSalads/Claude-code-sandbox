/**
 * Design tokens for the Personal Concierge app.
 * Premium dark theme — deep navy/charcoal, electric indigo accent.
 */

export const colors = {
  // Backgrounds
  bg: '#0A0A1A',
  bgCard: '#141428',
  bgCardHover: '#1A1A35',
  bgElevated: '#1E1E3A',
  bgInput: '#12122A',
  bgSurface: '#101025',

  // Accent
  accent: '#6366F1',
  accentMuted: 'rgba(99, 102, 241, 0.15)',
  accentBorder: 'rgba(99, 102, 241, 0.25)',
  accentGlow: 'rgba(99, 102, 241, 0.08)',

  // Text
  textPrimary: '#F0F0F8',
  textSecondary: 'rgba(240, 240, 248, 0.6)',
  textTertiary: 'rgba(240, 240, 248, 0.35)',
  textAccent: '#818CF8',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderAccent: 'rgba(99, 102, 241, 0.3)',

  // Status
  success: '#34D399',
  successMuted: 'rgba(52, 211, 153, 0.12)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251, 191, 36, 0.12)',
  error: '#F87171',
  errorMuted: 'rgba(248, 113, 113, 0.12)',
  info: '#60A5FA',
  infoMuted: 'rgba(96, 165, 250, 0.12)',

  // Score colors
  scoreExcellent: '#34D399',
  scoreGood: '#A3E635',
  scoreFair: '#FBBF24',
  scorePoor: '#FB923C',
  scoreBad: '#F87171',

  // Tab bar
  tabActive: '#6366F1',
  tabInactive: 'rgba(240, 240, 248, 0.25)',
  tabBar: '#0A0A1A',
  tabBarBorder: 'rgba(255, 255, 255, 0.06)',

  // Skeleton
  skeleton: '#1E1E3A',
  skeletonHighlight: '#2A2A4A',

  // White with opacity helpers
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const font = {
  // Sizes
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,

  // Weights
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Common card style
export const cardStyle = {
  backgroundColor: colors.bgCard,
  borderRadius: radii.lg,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.lg,
  ...shadow.card,
} as const;

// Section label style
export const sectionLabel = {
  fontSize: font.xs,
  fontWeight: font.bold,
  color: colors.textTertiary,
  letterSpacing: 1.2,
  textTransform: 'uppercase' as const,
  marginBottom: spacing.md,
  marginTop: spacing.lg,
} as const;

// Score color helper
export function getScoreColor(score: number): string {
  if (score >= 85) return colors.scoreExcellent;
  if (score >= 70) return colors.scoreGood;
  if (score >= 55) return colors.scoreFair;
  if (score >= 40) return colors.scorePoor;
  return colors.scoreBad;
}

// Score label helper
export function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Moderate';
  if (score >= 40) return 'Poor';
  return 'Critical';
}
