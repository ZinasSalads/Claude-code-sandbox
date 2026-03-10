import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import type { MealPlan as MealPlanType, Meal } from '../lib/api';

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
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  fill: {
    height: 8,
    borderRadius: 4,
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
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeTag: {
    backgroundColor: 'rgba(108,99,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C63FF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  macroSummary: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  expanded: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 14,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 12,
  },
  ingredientsSection: {
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ingredientsList: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  detailChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  macroLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
  },
  notes: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    marginTop: 8,
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
        <MacroBar label="Calories" value={targets.calories} max={3000} color="#6C63FF" unit=" kcal" />
        <MacroBar label="Protein" value={targets.protein} max={250} color="#4CAF50" unit="g" />
        <MacroBar label="Carbs" value={targets.carbs} max={350} color="#FFC107" unit="g" />
        <MacroBar label="Fat" value={targets.fat} max={120} color="#FF9800" unit="g" />
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
    backgroundColor: '#0D0D1A',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  hydrationCard: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  hydrationText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  reasoningCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6C63FF',
  },
  reasoningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reasoningText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  noteCard: {
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  noteText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 20,
  },
});
