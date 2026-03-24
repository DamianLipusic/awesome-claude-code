import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { usePeptide } from './hooks/usePeptide';
import { newProject } from './lib/storage';
import { CompareEntry } from './types';

import CalculatorScreen from './screens/CalculatorScreen';
import CompareScreen from './screens/CompareScreen';
import ProjectsScreen from './screens/ProjectsScreen';
import ExportScreen from './screens/ExportScreen';

import { COLORS } from './constants/theme';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function App() {
  const { state, actions } = usePeptide();

  const saveCurrentAsProject = () => {
    if (!state.results) { Alert.alert('No Results', 'Enter a sequence first.'); return; }
    Alert.prompt('Save Project', 'Enter a name for this project:', (name) => {
      if (!name?.trim()) return;
      const p = newProject(name.trim(), state.results!.sequence);
      p.modifications = { ...state.modifications };
      actions.upsertProject(p);
      Alert.alert('Saved', `"${name}" added to Projects.`);
    }, 'plain-text', '');
  };

  const addCompare = () => {
    if (!state.results) { Alert.alert('No Results', 'Enter a sequence first.'); return; }
    const id = Math.random().toString(36).slice(2);
    const entry: CompareEntry = {
      id,
      sequence: state.results.sequence,
      name: `Peptide ${state.comparing.length + 1}`,
      results: state.results,
    };
    actions.addCompare(entry);
    Alert.alert('Added', 'Sequence added to Compare tab.');
  };

  const tabBg = state.dark ? COLORS.cardDark : COLORS.cardLight;
  const border = state.dark ? COLORS.borderDark : COLORS.borderLight;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={state.dark ? 'light-content' : 'dark-content'} backgroundColor={tabBg} />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: tabBg },
            headerTintColor: state.dark ? COLORS.textDark : COLORS.textLight,
            headerTitleStyle: { fontWeight: '700' },
            headerRight: () => (
              <TouchableOpacity onPress={actions.toggleDark} style={{ marginRight: 16 }}>
                <Text style={{ fontSize: 20 }}>{state.dark ? '☀️' : '🌙'}</Text>
              </TouchableOpacity>
            ),
            tabBarStyle: {
              backgroundColor: tabBg,
              borderTopColor: border,
              borderTopWidth: 1,
            },
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: state.dark ? COLORS.mutedDark : COLORS.mutedLight,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          }}
        >
          <Tab.Screen
            name="Calculator"
            options={{
              title: 'Calculator',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🧬" focused={focused} />,
            }}
          >
            {() => (
              <CalculatorScreen
                sequence={state.sequence}
                modifications={state.modifications}
                results={state.results}
                errors={state.errors}
                dark={state.dark}
                onSequenceChange={actions.setSequence}
                onModChange={actions.setMod}
                onAddCompare={addCompare}
                onSaveProject={saveCurrentAsProject}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Compare"
            options={{
              title: 'Compare',
              tabBarIcon: ({ focused }) => <TabIcon emoji="⚗️" focused={focused} />,
              tabBarBadge: state.comparing.length > 0 ? state.comparing.length : undefined,
            }}
          >
            {() => (
              <CompareScreen
                entries={state.comparing}
                dark={state.dark}
                onAdd={actions.addCompare}
                onRemove={actions.removeCompare}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Projects"
            options={{
              title: 'Projects',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📁" focused={focused} />,
              tabBarBadge: state.projects.length > 0 ? state.projects.length : undefined,
            }}
          >
            {() => (
              <ProjectsScreen
                projects={state.projects}
                dark={state.dark}
                onUpsert={actions.upsertProject}
                onDelete={actions.deleteProject}
                onLoadIntoCalc={(seq) => actions.setSequence(seq)}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Export"
            options={{
              title: 'Export',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📄" focused={focused} />,
            }}
          >
            {() => (
              <ExportScreen
                results={state.results}
                modifications={state.modifications}
                dark={state.dark}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
