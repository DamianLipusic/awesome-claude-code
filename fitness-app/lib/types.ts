export type WorkoutSet = {
  weight: number
  reps: number
  done: boolean
}

export type ExerciseEntry = {
  exerciseId: string
  name: string
  sets: WorkoutSet[]
}

export type Workout = {
  id: string
  date: string        // ISO string
  exercises: ExerciseEntry[]
  finished: boolean
}

export type Exercise = {
  id: string
  name: string
  muscle: string
}

export type WorkoutTemplate = {
  id: string
  name: string
  description: string
  tag: string
  defaultSets: number
  defaultReps: number
  suggestedMuscles: string[]
  isPreset: boolean
  /** Only for user-saved templates – the exercise list to pre-load */
  exercises?: { exerciseId: string; name: string }[]
}
