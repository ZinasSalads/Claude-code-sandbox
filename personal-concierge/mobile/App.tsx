import React from 'react';
import { StatusBar } from 'react-native';
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
    </HomeStack.Navigator>
  );
}

// Health stack (Fitness, Nutrition, Blood Work, Supplements, Longevity)
const HealthStack = createNativeStackNavigator();
function HealthStackScreen() {
  return (
    <HealthStack.Navigator screenOptions={stackScreenOptions}>
      <HealthStack.Screen name="BloodWork" component={BloodWork} options={{ title: 'Blood Work' }} />
      <HealthStack.Screen name="Supplements" component={Supplements} options={{ title: 'Supplements' }} />
      <HealthStack.Screen name="Longevity" component={Longevity} options={{ title: 'Longevity' }} />
      <HealthStack.Screen name="Research" component={Research} options={{ title: 'Research' }} />
    </HealthStack.Navigator>
  );
}

// Life stack (Social, Growth, Career, Travel, Wardrobe, Financial)
const LifeStack = createNativeStackNavigator();
function LifeStackScreen() {
  return (
    <LifeStack.Navigator screenOptions={stackScreenOptions}>
      <LifeStack.Screen name="Social" component={Social} options={{ title: 'Social Health' }} />
      <LifeStack.Screen name="Growth" component={Growth} options={{ title: '1% Growth' }} />
      <LifeStack.Screen name="Career" component={Career} options={{ title: 'Career' }} />
      <LifeStack.Screen name="Travel" component={Travel} options={{ title: 'Travel' }} />
      <LifeStack.Screen name="Wardrobe" component={WardrobeScreen} options={{ title: 'Wardrobe' }} />
      <LifeStack.Screen name="Financial" component={Financial} options={{ title: 'Financial' }} />
    </LifeStack.Navigator>
  );
}

// Profile stack (Check-in + settings)
const ProfileStack = createNativeStackNavigator();
function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="CheckIn" component={CheckIn} options={{ title: 'Check In' }} />
    </ProfileStack.Navigator>
  );
}

// Bottom tab navigator — 5 tabs
const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D1A" />
      <NavigationContainer theme={DarkTheme}>
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
            component={Voice}
            options={{
              tabBarIcon: ({ color, size }) => <MicIcon color={color} size={size} />,
              headerShown: true,
              headerStyle: { backgroundColor: '#0D0D1A' },
              headerTintColor: '#fff',
              headerShadowVisible: false,
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileStackScreen}
            options={{ tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} /> }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
