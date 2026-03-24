import { Exercise } from './types'

export const EXERCISES: Exercise[] = [
  // Chest
  { id: 'bench-press', name: 'Bench Press', muscle: 'Chest' },
  { id: 'incline-bench', name: 'Incline Bench Press', muscle: 'Chest' },
  { id: 'dips', name: 'Dips', muscle: 'Chest' },
  { id: 'cable-fly', name: 'Cable Fly', muscle: 'Chest' },
  { id: 'push-up', name: 'Push-Up', muscle: 'Chest' },

  // Back
  { id: 'deadlift', name: 'Deadlift', muscle: 'Back' },
  { id: 'pull-up', name: 'Pull-Up', muscle: 'Back' },
  { id: 'barbell-row', name: 'Barbell Row', muscle: 'Back' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back' },
  { id: 'cable-row', name: 'Cable Row', muscle: 'Back' },
  { id: 'face-pull', name: 'Face Pull', muscle: 'Back' },

  // Shoulders
  { id: 'ohp', name: 'Overhead Press', muscle: 'Shoulders' },
  { id: 'lateral-raise', name: 'Lateral Raise', muscle: 'Shoulders' },
  { id: 'front-raise', name: 'Front Raise', muscle: 'Shoulders' },
  { id: 'arnold-press', name: 'Arnold Press', muscle: 'Shoulders' },

  // Legs
  { id: 'squat', name: 'Squat', muscle: 'Legs' },
  { id: 'leg-press', name: 'Leg Press', muscle: 'Legs' },
  { id: 'romanian-dl', name: 'Romanian Deadlift', muscle: 'Legs' },
  { id: 'leg-curl', name: 'Leg Curl', muscle: 'Legs' },
  { id: 'leg-extension', name: 'Leg Extension', muscle: 'Legs' },
  { id: 'calf-raise', name: 'Calf Raise', muscle: 'Legs' },
  { id: 'lunge', name: 'Lunge', muscle: 'Legs' },
  { id: 'hack-squat', name: 'Hack Squat', muscle: 'Legs' },

  // Arms
  { id: 'barbell-curl', name: 'Barbell Curl', muscle: 'Arms' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscle: 'Arms' },
  { id: 'incline-curl', name: 'Incline Dumbbell Curl', muscle: 'Arms' },
  { id: 'skull-crusher', name: 'Skull Crusher', muscle: 'Arms' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscle: 'Arms' },
  { id: 'overhead-tricep', name: 'Overhead Tricep Extension', muscle: 'Arms' },
  { id: 'close-grip-bench', name: 'Close Grip Bench', muscle: 'Arms' },

  // Core
  { id: 'plank', name: 'Plank', muscle: 'Core' },
  { id: 'crunch', name: 'Crunch', muscle: 'Core' },
  { id: 'ab-wheel', name: 'Ab Wheel', muscle: 'Core' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscle: 'Core' },
  { id: 'russian-twist', name: 'Russian Twist', muscle: 'Core' },
]

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}

export const MUSCLES = [...new Set(EXERCISES.map((e) => e.muscle))]
