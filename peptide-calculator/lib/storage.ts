import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from '../types';

const KEY = 'peptiCalcProjects';

export async function loadProjects(): Promise<Project[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(projects));
}

export function newProject(name: string, sequence: string): Project {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const steps = sequence.split('').reverse().map((aa, i) => ({
    position: i + 1,
    aa,
    done: false,
    completedAt: null,
  }));
  return {
    id,
    name,
    sequence,
    modifications: { nAcetyl: false, cAmide: false, disulfide: 0 },
    status: 'planning',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    synthesisSteps: steps,
    notes: '',
  };
}
