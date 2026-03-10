import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import CommandCenter from './screens/CommandCenter';
import CheckIn from './screens/CheckIn';
import WorkoutDetail from './screens/WorkoutDetail';
import MealPlan from './screens/MealPlan';
import BloodWork from './screens/BloodWork';
import Supplements from './screens/Supplements';
import Longevity from './screens/Longevity';
import Research from './screens/Research';

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

// Simple icon components using SVG paths
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

function ClipboardIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Stack navigator for Home tab
const HomeStack = createNativeStackNavigator();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0D0D1A' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <HomeStack.Screen
        name="CommandCenter"
        component={CommandCenter}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="WorkoutDetail"
        component={WorkoutDetail}
        options={{ title: 'Workout' }}
      />
      <HomeStack.Screen
        name="MealPlan"
        component={MealPlan}
        options={{ title: 'Meal Plan' }}
      />
      <HomeStack.Screen
        name="BloodWork"
        component={BloodWork}
        options={{ title: 'Blood Work' }}
      />
      <HomeStack.Screen
        name="Supplements"
        component={Supplements}
        options={{ title: 'Supplements' }}
      />
      <HomeStack.Screen
        name="Longevity"
        component={Longevity}
        options={{ title: 'Longevity' }}
      />
      <HomeStack.Screen
        name="Research"
        component={Research}
        options={{ title: 'Research' }}
      />
    </HomeStack.Navigator>
  );
}

// Bottom tab navigator
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
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
            headerShown: false,
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeStackScreen}
            options={{
              tabBarIcon: ({ color, size }) => (
                <HomeIcon color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Check In"
            component={CheckIn}
            options={{
              tabBarIcon: ({ color, size }) => (
                <ClipboardIcon color={color} size={size} />
              ),
              headerShown: true,
              headerStyle: { backgroundColor: '#0D0D1A' },
              headerTintColor: '#fff',
              headerShadowVisible: false,
              headerTitle: '',
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
