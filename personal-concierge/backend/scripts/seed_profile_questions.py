#!/usr/bin/env python3
"""Seed profile_questions table with initial question bank."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from config import supabase

QUESTIONS = [
    # Health & Fitness
    {"question": "Do you have any injuries or physical limitations I should know about?", "category": "health", "trigger_type": "daily", "answer_stored_as": "injuries"},
    {"question": "What's your current fitness level — beginner, intermediate, or advanced?", "category": "fitness", "trigger_type": "daily", "answer_stored_as": "fitness_level"},
    {"question": "What types of exercise do you genuinely enjoy?", "category": "fitness", "trigger_type": "daily", "answer_stored_as": "preferred_exercises"},
    {"question": "Are there any exercises you strongly dislike or want to avoid?", "category": "fitness", "trigger_type": "daily", "answer_stored_as": "avoided_exercises"},
    {"question": "What's your main fitness goal right now?", "category": "goals", "trigger_type": "daily", "answer_stored_as": "fitness_goal"},
    {"question": "How many days per week do you realistically want to train?", "category": "fitness", "trigger_type": "daily", "answer_stored_as": "training_frequency"},
    {"question": "Do you prefer morning or evening workouts?", "category": "fitness", "trigger_type": "daily", "answer_stored_as": "workout_time_preference"},
    {"question": "What's the longest you've stuck to a consistent workout routine?", "category": "fitness", "trigger_type": "daily", "answer_stored_as": "consistency_history"},
    # Nutrition
    {"question": "Do you follow any specific diet or have dietary restrictions?", "category": "nutrition", "trigger_type": "daily", "answer_stored_as": "dietary_restrictions"},
    {"question": "Are there any foods you don't eat — allergies, dislikes, or ethical reasons?", "category": "nutrition", "trigger_type": "daily", "answer_stored_as": "avoided_foods"},
    {"question": "How much time do you typically have to prepare meals on weekdays?", "category": "nutrition", "trigger_type": "daily", "answer_stored_as": "meal_prep_time"},
    {"question": "Do you cook at home mostly, eat out often, or a mix?", "category": "nutrition", "trigger_type": "daily", "answer_stored_as": "cooking_habits"},
    {"question": "What's your favorite protein source?", "category": "nutrition", "trigger_type": "daily", "answer_stored_as": "favorite_protein"},
    {"question": "Do you drink alcohol? If so, how often?", "category": "nutrition", "trigger_type": "daily", "answer_stored_as": "alcohol_habits"},
    {"question": "Do you drink coffee or tea? How much?", "category": "nutrition", "trigger_type": "daily", "answer_stored_as": "caffeine_habits"},
    {"question": "Do you track your water intake? How much do you typically drink?", "category": "nutrition", "trigger_type": "daily", "answer_stored_as": "water_intake"},
    # Background
    {"question": "How old are you?", "category": "background", "trigger_type": "daily", "answer_stored_as": "age"},
    {"question": "What do you do for work — is it mostly sedentary or active?", "category": "background", "trigger_type": "daily", "answer_stored_as": "occupation_activity"},
    {"question": "What time do you usually wake up and go to sleep?", "category": "background", "trigger_type": "daily", "answer_stored_as": "sleep_schedule"},
    {"question": "Where do you live? (City/region — helps with weather and UV data)", "category": "background", "trigger_type": "daily", "answer_stored_as": "location"},
    {"question": "What's your height and weight?", "category": "background", "trigger_type": "daily", "answer_stored_as": "body_metrics"},
    {"question": "Do you work from home, office, or hybrid?", "category": "background", "trigger_type": "daily", "answer_stored_as": "work_location"},
    # Goals & Motivation
    {"question": "What's the one health outcome that matters most to you in the next 6 months?", "category": "goals", "trigger_type": "daily", "answer_stored_as": "primary_health_goal"},
    {"question": "What's motivated you to focus on your health right now?", "category": "goals", "trigger_type": "daily", "answer_stored_as": "motivation"},
    {"question": "Is there a specific event you're training for? (race, vacation, etc.)", "category": "goals", "trigger_type": "daily", "answer_stored_as": "target_event"},
    {"question": "What does your ideal body composition look like?", "category": "goals", "trigger_type": "daily", "answer_stored_as": "body_comp_goal"},
    {"question": "Are you focused more on performance, aesthetics, or longevity?", "category": "goals", "trigger_type": "daily", "answer_stored_as": "fitness_focus"},
    # Sleep
    {"question": "How would you rate your sleep quality generally — poor, okay, or good?", "category": "health", "trigger_type": "daily", "answer_stored_as": "sleep_quality_self"},
    {"question": "Do you have trouble falling asleep, staying asleep, or both?", "category": "health", "trigger_type": "daily", "answer_stored_as": "sleep_issues"},
    {"question": "What does your pre-bed routine look like?", "category": "lifestyle", "trigger_type": "daily", "answer_stored_as": "bedtime_routine"},
    {"question": "Is your bedroom dark, cool, and quiet?", "category": "lifestyle", "trigger_type": "daily", "answer_stored_as": "sleep_environment"},
    # Stress & Mental Health
    {"question": "What are your biggest sources of stress right now?", "category": "health", "trigger_type": "daily", "answer_stored_as": "stress_sources"},
    {"question": "Do you practice any stress management — meditation, journaling, therapy?", "category": "lifestyle", "trigger_type": "daily", "answer_stored_as": "stress_management"},
    {"question": "How's your mental energy most days — sharp, foggy, or variable?", "category": "health", "trigger_type": "daily", "answer_stored_as": "mental_energy"},
    # Lifestyle
    {"question": "How often do you travel? Does it disrupt your routine?", "category": "lifestyle", "trigger_type": "daily", "answer_stored_as": "travel_frequency"},
    {"question": "Do you have any hobbies that involve physical activity?", "category": "lifestyle", "trigger_type": "daily", "answer_stored_as": "active_hobbies"},
    {"question": "How much time outdoors do you get on a typical day?", "category": "lifestyle", "trigger_type": "daily", "answer_stored_as": "outdoor_time"},
    {"question": "Do you have a partner or family that affects your meal planning?", "category": "lifestyle", "trigger_type": "daily", "answer_stored_as": "household_context"},
    # Medical
    {"question": "Do you take any prescription medications?", "category": "health", "trigger_type": "daily", "answer_stored_as": "medications"},
    {"question": "Any family history of heart disease, diabetes, or cancer?", "category": "health", "trigger_type": "daily", "answer_stored_as": "family_history"},
    {"question": "When was your last comprehensive blood test?", "category": "health", "trigger_type": "daily", "answer_stored_as": "last_blood_test"},
    {"question": "Do you have any known vitamin or mineral deficiencies?", "category": "health", "trigger_type": "daily", "answer_stored_as": "known_deficiencies"},
    # Supplements
    {"question": "Are you currently taking any supplements? If so, which ones?", "category": "health", "trigger_type": "daily", "answer_stored_as": "current_supplements"},
    {"question": "Have you tried supplements before that didn't work for you?", "category": "health", "trigger_type": "daily", "answer_stored_as": "supplement_history"},
    # Personality & Coaching
    {"question": "When it comes to health advice, do you prefer being told what to do, or having options?", "category": "personality", "trigger_type": "daily", "answer_stored_as": "coaching_preference"},
    {"question": "How do you respond to accountability — does it motivate or stress you?", "category": "personality", "trigger_type": "daily", "answer_stored_as": "accountability_response"},
    {"question": "What's your relationship with data — do you love metrics or find them overwhelming?", "category": "personality", "trigger_type": "daily", "answer_stored_as": "data_preference"},
    {"question": "Are you more motivated by avoiding negatives or achieving positives?", "category": "personality", "trigger_type": "daily", "answer_stored_as": "motivation_style"},
    # Learning & Preferences
    {"question": "Do you want me to explain the science behind recommendations, or just tell you what to do?", "category": "preferences", "trigger_type": "daily", "answer_stored_as": "explanation_preference"},
    {"question": "How do you feel about trying new foods and recipes?", "category": "preferences", "trigger_type": "daily", "answer_stored_as": "food_adventurousness"},
]


def seed():
    if not supabase:
        print("ERROR: Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
        sys.exit(1)

    print(f"Seeding {len(QUESTIONS)} profile questions...")
    inserted = 0
    skipped = 0

    for q in QUESTIONS:
        try:
            # Check if question already exists
            existing = (
                supabase.table("profile_questions")
                .select("id")
                .eq("question", q["question"])
                .limit(1)
                .execute()
            )
            if existing.data:
                skipped += 1
                continue

            supabase.table("profile_questions").insert(q).execute()
            inserted += 1
        except Exception as e:
            print(f"  Error inserting question: {e}")
            skipped += 1

    print(f"Done. Inserted: {inserted}, Skipped (already exist): {skipped}")


if __name__ == "__main__":
    seed()
