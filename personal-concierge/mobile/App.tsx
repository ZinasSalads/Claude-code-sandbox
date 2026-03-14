import React, { useState } from 'react';
import { StatusBar, TouchableOpacity, View, StyleSheet as RNStyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

// Session 1-2 screens
import CommandCenter from './screens/CommandCenter';
import CheckIn from './screens/CheckIn';
import WorkoutDetail from './screens/WorkoutDetail';
import MealPlan from './screens/MealPlan';
import BloodWork from './screens/BloodWork';
import Supplements from './screens/Supplements';
import Longevity from './screens/Longevity';
import Research from './screens/Research';

// Session 4 screens
import Voice from './screens/Voice';
import Travel from './screens/Travel';
import Social from './screens/Social';
import Growth from './screens/Growth';
import Career from './screens/Career';
import WardrobeScreen from './screens/Wardrobe';
import Financial from './screens/Financial';

// Session 5 screens
import Personality from './screens/Personality';
import Onboarding from './screens/Onboarding';
import AppleHealth from './screens/AppleHealth';
import Legacy from './screens/Legacy';
import HomeEnvironment from './screens/HomeEnvironment';
import Learning from './screens/Learning';
import Privacy from './screens/Privacy';

// Session 6 screens
import Skincare from './screens/Skincare';
import Relationships from './screens/Relationships';
import DigitalIdentity from './screens/DigitalIdentity';
import FinancialPlanning from './screens/FinancialPlanning';
import Hobbies from './screens/Hobbies';
import ContextualIntelligence from './screens/ContextualIntelligence';
import Conversation from './screens/Conversation';
import Reviews from './screens/Reviews';

// Dark theme
const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6C63FF',
    background: '#0D0D1A',
    card: '#0D0D1A',
    text: '#fff',
    border: 'rgba(255,255,255,0.08)',
    notification: '#6C63FF',
  },
};

// SVG icon components
function HomeIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HeartIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LifeIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function InsightsIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MicIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function UserIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChatIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#0D0D1A' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' as const },
  headerShadowVisible: false,
};

// Home stack (Command Center + detail screens)
const HomeStack = createNativeStackNavigator();
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="CommandCenter" component={CommandCenter} options={{ headerShown: false }} />
      <HomeStack.Screen name="WorkoutDetail" component={WorkoutDetail} options={{ title: 'Workout' }} />
      <HomeStack.Screen name="MealPlan" component={MealPlan} options={{ title: 'Meal Plan' }} />
      <HomeStack.Screen name="Onboarding" component={Onboarding} options={{ title: 'Setup' }} />
      <HomeStack.Screen name="Conversation" component={Conversation} options={{ title: 'AI Chat' }} />
    </HomeStack.Navigator>
  );
}

// Health stack
const HealthStack = createNativeStackNavigator();
function HealthStackScreen() {
  return (
    <HealthStack.Navigator screenOptions={stackScreenOptions}>
      <HealthStack.Screen name="BloodWork" component={BloodWork} options={{ title: 'Blood Work' }} />
      <HealthStack.Screen name="Supplements" component={Supplements} options={{ title: 'Supplements' }} />
      <HealthStack.Screen name="Longevity" component={Longevity} options={{ title: 'Longevity' }} />
      <HealthStack.Screen name="Research" component={Research} options={{ title: 'Research' }} />
      <HealthStack.Screen name="AppleHealth" component={AppleHealth} options={{ title: 'Apple Health' }} />
      <HealthStack.Screen name="Skincare" component={Skincare} options={{ title: 'Skincare' }} />
    </HealthStack.Navigator>
  );
}

// Life stack
const LifeStack = createNativeStackNavigator();
function LifeStackScreen() {
  return (
    <LifeStack.Navigator screenOptions={stackScreenOptions}>
      <LifeStack.Screen name="Social" component={Social} options={{ title: 'Social Health' }} />
      <LifeStack.Screen name="Relationships" component={Relationships} options={{ title: 'Relationships' }} />
      <LifeStack.Screen name="Growth" component={Growth} options={{ title: '1% Growth' }} />
      <LifeStack.Screen name="Career" component={Career} options={{ title: 'Career' }} />
      <LifeStack.Screen name="Travel" component={Travel} options={{ title: 'Travel' }} />
      <LifeStack.Screen name="Wardrobe" component={WardrobeScreen} options={{ title: 'Wardrobe' }} />
      <LifeStack.Screen name="Financial" component={Financial} options={{ title: 'Financial' }} />
      <LifeStack.Screen name="Hobbies" component={Hobbies} options={{ title: 'Hobbies' }} />
      <LifeStack.Screen name="Legacy" component={Legacy} options={{ title: 'Legacy & Vision' }} />
      <LifeStack.Screen name="HomeEnv" component={HomeEnvironment} options={{ title: 'Home Environment' }} />
      <LifeStack.Screen name="Learning" component={Learning} options={{ title: 'Learning' }} />
    </LifeStack.Navigator>
  );
}

// Voice & Intelligence stack
const VoiceStack = createNativeStackNavigator();
function VoiceStackScreen() {
  return (
    <VoiceStack.Navigator screenOptions={stackScreenOptions}>
      <VoiceStack.Screen name="VoiceMain" component={Voice} options={{ title: 'Voice' }} />
      <VoiceStack.Screen name="Reviews" component={Reviews} options={{ title: 'Reviews' }} />
      <VoiceStack.Screen name="ContextualIntel" component={ContextualIntelligence} options={{ title: 'Contextual Intel' }} />
    </VoiceStack.Navigator>
  );
}

// Profile stack
const ProfileStack = createNativeStackNavigator();
function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="CheckIn" component={CheckIn} options={{ title: 'Check In' }} />
      <ProfileStack.Screen name="Personality" component={Personality} options={{ title: 'Personality' }} />
      <ProfileStack.Screen name="DigitalIdentity" component={DigitalIdentity} options={{ title: 'Digital Identity' }} />
      <ProfileStack.Screen name="FinancialPlanning" component={FinancialPlanning} options={{ title: 'Financial Goals' }} />
      <ProfileStack.Screen name="Privacy" component={Privacy} options={{ title: 'Privacy & Data' }} />
    </ProfileStack.Navigator>
  );
}

// Bottom tab navigator — 5 tabs
const Tab = createBottomTabNavigator();

export default function App() {
  const [showChat, setShowChat] = useState(false);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D1A" />
      <NavigationContainer theme={DarkTheme}>
        <View style={{ flex: 1 }}>
          <Tab.Navigator
            screenOptions={{
              tabBarStyle: {
                backgroundColor: '#0D0D1A',
                borderTopColor: 'rgba(255,255,255,0.06)',
                borderTopWidth: 1,
                paddingBottom: 8,
                paddingTop: 8,
                height: 60,
              },
              tabBarActiveTintColor: '#6C63FF',
              tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
              tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
              headerShown: false,
            }}
          >
            <Tab.Screen
              name="Home"
              component={HomeStackScreen}
              options={{ tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }}
            />
            <Tab.Screen
              name="Health"
              component={HealthStackScreen}
              options={{ tabBarIcon: ({ color, size }) => <HeartIcon color={color} size={size} /> }}
            />
            <Tab.Screen
              name="Life"
              component={LifeStackScreen}
              options={{ tabBarIcon: ({ color, size }) => <LifeIcon color={color} size={size} /> }}
            />
            <Tab.Screen
              name="Voice"
              component={VoiceStackScreen}
              options={{ tabBarIcon: ({ color, size }) => <MicIcon color={color} size={size} /> }}
            />
            <Tab.Screen
              name="Profile"
              component={ProfileStackScreen}
              options={{ tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} /> }}
            />
          </Tab.Navigator>

          {/* Floating chat button */}
          <TouchableOpacity
            style={fabStyles.fab}
            onPress={() => setShowChat(!showChat)}
            activeOpacity={0.8}
          >
            <ChatIcon />
          </TouchableOpacity>
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const fabStyles = RNStyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
