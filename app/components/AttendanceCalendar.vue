<!--
  Attendance calendar of a month, GitHub-contribution style: one square per
  day, Monday to Sunday rows of a week, filled when the user trained that day.
  Arrows move to the previous or next month (never past the current one).

  Color is one hue (the app's primary) from light to dark: an empty day, one
  session, two or more. It is never the only cue: each square has the day and
  its session count as its accessible name and tooltip, and the month's total
  is written under the title.

  Props:
  - days: days with a finished session, as "YYYY-MM-DD" with their count
    (GET /api/stats/dashboard).
  - today: today as "YYYY-MM-DD" in the app's time zone.
-->
<script setup lang="ts">
const props = defineProps<{
  days: Array<{ day: string, sessions: number }>
  today: string
}>()

const sessionsByDay = computed(() => new Map(props.days.map(d => [d.day, d.sessions])))

// Month shown, as its first day "YYYY-MM-01". Starts on the current month.
const month = ref(`${props.today.slice(0, 7)}-01`)
const currentMonth = computed(() => `${props.today.slice(0, 7)}-01`)

/**
 * Moves the shown month. Dates are handled in UTC on the date alone, as in
 * shared/utils/stats.ts, so no time zone can shift the day.
 *
 * @param offset - -1 for the previous month, 1 for the next one.
 */
function move(offset: -1 | 1) {
  const date = new Date(`${month.value}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  month.value = date.toISOString().slice(0, 10)
}

const title = computed(() => new Date(`${month.value}T00:00:00Z`)
  .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }))

/**
 * The squares of the month, with blank ones before the 1st so that each
 * column is a weekday (Monday first).
 */
const cells = computed(() => {
  const first = new Date(`${month.value}T00:00:00Z`)
  const blanks = (first.getUTCDay() + 6) % 7
  const cells: Array<{ day: string, date: number, sessions: number, future: boolean } | null> = Array(blanks).fill(null)
  for (const date = new Date(first); date.getUTCMonth() === first.getUTCMonth(); date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10)
    cells.push({ day, date: date.getUTCDate(), sessions: sessionsByDay.value.get(day) ?? 0, future: day > props.today })
  }
  return cells
})

/** Sessions of the shown month, written out so the count is never color-only. */
const monthTotal = computed(() => cells.value.reduce((total, c) => total + (c?.sessions ?? 0), 0))

/**
 * Accessible name and tooltip of a square, e.g. "mardi 4 novembre : 1 séance".
 *
 * @param cell - The day.
 * @param cell.day - Its date, "YYYY-MM-DD".
 * @param cell.sessions - Sessions done that day.
 * @returns The text.
 */
function describe(cell: { day: string, sessions: number }) {
  const label = new Date(`${cell.day}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${label} : ${cell.sessions ? `${cell.sessions} séance${cell.sessions > 1 ? 's' : ''}` : 'repos'}`
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
</script>

<template>
  <!-- Capped width: on a wide screen, full-width squares would be huge; on
       a phone the cap is never reached. -->
  <div class="mx-auto max-w-sm space-y-2">
    <div class="flex items-center gap-2">
      <div class="flex-1">
        <p class="font-medium first-letter:uppercase">
          {{ title }}
        </p>
        <p class="text-xs text-muted">
          {{ monthTotal }} séance{{ monthTotal > 1 ? 's' : '' }}
        </p>
      </div>
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="sm" aria-label="Mois précédent" @click="move(-1)" />
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Mois suivant"
        :disabled="month >= currentMonth"
        @click="move(1)"
      />
    </div>

    <div class="grid grid-cols-7 gap-1.5" role="list">
      <span v-for="(weekday, index) in WEEKDAYS" :key="index" class="text-center text-xs text-muted" aria-hidden="true">
        {{ weekday }}
      </span>
      <template v-for="(cell, index) in cells" :key="cell?.day ?? `blank-${index}`">
        <span v-if="!cell" aria-hidden="true" />
        <!-- A 1px border keeps empty days visible on the surface; filled days
             step from a light to a full primary. -->
        <span
          v-else
          role="listitem"
          :title="describe(cell)"
          :aria-label="describe(cell)"
          class="flex aspect-square items-center justify-center rounded text-[10px] tabular-nums"
          :class="[
            cell.future ? 'opacity-30' : '',
            cell.sessions >= 2 ? 'bg-primary text-inverted'
            : cell.sessions === 1 ? 'bg-primary/50 text-default'
              : 'border border-default text-dimmed',
            cell.day === today ? 'ring-2 ring-primary ring-offset-1 ring-offset-(--ui-bg)' : '',
          ]"
        >
          {{ cell.date }}
        </span>
      </template>
    </div>

    <!-- Legend of the three steps. -->
    <div class="flex items-center justify-end gap-3 text-xs text-muted">
      <span class="flex items-center gap-1"><span class="size-3 rounded-sm border border-default" />Repos</span>
      <span class="flex items-center gap-1"><span class="size-3 rounded-sm bg-primary/50" />1 séance</span>
      <span class="flex items-center gap-1"><span class="size-3 rounded-sm bg-primary" />2 ou plus</span>
    </div>
  </div>
</template>
