/**
 * Personal Concierge — Design Token System
 *
 * Architecture: Primitive → Semantic → Component (3-layer)
 * Style: Biomimetic / Organic 2.0 (dark mode variant)
 * Palette: Calming violet (#8B5CF6) + wellness green (#059669)
 * Typography: Inter system — weight + tracking hierarchy
 *
 * Generated with: ui-ux-pro-max + design-system skills
 */

// ═══════════════════════════════════════════════════════
// LAYER 1 — PRIMITIVES (raw values, no semantic meaning)
// ═══════════════════════════════════════════════════════

const primitive = {
  // Violet scale
  violet50: '#F5F3FF',
  violet100: '#EDE9FE',
  violet200: '#DDD6FE',
  violet300: '#C4B5FD',
  violet400: '#A78BFA',
  violet500: '#8B5CF6',
  violet600: '#7C3AED',
  violet700: '#6D28D9',

  // Green (wellness)
  green400: '#34D399',
  green500: '#10B981',
  green600: '#059669',

  // Amber
  amber400: '#FBBF24',
  amber500: '#F59E0B',

  // Red
  red400: '#F87171',
  red500: '#EF4444',

  // Orange
  orange400: '#FB923C',

  // Blue
  blue400: '#60A5FA',

  // Lime
  lime400: '#A3E635',

  // Neutrals (blue-tinted for dark mode)
  gray50: '#F0F0F8',
  gray100: '#E2E2EE',
  gray200: '#C6C6D8',
  gray400: '#8888A4',
  gray500: '#6B6B88',
  gray600: '#4A4A66',
  gray700: '#2A2A44',
  gray800: '#1A1A32',
  gray850: '#141428',
  gray900: '#101025',
  gray950: '#0A0A1A',

  // Absolute
  white: '#FFFFFF',
  black: '#000000',

  // Spacing scale (4px base, per Material Design)
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space8: 32,
  space10: 40,
  space12: 48,

  // Radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusFull: 9999,

  // Font sizes (16px base, readable on mobile)
  fontSize2xs: 10,
  fontSizeXs: 11,
  fontSizeSm: 13,
  fontSizeMd: 15,
  fontSizeLg: 17,
  fontSizeXl: 20,
  fontSize2xl: 24,
  fontSize3xl: 32,
  fontSize4xl: 40,

  // Font weights
  fontNormal: '400' as const,
  fontMedium: '500' as const,
  fontSemibold: '600' as const,
  fontBold: '700' as const,

  // Durations (ms)
  durationFast: 150,
  durationNormal: 250,
  durationSlow: 400,

  // Minimum touch target (Apple HIG: 44pt)
  touchMin: 44,
} as const;

// ═══════════════════════════════════════════════════════
// LAYER 2 — SEMANTIC (purpose-based aliases)
// ═══════════════════════════════════════════════════════

export const colors = {
  // Page backgrounds
  bg: primitive.gray950,
  bgCard: primitive.gray850,
  bgCardHover: primitive.gray800,
  bgElevated: primitive.gray700,
  bgInput: primitive.gray900,
  bgSurface: primitive.gray900,

  // Primary (violet)
  primary: primitive.violet500,
  primaryHover: primitive.violet600,
  primaryMuted: 'rgba(139, 92, 246, 0.15)',
  primaryBorder: 'rgba(139, 92, 246, 0.25)',
  primaryGlow: 'rgba(139, 92, 246, 0.08)',
  primaryForeground: primitive.white,

  // Secondary (wellness green)
  secondary: primitive.green500,
  secondaryMuted: 'rgba(16, 185, 129, 0.12)',

  // Text
  textPrimary: primitive.gray50,
  textSecondary: 'rgba(240, 240, 248, 0.6)',
  textTertiary: 'rgba(240, 240, 248, 0.35)',
  textAccent: primitive.violet300,

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderAccent: 'rgba(139, 92, 246, 0.3)',

  // Status — WCAG contrast-checked on dark bg
  success: primitive.green400,
  successMuted: 'rgba(52, 211, 153, 0.12)',
  warning: primitive.amber400,
  warningMuted: 'rgba(251, 191, 36, 0.12)',
  error: primitive.red400,
  errorMuted: 'rgba(248, 113, 113, 0.12)',
  info: primitive.blue400,
  infoMuted: 'rgba(96, 165, 250, 0.12)',

  // Score ring colors
  scoreExcellent: primitive.green400,
  scoreGood: primitive.lime400,
  scoreFair: primitive.amber400,
  scorePoor: primitive.orange400,
  scoreBad: primitive.red400,

  // Tab bar
  tabActive: primitive.violet500,
  tabInactive: 'rgba(240, 240, 248, 0.25)',
  tabBar: primitive.gray950,
  tabBarBorder: 'rgba(255, 255, 255, 0.06)',

  // Skeleton shimmer
  skeleton: primitive.gray700,
  skeletonHighlight: primitive.gray600,

  // Utility
  white: primitive.white,
  black: primitive.black,
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Disabled state (opacity 0.38–0.5 per Material Design)
  disabled: 'rgba(240, 240, 248, 0.38)',
} as const;

export const spacing = {
  xs: primitive.space1,     // 4
  sm: primitive.space2,     // 8
  md: primitive.space3,     // 12
  lg: primitive.space4,     // 16
  xl: primitive.space5,     // 20
  '2xl': primitive.space6,  // 24
  '3xl': primitive.space8,  // 32
  '4xl': primitive.space10, // 40
  '5xl': primitive.space12, // 48
} as const;

export const radii = {
  sm: primitive.radiusSm,
  md: primitive.radiusMd,
  lg: primitive.radiusLg,
  xl: primitive.radiusXl,
  full: primitive.radiusFull,
} as const;

export const font = {
  // Sizes
  '2xs': primitive.fontSize2xs,
  xs: primitive.fontSizeXs,
  sm: primitive.fontSizeSm,
  md: primitive.fontSizeMd,
  lg: primitive.fontSizeLg,
  xl: primitive.fontSizeXl,
  '2xl': primitive.fontSize2xl,
  '3xl': primitive.fontSize3xl,
  '4xl': primitive.fontSize4xl,

  // Weights
  normal: primitive.fontNormal,
  medium: primitive.fontMedium,
  semibold: primitive.fontSemibold,
  bold: primitive.fontBold,
} as const;

export const duration = {
  fast: primitive.durationFast,
  normal: primitive.durationNormal,
  slow: primitive.durationSlow,
} as const;

// ═══════════════════════════════════════════════════════
// LAYER 3 — COMPONENT TOKENS (component-specific)
// ═══════════════════════════════════════════════════════

export const shadow = {
  card: {
    shadowColor: primitive.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: primitive.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    shadowColor: primitive.violet500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

/** Card component token */
export const cardStyle = {
  backgroundColor: colors.bgCard,
  borderRadius: radii.lg,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.lg,
  ...shadow.card,
} as const;

/** Section header label token */
export const sectionLabel = {
  fontSize: font.xs,
  fontWeight: font.bold,
  color: colors.textTertiary,
  letterSpacing: 1.2,
  textTransform: 'uppercase' as const,
  marginBottom: spacing.md,
  marginTop: spacing.lg,
} as const;

/** Primary button token */
export const buttonPrimary = {
  backgroundColor: colors.primary,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  borderRadius: radii.md,
  minHeight: primitive.touchMin, // 44pt minimum touch target
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  ...shadow.glow,
} as const;

/** Primary button text token */
export const buttonPrimaryText = {
  color: colors.primaryForeground,
  fontSize: font.md,
  fontWeight: font.semibold,
} as const;

/** Ghost/outline button token */
export const buttonGhost = {
  backgroundColor: 'transparent',
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  borderRadius: radii.md,
  borderWidth: 1,
  borderColor: colors.border,
  minHeight: primitive.touchMin,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} as const;

/** Input field token */
export const inputStyle = {
  backgroundColor: colors.bgInput,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  padding: spacing.lg,
  color: colors.textPrimary,
  fontSize: font.md,
  minHeight: primitive.touchMin,
} as const;

/** Badge token */
export const badgeStyle = {
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: radii.full,
  backgroundColor: colors.primaryMuted,
} as const;

/** Badge text token */
export const badgeText = {
  fontSize: font.xs,
  fontWeight: font.semibold,
  color: colors.textAccent,
} as const;

/** Module row token (dashboard hub screens) */
export const moduleRow = {
  ...cardStyle,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  marginBottom: spacing.sm,
  minHeight: primitive.touchMin,
} as const;

/** Progress bar track token */
export const progressTrack = {
  height: 6,
  backgroundColor: colors.border,
  borderRadius: radii.full,
  overflow: 'hidden' as const,
} as const;

/** Progress bar fill token */
export const progressFill = {
  height: 6,
  backgroundColor: colors.primary,
  borderRadius: radii.full,
} as const;

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

/** Map a 0-100 score to a semantic color */
export function getScoreColor(score: number): string {
  if (score >= 85) return colors.scoreExcellent;
  if (score >= 70) return colors.scoreGood;
  if (score >= 55) return colors.scoreFair;
  if (score >= 40) return colors.scorePoor;
  return colors.scoreBad;
}

/** Map a 0-100 score to a human label */
export function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Moderate';
  if (score >= 40) return 'Poor';
  return 'Critical';
}
