'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { loadWorkouts, saveWorkout } from '@/lib/storage'
import { Workout, WorkoutTemplate } from '@/lib/types'
import { PRESET_TEMPLATES, loadUserTemplates, deleteUserTemplate } from '@/lib/templates'

// Group preset templates by tag, preserving insertion order
function groupByTag(templates: WorkoutTemplate[]) {
  const order: string[] = []
  const groups: Record<string, WorkoutTemplate[]> = {}
  for (const t of templates) {
    if (!groups[t.tag]) {
      order.push(t.tag)
      groups[t.tag] = []
    }
    groups[t.tag].push(t)
  }
  return order.map((tag) => ({ tag, items: groups[tag] }))
}

export default function Home() {
  const router = useRouter()
  const [recent, setRecent] = useState<Workout[]>([])
  const [userTemplates, setUserTemplates] = useState<WorkoutTemplate[]>([])

  useEffect(() => {
    setRecent(loadWorkouts().filter((w) => w.finished).slice(0, 3))
    setUserTemplates(loadUserTemplates())
  }, [])

  function startWorkout(templateId?: string) {
    const workout: Workout = {
      id: uuidv4(),
      date: new Date().toISOString(),
      exercises: [],
      finished: false,
    }
    saveWorkout(workout)
    const url = templateId
      ? `/workout?id=${workout.id}&template=${templateId}`
      : `/workout?id=${workout.id}`
    router.push(url)
  }

  function handleDeleteTemplate(id: string) {
    deleteUserTemplate(id)
    setUserTemplates(loadUserTemplates())
  }

  const tagGroups = groupByTag(PRESET_TEMPLATES)

  return (
    <div className="flex flex-col gap-8 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IronLog</h1>
        <p className="text-neutral-500 text-sm mt-1">Krafttraining. Simpel.</p>
      </div>

      {/* Preset templates */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
          Vorlagen
        </h2>
        <div className="space-y-4">
          {tagGroups.map(({ tag, items }) => (
            <div key={tag}>
              <p className="text-xs text-neutral-600 mb-2 px-0.5">{tag}</p>
              <div className="grid grid-cols-2 gap-2">
                {items.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => startWorkout(t.id)}
                    className="bg-[#1a1a1a] hover:bg-[#222] active:bg-[#2a2a2a] rounded-xl p-3.5 text-left transition-colors"
                  >
                    <p className="font-semibold text-sm leading-tight">{t.name}</p>
                    <p className="text-xs text-neutral-500 mt-1 leading-tight">{t.description}</p>
                    <p className="text-xs text-orange-500 mt-2 font-medium">
                      {t.defaultSets}×{t.defaultReps}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User-saved templates */}
      {userTemplates.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Deine Vorlagen
          </h2>
          <div className="space-y-2">
            {userTemplates.map((t) => (
              <div
                key={t.id}
                className="bg-[#1a1a1a] rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <button onClick={() => startWorkout(t.id)} className="flex-1 text-left min-w-0">
                  <p className="font-medium text-sm truncate">{t.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {t.exercises?.length ?? 0} Übungen · {t.defaultSets}×{t.defaultReps}
                  </p>
                </button>
                <button
                  onClick={() => handleDeleteTemplate(t.id)}
                  className="text-neutral-600 hover:text-red-400 transition-colors p-1 ml-3 shrink-0"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent workouts */}
      {recent.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Zuletzt
          </h2>
          <div className="space-y-2">
            {recent.map((w) => (
              <div
                key={w.id}
                className="bg-[#1a1a1a] rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {new Date(w.date).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {w.exercises.map((e) => e.name).join(', ') || '—'}
                  </p>
                </div>
                <span className="text-xs text-neutral-600">
                  {w.exercises.length} Übung{w.exercises.length !== 1 ? 'en' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty workout */}
      <button
        onClick={() => startWorkout()}
        className="w-full border border-[#2a2a2a] hover:border-orange-500/50 hover:text-orange-500 text-neutral-600 font-medium text-sm rounded-2xl py-4 transition-colors"
      >
        + Leeres Training
      </button>
    </div>
  )
}
