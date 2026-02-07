import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screen imports
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ComposeScreen from '../screens/ComposeScreen';
import ScheduledScreen from '../screens/ScheduledScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TemplatesScreen from '../screens/TemplatesScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import SnippetsScreen from '../screens/SnippetsScreen';
import ContactsScreen from '../screens/ContactsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TasksScreen from '../screens/TasksScreen';
import NotesScreen from '../screens/NotesScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ActivityLogScreen from '../screens/ActivityLogScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import DocumentEditorScreen from '../screens/DocumentEditorScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const CommStack = createNativeStackNavigator();
const ContentStack = createNativeStackNavigator();
const ProductivityStack = createNativeStackNavigator();
const ToolsStack = createNativeStackNavigator();

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: true }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen name="Settings" component={SettingsScreen} />
    </HomeStack.Navigator>
  );
}

function CommunicationNavigator() {
  return (
    <CommStack.Navigator screenOptions={{ headerShown: true }}>
      <CommStack.Screen name="Compose" component={ComposeScreen} />
      <CommStack.Screen name="Scheduled" component={ScheduledScreen} />
      <CommStack.Screen name="History" component={HistoryScreen} />
    </CommStack.Navigator>
  );
}

function ContentNavigator() {
  return (
    <ContentStack.Navigator screenOptions={{ headerShown: true }}>
      <ContentStack.Screen name="Templates" component={TemplatesScreen} />
      <ContentStack.Screen name="Documents" component={DocumentsScreen} />
      <ContentStack.Screen name="DocumentEditor" component={DocumentEditorScreen} />
      <ContentStack.Screen name="Snippets" component={SnippetsScreen} />
      <ContentStack.Screen name="Contacts" component={ContactsScreen} />
    </ContentStack.Navigator>
  );
}

function ProductivityNavigator() {
  return (
    <ProductivityStack.Navigator screenOptions={{ headerShown: true }}>
      <ProductivityStack.Screen name="Calendar" component={CalendarScreen} />
      <ProductivityStack.Screen name="Tasks" component={TasksScreen} />
      <ProductivityStack.Screen name="Notes" component={NotesScreen} />
      <ProductivityStack.Screen name="Expenses" component={ExpensesScreen} />
      <ProductivityStack.Screen name="Reminders" component={RemindersScreen} />
    </ProductivityStack.Navigator>
  );
}

function ToolsNavigator() {
  return (
    <ToolsStack.Navigator screenOptions={{ headerShown: true }}>
      <ToolsStack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ title: 'Activity Log' }} />
      <ToolsStack.Screen name="Calculator" component={CalculatorScreen} />
    </ToolsStack.Navigator>
  );
}

// Simple text-based tab icons (lucide icons will be added after NativeWind setup)
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}

export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabIcon label="🏠" color={color} />,
        }}
      />
      <Tab.Screen
        name="CommTab"
        component={CommunicationNavigator}
        options={{
          tabBarLabel: 'Comm',
          tabBarIcon: ({ color }) => <TabIcon label="✉️" color={color} />,
        }}
      />
      <Tab.Screen
        name="ContentTab"
        component={ContentNavigator}
        options={{
          tabBarLabel: 'Content',
          tabBarIcon: ({ color }) => <TabIcon label="📄" color={color} />,
        }}
      />
      <Tab.Screen
        name="ProductivityTab"
        component={ProductivityNavigator}
        options={{
          tabBarLabel: 'Productivity',
          tabBarIcon: ({ color }) => <TabIcon label="📅" color={color} />,
        }}
      />
      <Tab.Screen
        name="ToolsTab"
        component={ToolsNavigator}
        options={{
          tabBarLabel: 'Tools',
          tabBarIcon: ({ color }) => <TabIcon label="⚙️" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
