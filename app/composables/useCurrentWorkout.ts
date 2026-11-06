/**
 * State and actions of a session: the one in progress (useCurrentWorkout,
 * shared by every page that shows it) or a past one opened from the history
 * (useWorkoutEditor on the page's own state).
 *
 * Set edits are optimistic: the change shows at once and the API call runs
 * behind it, since at the gym the network is often slow and logging a set
 * must never make the user wait. If the call fails, only that change is undone
 * (not a snapshot of the whole session, which would also undo other changes
 * made in the meantime) and a toast explains why.
 */
import type { InternalApi } from 'nitropack/types'

/** The session tree as the API sends it (dates are ISO strings). */
type ApiWorkout = NonNullable<InternalApi['/api/workouts/current']['get']['workout']>
type ApiWorkoutExercise = ApiWorkout['exercises'][number]

/**
 * A set on the client. `prs` holds the records it beat, known only for the
 * sets logged or edited during this visit (the API computes them on write, not
 * on load). A negative `id` marks a set the API has not confirmed yet: the
 * page must not edit or delete it until it gets its real id.
 */
export type WorkoutSet = ApiWorkoutExercise['sets'][number] & { prs?: PrType[] }
export type WorkoutExercise = Omit<ApiWorkoutExercise, 'sets'> & { sets: WorkoutSet[] }
export type CurrentWorkout = Omit<ApiWorkout, 'exercises'> & { exercises: WorkoutExercise[] }

// Ids of not-yet-confirmed sets. Negative so they never collide with the
// serial ids of the database. Module-level: unique for the whole tab.
let nextTempId = -1

/**
 * Editing actions on a session held in `workout`: add or remove exercises,
 * log, edit or delete sets. They work the same on the session in progress and
 * on a finished one (the API allows both, so the history can be fixed).
 *
 * Must be called from a component's setup (it uses useToast).
 *
 * @param workout - State holding the session; the actions do nothing while it
 *   is null or undefined.
 * @returns The actions. Each one changes `workout` in place.
 */
export function useWorkoutEditor(workout: Ref<CurrentWorkout | null | undefined>) {
  const toast = useToast()

  /** Shows the API error in a toast (the messages are written for the user). */
  function notifyError(error: unknown) {
    toast.add({ title: apiErrorMessage(error), color: 'error' })
  }

  /**
   * Finds a set and its exercise in the current state.
   *
   * @param setId - Id of the set.
   * @returns The exercise, the set and its index, or null if not found (e.g.
   *   its exercise was removed meanwhile).
   */
  function findSet(setId: number) {
    for (const exercise of workout.value?.exercises ?? []) {
      const index = exercise.sets.findIndex(s => s.id === setId)
      const set = exercise.sets[index]
      if (set) return { exercise, set, index }
    }
    return null
  }

  /**
   * Finds an exercise of the session.
   *
   * @param workoutExerciseId - Id of the workout exercise.
   * @returns The exercise, or undefined if it is not (or no longer) there.
   */
  function findExercise(workoutExerciseId: number) {
    return workout.value?.exercises.find(e => e.id === workoutExerciseId)
  }

  /**
   * Rewrites the positions of a list after an insertion or removal, the way
   * the API renumbers them, so the state matches the database without a reload.
   */
  function renumber(items: { position: number }[]) {
    items.forEach((item, index) => { item.position = index })
  }

  /**
   * Adds an exercise at the end of the session. Not optimistic: the row needs
   * the exercise's name and muscle group, which the API sends back, and adding
   * an exercise is rare compared to logging sets.
   *
   * @param exerciseId - Exercise of the user's catalogue.
   * @returns Whether it was added.
   */
  async function addExercise(exerciseId: number) {
    if (!workout.value) return false
    try {
      const created = await $fetch(`/api/workouts/${workout.value.id}/exercises`, {
        method: 'POST',
        body: { exerciseId },
      })
      // Re-read the state after the await: the session may have been
      // finished or reloaded meanwhile.
      workout.value?.exercises.push(created)
      return true
    }
    catch (error) {
      notifyError(error)
      return false
    }
  }

  /**
   * Removes an exercise and its sets from the session (optimistic).
   *
   * @param workoutExerciseId - Id of the workout exercise.
   * @returns Whether the API confirmed the removal.
   */
  async function removeExercise(workoutExerciseId: number) {
    const exercises = workout.value?.exercises
    const index = exercises?.findIndex(e => e.id === workoutExerciseId) ?? -1
    const removed = exercises?.[index]
    if (!exercises || !removed) return false

    exercises.splice(index, 1)
    renumber(exercises)
    try {
      await $fetch(`/api/workout-exercises/${workoutExerciseId}`, { method: 'DELETE' })
      return true
    }
    catch (error) {
      // Put it back where it was. Clamped, in case other exercises were
      // removed while the call was running.
      exercises.splice(Math.min(index, exercises.length), 0, removed)
      renumber(exercises)
      notifyError(error)
      return false
    }
  }

  /**
   * Logs a set at the end of an exercise (optimistic): it shows at once with a
   * temporary id, which is swapped for the real one when the API answers.
   *
   * @param workoutExerciseId - Id of the workout exercise.
   * @param input - The set, validated with setSchema by the page.
   * @returns The records it beat (empty if none), or null if it failed.
   */
  async function addSet(workoutExerciseId: number, input: SetInput) {
    const exercise = findExercise(workoutExerciseId)
    if (!exercise) return null

    const tempId = nextTempId--
    exercise.sets.push({
      id: tempId,
      position: exercise.sets.length,
      weightKg: input.weightKg,
      reps: input.reps,
      rpe: input.rpe ?? null,
      type: input.type,
      createdAt: new Date().toISOString(),
    })

    try {
      const { set, prs } = await $fetch(`/api/workout-exercises/${workoutExerciseId}/sets`, {
        method: 'POST',
        body: input,
      })
      // Looked up again by its temporary id: other sets may have been added
      // or removed meanwhile, so the index from before the await may be stale.
      const pending = findSet(tempId)
      if (pending) {
        // Drop workoutExerciseId so the row keeps the same shape as the
        // loaded ones; prs is kept on the set for the badge.
        const { workoutExerciseId: _, ...saved } = set
        pending.exercise.sets[pending.index] = { ...saved, prs }
      }
      return prs
    }
    catch (error) {
      const pending = findSet(tempId)
      if (pending) {
        pending.exercise.sets.splice(pending.index, 1)
        renumber(pending.exercise.sets)
      }
      notifyError(error)
      return null
    }
  }

  /**
   * Edits a set (optimistic). Its records are recomputed by the API, since an
   * edit may create or remove one.
   *
   * @param setId - Id of a confirmed set (not a temporary one).
   * @param changes - Fields to change, validated with setUpdateSchema.
   * @returns The records it now beats, or null if it failed.
   */
  async function updateSet(setId: number, changes: SetUpdateInput) {
    const found = findSet(setId)
    if (!found || setId < 0) return null

    // Only the changed fields are saved for the rollback: the other ones may
    // be edited by another call in the meantime and must not be reverted.
    const previous = Object.fromEntries(
      Object.keys(changes).map(key => [key, found.set[key as keyof SetUpdateInput]]),
    ) as SetUpdateInput
    Object.assign(found.set, changes)

    try {
      const { prs } = await $fetch(`/api/sets/${setId}`, { method: 'PATCH', body: changes })
      const current = findSet(setId)
      if (current) current.set.prs = prs
      return prs
    }
    catch (error) {
      const current = findSet(setId)
      if (current) Object.assign(current.set, previous)
      notifyError(error)
      return null
    }
  }

  /**
   * Deletes a set (optimistic).
   *
   * @param setId - Id of a confirmed set (not a temporary one).
   * @returns Whether the API confirmed the deletion.
   */
  async function removeSet(setId: number) {
    const found = findSet(setId)
    if (!found || setId < 0) return false

    const { exercise, set, index } = found
    exercise.sets.splice(index, 1)
    renumber(exercise.sets)
    try {
      await $fetch(`/api/sets/${setId}`, { method: 'DELETE' })
      return true
    }
    catch (error) {
      exercise.sets.splice(Math.min(index, exercise.sets.length), 0, set)
      renumber(exercise.sets)
      notifyError(error)
      return false
    }
  }

  return { addExercise, removeExercise, addSet, updateSet, removeSet }
}

/** The editing actions, as passed to WorkoutExerciseCard. */
export type WorkoutEditor = ReturnType<typeof useWorkoutEditor>

/**
 * Gives access to the session in progress.
 *
 * Must be called from a component's setup (it uses useState, useToast and
 * useRequestFetch).
 *
 * @returns The shared `workout` state (undefined until loaded, null when no
 *   session is in progress) and the actions that change it.
 */
export function useCurrentWorkout() {
  const workout = useState<CurrentWorkout | null | undefined>('current-workout', () => undefined)
  const editor = useWorkoutEditor(workout)
  const toast = useToast()
  // Unlike $fetch, forwards the session cookie when the page renders on the
  // server; without it, a server-side load would answer 401.
  const requestFetch = useRequestFetch()

  /** Shows the API error in a toast (the messages are written for the user). */
  function notifyError(error: unknown) {
    toast.add({ title: apiErrorMessage(error), color: 'error' })
  }

  /** Loads (or reloads) the session in progress from the API. */
  async function load() {
    const { workout: current } = await requestFetch('/api/workouts/current')
    workout.value = current
  }

  /**
   * Starts a session, or resumes the one in progress (the API never starts a
   * second one).
   *
   * @param programDayId - Program day to prefill from; omitted for a free session.
   * @returns Whether the session is now in progress.
   */
  async function start(programDayId?: number) {
    try {
      const { workout: started } = await $fetch('/api/workouts', {
        method: 'POST',
        body: { programDayId: programDayId ?? null },
      })
      workout.value = started
      return true
    }
    catch (error) {
      notifyError(error)
      return false
    }
  }

  /**
   * Ends the session in progress. Not optimistic: the page navigates away
   * right after, so it must know the end was really saved.
   *
   * @returns Whether the session was ended.
   */
  async function finish() {
    if (!workout.value) return false
    try {
      await $fetch(`/api/workouts/${workout.value.id}/finish`, { method: 'POST' })
      workout.value = null
      return true
    }
    catch (error) {
      notifyError(error)
      return false
    }
  }

  return { workout, load, start, finish, ...editor }
}
