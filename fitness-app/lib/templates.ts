import { WorkoutTemplate } from './types'

const TEMPLATES_KEY = 'ironlog_templates'

export const PRESET_TEMPLATES: WorkoutTemplate[] = [
  // PPL
  {
    id: 'preset-push',
    name: 'Push',
    description: 'Brust · Schultern · Trizeps',
    tag: 'PPL',
    defaultSets: 4,
    defaultReps: 10,
    suggestedMuscles: ['Chest', 'Shoulders', 'Arms'],
    isPreset: true,
  },
  {
    id: 'preset-pull',
    name: 'Pull',
    description: 'Rücken · Bizeps',
    tag: 'PPL',
    defaultSets: 4,
    defaultReps: 10,
    suggestedMuscles: ['Back', 'Arms'],
    isPreset: true,
  },
  {
    id: 'preset-legs',
    name: 'Legs',
    description: 'Beine & Gesäß',
    tag: 'PPL',
    defaultSets: 4,
    defaultReps: 10,
    suggestedMuscles: ['Legs'],
    isPreset: true,
  },
  // Kraft
  {
    id: 'preset-5x5',
    name: '5×5 Kraft',
    description: 'Klassisches Kraftprogramm',
    tag: 'Kraft',
    defaultSets: 5,
    defaultReps: 5,
    suggestedMuscles: [],
    isPreset: true,
  },
  // Upper / Lower
  {
    id: 'preset-upper',
    name: 'Upper Body',
    description: 'Oberkörper komplett',
    tag: 'Upper/Lower',
    defaultSets: 3,
    defaultReps: 10,
    suggestedMuscles: ['Chest', 'Back', 'Shoulders', 'Arms'],
    isPreset: true,
  },
  {
    id: 'preset-lower',
    name: 'Lower Body',
    description: 'Unterkörper komplett',
    tag: 'Upper/Lower',
    defaultSets: 3,
    defaultReps: 10,
    suggestedMuscles: ['Legs', 'Core'],
    isPreset: true,
  },
  // Full Body
  {
    id: 'preset-fullbody',
    name: 'Full Body',
    description: 'Ganzkörper Training',
    tag: 'Full Body',
    defaultSets: 3,
    defaultReps: 8,
    suggestedMuscles: [],
    isPreset: true,
  },
  // Hypertrophie
  {
    id: 'preset-hyp',
    name: 'Hypertrophie',
    description: 'Fokus Muskelaufbau',
    tag: 'Hypertrophie',
    defaultSets: 4,
    defaultReps: 12,
    suggestedMuscles: [],
    isPreset: true,
  },
]

export function loadUserTemplates(): WorkoutTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveUserTemplate(template: WorkoutTemplate): void {
  if (typeof window === 'undefined') return
  const all = loadUserTemplates()
  const idx = all.findIndex((t) => t.id === template.id)
  if (idx >= 0) {
    all[idx] = template
  } else {
    all.unshift(template)
  }
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(all))
}

export function deleteUserTemplate(id: string): void {
  if (typeof window === 'undefined') return
  const all = loadUserTemplates().filter((t) => t.id !== id)
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(all))
}

export function getTemplate(id: string): WorkoutTemplate | undefined {
  if (id.startsWith('preset-')) {
    return PRESET_TEMPLATES.find((t) => t.id === id)
  }
  return loadUserTemplates().find((t) => t.id === id)
}
