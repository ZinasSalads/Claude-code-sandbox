import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, font } from './theme';

// Dashboard hub screens
import HealthDashboard from './screens/HealthDashboard';
import LifeDashboard from './screens/LifeDashboard';
import ProfileDashboard from './screens/ProfileDashboard';

// Today tab
import CommandCenter from './screens/CommandCenter';
import WorkoutDetail from './screens/WorkoutDetail';

// Health tab
import BloodWork from './screens/BloodWork';
import Supplements from './screens/Supplements';
import Longevity from './screens/Longevity';
import Research from './screens/Research';
import AppleHealth from './screens/AppleHealth';
import Skincare from './screens/Skincare';
import Environment from './screens/Environment';

// Fitness tab
import FitnessHub from './screens/FitnessHub';
import FitnessGoal from './screens/FitnessGoal';
import WorkoutSession from './screens/WorkoutSession';
import ExerciseProgress from './screens/ExerciseProgress';
import EquipmentSetup from './screens/EquipmentSetup';

// Life tab
import Social from './screens/Social';
import Relationships from './screens/Relationships';
import Growth from './screens/Growth';
import Career from './screens/Career';
import Travel from './screens/Travel';
import WardrobeScreen from './screens/Wardrobe';
import Hobbies from './screens/Hobbies';
import Learning from './screens/Learning';
import Legacy from './screens/Legacy';
import Reviews from './screens/Reviews';

// Me tab
import CheckIn from './screens/CheckIn';
import Personality from './screens/Personality';
import Onboarding from './screens/Onboarding';
import HomeEnvironment from './screens/HomeEnvironment';
import Financial from './screens/Financial';
import Privacy from './screens/Privacy';
import Voice from './screens/Voice';
import ContextualIntelligence from './screens/ContextualIntelligence';
import Conversation from './screens/Conversation';

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.bg,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.primary,
  },
};

// ── Icons ──────────────────────────────────────────────────────────────────

function SunIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={2} />
      <Path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function HeartIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SproutIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22V12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 12C12 12 7 10 5 6c4 0 7 2 7 6z" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
      <Path d="M12 12C12 12 17 10 19 6c-4 0-7 2-7 6z" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
      <Path d="M12 17C12 17 8 15.5 7 12c3.5 0 5 2 5 5z" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function UserIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Stack options ──────────────────────────────────────────────────────────

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: font.semibold },
  headerShadowVisible: false,
};

// ── Today stack ────────────────────────────────────────────────────────────

const TodayStack = createNativeStackNavigator();
function TodayStackScreen() {
  return (
    <TodayStack.Navigator screenOptions={stackScreenOptions}>
      <TodayStack.Screen name="CommandCenter" component={CommandCenter} options={{ headerShown: false }} />
      <TodayStack.Screen name="WorkoutDetail" component={WorkoutDetail} options={{ title: 'Workout' }} />
    </TodayStack.Navigator>
  );
}

// ── Health stack ───────────────────────────────────────────────────────────

const HealthStack = createNativeStackNavigator();
function HealthStackScreen() {
  return (
    <HealthStack.Navigator screenOptions={stackScreenOptions}>
      <HealthStack.Screen name="HealthHub" component={HealthDashboard} options={{ title: 'Health' }} />
      <HealthStack.Screen name="Supplements" component={Supplements} options={{ title: 'Supplements' }} />
      <HealthStack.Screen name="Skincare" component={Skincare} options={{ title: 'Skincare' }} />
      <HealthStack.Screen name="Longevity" component={Longevity} options={{ title: 'Longevity' }} />
      <HealthStack.Screen name="AppleHealth" component={AppleHealth} options={{ title: 'Apple Health' }} />
      <HealthStack.Screen name="Environment" component={Environment} options={{ title: 'Environment' }} />
      <HealthStack.Screen name="Research" component={Research} options={{ title: 'Research' }} />
      <HealthStack.Screen name="BloodWork" component={BloodWork} options={{ title: 'Blood Work' }} />
      <HealthStack.Screen name="FitnessHub" component={FitnessHub} options={{ title: 'Fitness' }} />
      <HealthStack.Screen name="FitnessGoal" component={FitnessGoal} options={{ title: 'Goals' }} />
      <HealthStack.Screen name="WorkoutSession" component={WorkoutSession} options={{ title: 'Session' }} />
      <HealthStack.Screen name="ExerciseProgress" component={ExerciseProgress} options={{ title: 'Progress' }} />
      <HealthStack.Screen name="EquipmentSetup" component={EquipmentSetup} options={{ title: 'Equipment' }} />
    </HealthStack.Navigator>
  );
}

// ── Life stack ─────────────────────────────────────────────────────────────

const LifeStack = createNativeStackNavigator();
function LifeStackScreen() {
  return (
    <LifeStack.Navigator screenOptions={stackScreenOptions}>
      <LifeStack.Screen name="LifeHub" component={LifeDashboard} options={{ title: 'Life' }} />
      <LifeStack.Screen name="Social" component={Social} options={{ title: 'Social Health' }} />
      <LifeStack.Screen name="Relationships" component={Relationships} options={{ title: 'Relationships' }} />
      <LifeStack.Screen name="Growth" component={Growth} options={{ title: '1% Growth' }} />
      <LifeStack.Screen name="Career" component={Career} options={{ title: 'Career' }} />
      <LifeStack.Screen name="Travel" component={Travel} options={{ title: 'Travel' }} />
      <LifeStack.Screen name="Wardrobe" component={WardrobeScreen} options={{ title: 'Wardrobe' }} />
      <LifeStack.Screen name="Hobbies" component={Hobbies} options={{ title: 'Hobbies' }} />
      <LifeStack.Screen name="Learning" component={Learning} options={{ title: 'Learning' }} />
      <LifeStack.Screen name="Legacy" component={Legacy} options={{ title: 'Legacy & Vision' }} />
      <LifeStack.Screen name="Reviews" component={Reviews} options={{ title: 'Reviews' }} />
    </LifeStack.Navigator>
  );
}

// ── Me stack ───────────────────────────────────────────────────────────────

const MeStack = createNativeStackNavigator();
function MeStackScreen() {
  return (
    <MeStack.Navigator screenOptions={stackScreenOptions}>
      <MeStack.Screen name="MeHub" component={ProfileDashboard} options={{ title: 'Me' }} />
      <MeStack.Screen name="Chat" component={Conversation} options={{ title: 'AI Chat' }} />
      <MeStack.Screen name="VoiceCommands" component={Voice} options={{ title: 'Voice & Briefings' }} />
      <MeStack.Screen name="CheckIn" component={CheckIn} options={{ title: 'Flag Something' }} />
      <MeStack.Screen name="Personality" component={Personality} options={{ title: 'Personality' }} />
      <MeStack.Screen name="Onboarding" component={Onboarding} options={{ title: 'Setup' }} />
      <MeStack.Screen name="Financial" component={Financial} options={{ title: 'Financial' }} />
      <MeStack.Screen name="ContextualIntel" component={ContextualIntelligence} options={{ title: 'Contextual Intel' }} />
      <MeStack.Screen name="Privacy" component={Privacy} options={{ title: 'Privacy & Data' }} />
    </MeStack.Navigator>
  );
}

// ── Tab navigator ──────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator();

function TabsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
          height: tabBarHeight,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: font.semibold },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayStackScreen}
        options={{ tabBarIcon: ({ color, size }) => <SunIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Health"
        component={HealthStackScreen}
        options={{ tabBarIcon: ({ color, size }) => <HeartIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Life"
        component={LifeStackScreen}
        options={{ tabBarIcon: ({ color, size }) => <SproutIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Me"
        component={MeStackScreen}
        options={{ tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <NavigationContainer theme={DarkTheme}>
        <TabsScreen />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
