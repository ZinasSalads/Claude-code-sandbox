import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import type { MealPlan as MealPlanType, Meal } from '../lib/api';
import { colors, spacing, radii, font, shadow, cardStyle, sectionLabel } from '../theme';

interface MealPlanProps {
  route: {
    params: {
      mealPlan: MealPlanType;
    };
  };
}

function MacroBar({
  label,
  value,
  max,
  color,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View style={barStyles.container}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={[barStyles.value, { color }]}>
          {value}{unit}
        </Text>
      </View>
      <View style={barStyles.track}>
        <View
          style={[barStyles.fill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: font.medium,
  },
  value: {
    fontSize: font.sm,
    fontWeight: font.bold,
  },
  track: {
    height: 8,
    borderRadius: spacing.xs,
    backgroundColor: colors.border,
  },
  fill: {
    height: 8,
    borderRadius: spacing.xs,
  },
});

function MealCard({ meal }: { meal: Meal }) {
  const [expanded, setExpanded] = useState(false);

  const cal = meal.estimated_calories ?? meal.calories ?? 0;
  const protein = meal.estimated_protein ?? meal.protein_g ?? 0;
  const carbs = meal.estimated_carbs ?? meal.carbs_g ?? 0;
  const fat = meal.estimated_fat ?? meal.fat_g ?? 0;
  const ingredients = meal.key_ingredients ?? meal.ingredients ?? [];

  const mealTypeLabel = (meal.meal_type ?? 'meal').charAt(0).toUpperCase() + (meal.meal_type ?? 'meal').slice(1);

  return (
    <TouchableOpacity
      style={mealStyles.card}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      {/* Collapsed view */}
      <View style={mealStyles.header}>
        <View style={mealStyles.typeTag}>
          <Text style={mealStyles.typeText}>{mealTypeLabel}</Text>
        </View>
        <Text style={mealStyles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </View>
      <Text style={mealStyles.title}>{meal.title}</Text>
      <Text style={mealStyles.macroSummary}>
        {cal} kcal · {protein}g P · {carbs}g C · {fat}g F
      </Text>

      {/* Expanded view */}
      {expanded && (
        <View style={mealStyles.expanded}>
          {meal.description ? (
            <Text style={mealStyles.description}>{meal.description}</Text>
          ) : null}

          {ingredients.length > 0 && (
            <View style={mealStyles.ingredientsSection}>
              <Text style={mealStyles.subLabel}>KEY INGREDIENTS</Text>
              <Text style={mealStyles.ingredientsList}>
                {ingredients.join(', ')}
              </Text>
            </View>
          )}

          <View style={mealStyles.detailsRow}>
            {meal.prep_time_minutes ? (
              <View style={mealStyles.detailChip}>
                <Text style={mealStyles.detailText}>
                  🕐 {meal.prep_time_minutes} min prep
                </Text>
              </View>
            ) : null}
          </View>

          <View style={mealStyles.macroGrid}>
            <View style={mealStyles.macroItem}>
              <Text style={mealStyles.macroValue}>{protein}g</Text>
              <Text style={mealStyles.macroLabel}>Protein</Text>
            </View>
            <View style={mealStyles.macroItem}>
              <Text style={mealStyles.macroValue}>{carbs}g</Text>
              <Text style={mealStyles.macroLabel}>Carbs</Text>
            </View>
            <View style={mealStyles.macroItem}>
              <Text style={mealStyles.macroValue}>{fat}g</Text>
              <Text style={mealStyles.macroLabel}>Fat</Text>
            </View>
            <View style={mealStyles.macroItem}>
              <Text style={mealStyles.macroValue}>{cal}</Text>
              <Text style={mealStyles.macroLabel}>Calories</Text>
            </View>
          </View>

          {meal.notes ? (
            <Text style={mealStyles.notes}>💡 {meal.notes}</Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const mealStyles = StyleSheet.create({
  card: {
    ...cardStyle,
    marginBottom: spacing.md - 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  typeTag: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  typeText: {
    fontSize: font.xs,
    fontWeight: font.bold,
    color: colors.textAccent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: {
    color: colors.textTertiary,
    fontSize: font.md + 1,
  },
  title: {
    fontSize: font.md + 1,
    fontWeight: font.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  macroSummary: {
    fontSize: font.sm,
    color: colors.textSecondary,
  },
  expanded: {
    marginTop: spacing.lg - 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg - 2,
  },
  description: {
    fontSize: font.sm + 1,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  ingredientsSection: {
    marginBottom: spacing.md,
  },
  subLabel: {
    fontSize: font.xs,
    fontWeight: font.bold,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  ingredientsList: {
    fontSize: font.sm + 1,
    color: colors.textSecondary,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailChip: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  detailText: {
    fontSize: font.xs + 1,
    color: colors.textSecondary,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: font.md + 1,
    fontWeight: font.bold,
    color: colors.textPrimary,
  },
  macroLabel: {
    fontSize: font.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  notes: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});

export default function MealPlan({ route }: MealPlanProps) {
  const { mealPlan } = route.params;
  const targets = mealPlan.daily_targets;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Today's Nutrition</Text>

      {/* Daily Summary Bars */}
      <View style={styles.summaryCard}>
        <MacroBar label="Calories" value={targets.calories} max={3000} color={colors.accent} unit=" kcal" />
        <MacroBar label="Protein" value={targets.protein} max={250} color={colors.success} unit="g" />
        <MacroBar label="Carbs" value={targets.carbs} max={350} color={colors.warning} unit="g" />
        <MacroBar label="Fat" value={targets.fat} max={120} color={colors.scorePoor} unit="g" />
      </View>

      {/* Hydration */}
      {mealPlan.hydration_target_ml ? (
        <View style={styles.hydrationCard}>
          <Text style={styles.hydrationText}>
            💧 Hydration target: {(mealPlan.hydration_target_ml / 1000).toFixed(1)}L
          </Text>
        </View>
      ) : null}

      {/* Meals */}
      <Text style={styles.sectionTitle}>MEALS</Text>
      {(mealPlan.meals || []).map((meal, i) => (
        <MealCard key={i} meal={meal} />
      ))}

      {/* AI Reasoning */}
      {mealPlan.ai_reasoning ? (
        <View style={styles.reasoningCard}>
          <Text style={styles.reasoningTitle}>Why these targets today</Text>
          <Text style={styles.reasoningText}>{mealPlan.ai_reasoning}</Text>
        </View>
      ) : null}

      {/* Nutrition Note */}
      {mealPlan.nutrition_note ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>🎯 {mealPlan.nutrition_note}</Text>
        </View>
      ) : null}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.xl,
  },
  title: {
    fontSize: font['3xl'] - 6,
    fontWeight: font.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  summaryCard: {
    ...cardStyle,
    marginBottom: spacing.lg,
  },
  hydrationCard: {
    backgroundColor: colors.infoMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  hydrationText: {
    color: colors.info,
    fontSize: font.sm + 1,
    fontWeight: font.semibold,
  },
  sectionTitle: {
    ...sectionLabel,
  },
  reasoningCard: {
    ...cardStyle,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  reasoningTitle: {
    fontSize: font.xs + 1,
    fontWeight: font.bold,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  reasoningText: {
    fontSize: font.sm + 1,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noteCard: {
    backgroundColor: colors.accentMuted,
    borderRadius: radii.md + 2,
    padding: spacing.lg - 2,
    marginTop: spacing.md,
  },
  noteText: {
    fontSize: font.sm + 1,
    color: colors.textPrimary,
    fontWeight: font.medium,
    lineHeight: 20,
  },
});
