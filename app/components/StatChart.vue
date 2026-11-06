<!--
  A single-series chart (line or bars) of the statistics pages, on Chart.js.

  One series only, in the app's primary color: every chart of the app shows
  one measure, so there is no legend (the title above names it) and no
  palette to validate. Two measures never share a chart (no dual axis): they
  get one chart each.

  Mark specs: 2px line with 4px-radius points (bigger on hover), bars with
  4px rounded ends and a 2px gap, recessive grid and axes in muted text.
  Hovering (or tapping) shows a tooltip with the exact value; on a line, the
  whole column reacts, not only the point, so it is easy to hit on a phone.
  Rendered on the client only (canvas), in a fixed-height box.

  Props:
  - type: 'line' or 'bar'.
  - labels: one label per point or bar (dates, muscle groups...).
  - values: the numbers, same length as labels; null leaves a gap in a line.
  - unit: suffix of the values in the tooltip and axis, e.g. "kg".
  - horizontal: bars along the y axis (long category names read better).
  - height: CSS height of the chart box (default 12rem).
-->
<script setup lang="ts">
import {
  BarElement,
  CategoryScale,
  Chart,
  type ChartData,
  type ChartOptions,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'

// Tree-shaken registration: only the pieces used here end up in the bundle.
Chart.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip)

const props = withDefaults(defineProps<{
  type: 'line' | 'bar'
  labels: string[]
  values: Array<number | null>
  unit?: string
  horizontal?: boolean
  height?: string
}>(), { unit: '', horizontal: false, height: '12rem' })

/**
 * Formats a value with a French decimal comma and the unit.
 *
 * @param value - Number to show.
 * @returns e.g. "107,7 kg".
 */
function formatValue(value: number) {
  const number = value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
  return props.unit ? `${number} ${props.unit}` : number
}

// Theme colors, read from the Nuxt UI CSS variables so the chart follows the
// app's palette and its light / dark mode. Re-read when the mode changes.
const colorMode = useColorMode()
const theme = ref({ primary: '#00c16a', text: '#888', grid: 'rgba(128,128,128,0.2)', surface: '#fff' })

/** Reads the current theme colors from the document (client only). */
function readTheme() {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  theme.value = {
    primary: read('--ui-primary', theme.value.primary),
    text: read('--ui-text-muted', theme.value.text),
    grid: read('--ui-border', theme.value.grid),
    surface: read('--ui-bg', theme.value.surface),
  }
}

onMounted(readTheme)
// nextTick: the mode class is switched on <html> after the value changes.
watch(() => colorMode.value, () => nextTick(readTheme))

const data = computed<ChartData<'line' | 'bar', Array<number | null>, string>>(() => ({
  labels: props.labels,
  datasets: [{
    data: props.values,
    borderColor: theme.value.primary,
    backgroundColor: theme.value.primary,
    // Set explicitly: Chart.js derives hover colors by parsing the base
    // color, and it cannot parse the oklch() values of the Nuxt UI theme
    // (the hovered bar turned black).
    hoverBackgroundColor: theme.value.primary,
    hoverBorderColor: theme.value.primary,
    pointHoverBackgroundColor: theme.value.primary,
    pointHoverBorderColor: theme.value.surface,
    // Line marks.
    borderWidth: props.type === 'line' ? 2 : 0,
    pointRadius: 4,
    pointHoverRadius: 6,
    // A ring of the surface color around points, so they stay readable
    // where the line passes through them.
    pointBorderColor: theme.value.surface,
    pointBorderWidth: 2,
    spanGaps: true,
    // Bar marks: rounded data end only, thin bars with a gap between them.
    borderRadius: 4,
    borderSkipped: 'start',
    maxBarThickness: 28,
    categoryPercentage: 0.8,
    barPercentage: 0.9,
  }],
}))

const options = computed<ChartOptions<'line' | 'bar'>>(() => {
  const valueAxis = {
    beginAtZero: props.type === 'bar',
    grid: { color: theme.value.grid },
    border: { display: false },
    ticks: { color: theme.value.text, maxTicksLimit: 5, callback: (v: string | number) => formatValue(Number(v)) },
  }
  const categoryAxis = {
    grid: { display: false },
    border: { color: theme.value.grid },
    ticks: { color: theme.value.text, maxRotation: 0, autoSkipPadding: 12 },
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: props.horizontal ? 'y' : 'x',
    // The whole column (or row) is the hit target, not only the mark.
    interaction: { mode: 'index', intersect: false },
    scales: props.horizontal
      ? { x: valueAxis, y: categoryAxis }
      : { x: categoryAxis, y: valueAxis },
    plugins: {
      tooltip: {
        displayColors: false,
        callbacks: { label: item => formatValue(Number(item.raw)) },
      },
    },
  }
})
</script>

<template>
  <div :style="{ height }" class="relative">
    <ClientOnly>
      <Line v-if="type === 'line'" :data="(data as ChartData<'line', Array<number | null>, string>)" :options="(options as ChartOptions<'line'>)" />
      <Bar v-else :data="(data as ChartData<'bar', Array<number | null>, string>)" :options="(options as ChartOptions<'bar'>)" />
    </ClientOnly>
  </div>
</template>
