/**
 * Rest timer between sets, started when a set is logged on the workout screen.
 *
 * The timer stores the time it ends at rather than a counter decremented each
 * second: a phone throttles or freezes timers of a page in the background (the
 * screen goes off between sets), and a counter would then fall behind, while
 * an end time stays right whenever the page wakes up.
 *
 * It is optional: the user can turn it off, and that choice is kept in the
 * browser (localStorage), since it is a per-device preference, not data.
 */

/** Rest used when the program gives none (or for exercises outside the plan). */
export const DEFAULT_REST_SECONDS = 90

const STORAGE_KEY = 'rest-timer-enabled'

/**
 * Gives access to the shared rest timer.
 *
 * Must be called from a component's setup (it uses useState).
 *
 * @returns The timer state (`endsAt`, `totalSeconds`, `enabled`) and the
 *   actions that change it.
 */
export function useRestTimer() {
  // Timestamp (ms) at which the rest ends; null when no timer runs. useState
  // so the timer survives leaving the page and coming back to it.
  const endsAt = useState<number | null>('rest-timer-ends-at', () => null)
  // Length of the current rest, for the progress bar.
  const totalSeconds = useState('rest-timer-total', () => DEFAULT_REST_SECONDS)
  // On by default; restoreSetting() reads the saved choice once mounted
  // (localStorage does not exist during server rendering).
  const enabled = useState('rest-timer-enabled', () => true)

  /**
   * Starts (or restarts) a rest. Does nothing when the timer is turned off.
   *
   * @param seconds - Length of the rest.
   */
  function start(seconds: number) {
    if (!enabled.value) return
    totalSeconds.value = seconds
    endsAt.value = Date.now() + seconds * 1000
  }

  /**
   * Lengthens (or shortens, with a negative value) the running rest.
   *
   * @param seconds - Seconds to add.
   */
  function add(seconds: number) {
    if (endsAt.value === null) return
    endsAt.value += seconds * 1000
    totalSeconds.value = Math.max(totalSeconds.value + seconds, 1)
  }

  /** Stops the running rest (skipped, or dismissed once over). */
  function stop() {
    endsAt.value = null
  }

  /** Reads the saved on/off choice. Call it from onMounted. */
  function restoreSetting() {
    // try/catch: storage can be blocked (private mode, disabled cookies).
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) enabled.value = saved === 'true'
    }
    catch { /* keep the default */ }
  }

  /**
   * Turns the timer on or off and remembers it. Turning it off also stops a
   * running rest, so the bar disappears at once.
   *
   * @param value - Whether the timer should start after each set.
   */
  function setEnabled(value: boolean) {
    enabled.value = value
    if (!value) stop()
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    }
    catch { /* the choice just will not survive a reload */ }
  }

  return { endsAt, totalSeconds, enabled, start, add, stop, restoreSetting, setEnabled }
}
