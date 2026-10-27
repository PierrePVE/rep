/**
 * Builds server/db/wgerExercises.json, the part of the base exercise
 * catalogue that comes from wger (https://wger.de), an open exercise database.
 * Run it with `npm run wger:import`, then review the JSON diff before
 * committing it.
 *
 * wger is only a data source: the app never calls it. Its exercises are
 * copied into our own `exercises` table (see defaultExercises.ts), because
 * workouts and programs reference exercises by foreign key, users edit and
 * archive their copy, and the app must keep working without wger.
 *
 * The selection is explicit (SELECTION below, hand-picked by wger id) rather
 * than "every French exercise": wger also holds stretches, cardio and rehab
 * moves that would clutter the picker. Running the script again gives the same
 * list, only picking up wger's own fixes.
 *
 * License: wger's exercise data is CC-BY-SA 4.0. The JSON keeps the source and
 * license so the attribution travels with the data.
 *
 * Runs with tsx, outside Nuxt: explicit imports only.
 */
import { writeFile } from 'node:fs/promises'
import { exerciseSchema, type EQUIPMENTS, type MUSCLE_GROUPS } from '../shared/utils/exercises'

type MuscleGroup = typeof MUSCLE_GROUPS[number]
type Equipment = typeof EQUIPMENTS[number]

/** wger's language id for French (GET /api/v2/language/). */
const FRENCH = 12

const OUTPUT = new URL('../server/db/wgerExercises.json', import.meta.url)

/**
 * One picked exercise: its wger id, plus overrides where wger's own data does
 * not fit (a long or clumsy French name, a muscle or equipment the automatic
 * mapping below gets wrong).
 */
interface Pick {
  id: number
  name?: string
  muscleGroup?: MuscleGroup
  equipment?: Equipment
}

/**
 * The exercises taken from wger, on top of the 24 hand-written ones of
 * defaultExercises.ts. wger's equivalents of those 24 are deliberately left
 * out, so existing accounts do not get the same exercise twice under two names.
 */
const SELECTION: Pick[] = [
  // Chest
  { id: 75, name: 'Développé couché haltères' },
  { id: 185, name: 'Développé décliné barre' },
  { id: 1694, name: 'Développé couché machine', equipment: 'machine' },
  { id: 925, name: 'Développé incliné Smith machine', equipment: 'machine' },
  { id: 135, name: 'Pec deck (butterfly)', equipment: 'machine' },
  { id: 238, name: 'Écarté haltères' },
  { id: 308, name: 'Écarté incliné haltères' },
  { id: 1270, name: 'Écarté poulie basse' },
  { id: 1551, name: 'Pompes' },
  { id: 386, name: 'Pompes diamant' },
  { id: 1112, name: 'Pompes déclinées', equipment: 'bodyweight' },
  { id: 161, name: 'Pullover haltère', muscleGroup: 'chest' },
  // Shoulders
  { id: 567, name: 'Développé épaules haltères' },
  { id: 1440, name: 'Push press' },
  { id: 256, name: 'Élévations frontales', equipment: 'dumbbell' },
  { id: 1744, name: 'Élévations latérales machine', equipment: 'machine' },
  { id: 1378, name: 'Élévations latérales poulie' },
  { id: 828, name: 'Oiseau haltères', muscleGroup: 'shoulders' },
  { id: 1709, name: 'Oiseau poulie', muscleGroup: 'shoulders' },
  { id: 1775, name: 'Oiseau machine (pec deck inversé)', muscleGroup: 'shoulders', equipment: 'machine' },
  { id: 289, name: 'Tirage menton (high pull)', equipment: 'barbell' },
  { id: 142, name: 'Rotation externe poulie' },
  { id: 571, name: 'Shrugs barre', muscleGroup: 'back' },
  { id: 572, name: 'Shrugs haltères', muscleGroup: 'back' },
  // Biceps
  { id: 92, name: 'Curl haltères' },
  { id: 94, name: 'Curl barre EZ' },
  { id: 95, name: 'Curl poulie' },
  { id: 204, name: 'Curl incliné haltères' },
  { id: 465, name: 'Curl pupitre', muscleGroup: 'biceps' },
  { id: 1465, name: 'Spider curl', equipment: 'dumbbell' },
  { id: 495, name: 'Curl inversé', equipment: 'barbell' },
  { id: 275, name: 'Curl marteau poulie' },
  { id: 1424, name: 'Curl machine', equipment: 'machine' },
  // Triceps
  { id: 246, name: 'Barre au front' },
  { id: 245, name: 'Barre au front haltères' },
  { id: 76, name: 'Développé couché prise serrée' },
  { id: 1513, name: 'Extension triceps poulie au-dessus de la tête' },
  { id: 1336, name: 'Extension triceps haltère au-dessus de la tête' },
  { id: 1509, name: 'Kickback triceps poulie' },
  { id: 1703, name: 'Kickback triceps haltère' },
  { id: 197, name: 'Dips entre deux bancs', equipment: 'bodyweight' },
  { id: 661, name: 'Extension triceps machine', equipment: 'machine' },
  // Forearms (wger has no forearm muscle: set by hand)
  { id: 51, name: 'Curl poignets barre', muscleGroup: 'forearms' },
  { id: 48, name: 'Curl poignets inversé barre', muscleGroup: 'forearms' },
  // Back
  { id: 1701, name: 'Rowing haltère un bras' },
  { id: 448, name: 'Rowing Pendlay' },
  { id: 513, name: 'Rowing T-bar', equipment: 'barbell' },
  { id: 1725, name: 'Rowing assis machine', equipment: 'machine' },
  { id: 1283, name: 'Rowing haltères poitrine appuyée', muscleGroup: 'back' },
  { id: 1621, name: 'Rowing unilatéral poulie' },
  { id: 158, name: 'Tirage vertical prise serrée', equipment: 'cable' },
  { id: 1726, name: 'Tirage bras tendus poulie' },
  { id: 152, name: 'Tractions supination', muscleGroup: 'back' },
  { id: 1696, name: 'Tractions prise neutre', equipment: 'bodyweight' },
  { id: 1929, name: 'Tractions assistées', equipment: 'machine' },
  { id: 1219, name: 'Tractions australiennes', muscleGroup: 'back' },
  { id: 301, name: 'Hyperextensions', equipment: 'bodyweight' },
  { id: 484, name: 'Rack pull', muscleGroup: 'back', equipment: 'barbell' },
  // Legs
  { id: 203, name: 'Goblet squat' },
  { id: 1706, name: 'Squat bulgare haltères', muscleGroup: 'quads' },
  { id: 1414, name: 'Hack squat', equipment: 'machine' },
  { id: 1747, name: 'Squat Smith machine', muscleGroup: 'quads', equipment: 'machine' },
  { id: 1803, name: 'Squat barre hexagonale', equipment: 'barbell' },
  { id: 630, name: 'Soulevé de terre sumo', muscleGroup: 'glutes', equipment: 'barbell' },
  { id: 1652, name: 'Soulevé de terre roumain haltères' },
  { id: 1392, name: 'Good morning', equipment: 'barbell' },
  { id: 46, name: 'Fentes barre' },
  { id: 206, name: 'Fentes marchées haltères' },
  { id: 1651, name: 'Fentes arrière haltères', muscleGroup: 'quads' },
  { id: 365, name: 'Leg curl allongé', equipment: 'machine' },
  { id: 910, name: 'Nordic curl', equipment: 'bodyweight' },
  { id: 1748, name: 'Abduction hanches machine', equipment: 'machine' },
  { id: 12, name: 'Adduction hanches machine', equipment: 'machine' },
  { id: 1132, name: 'Extension fessiers machine', equipment: 'machine' },
  { id: 1131, name: 'Kickback fessiers poulie' },
  { id: 265, name: 'Pont fessier', equipment: 'bodyweight' },
  { id: 960, name: 'Kettlebell swing', muscleGroup: 'glutes' },
  // Calves
  { id: 590, name: 'Mollets assis', muscleGroup: 'calves', equipment: 'machine' },
  { id: 146, name: 'Mollets à la presse', equipment: 'machine' },
  // Abs
  { id: 1933, name: 'Crunch', equipment: 'bodyweight' },
  { id: 1772, name: 'Crunch inversé' },
  { id: 172, name: 'Crunch machine', equipment: 'machine' },
  { id: 1529, name: 'Toes to bar', equipment: 'bodyweight' },
  { id: 1193, name: 'Russian twist', muscleGroup: 'abs', equipment: 'bodyweight' },
  { id: 1573, name: 'Roue abdominale', equipment: 'other' },
  { id: 1194, name: 'Pallof press', muscleGroup: 'abs' },
  { id: 145, name: 'Rotation du buste poulie' },
  { id: 577, name: 'Flexion latérale haltère' },
  { id: 297, name: 'Hollow hold', equipment: 'bodyweight' },
  // Full body
  { id: 650, name: 'Thruster', muscleGroup: 'full_body' },
  { id: 1901, name: 'Épaulé-développé', muscleGroup: 'full_body' },
]

/** wger muscle id → our muscle group (GET /api/v2/muscle/). */
const MUSCLE_MAP: Record<number, MuscleGroup> = {
  1: 'biceps', // Biceps brachii
  2: 'shoulders', // Anterior deltoid
  3: 'chest', // Serratus anterior
  4: 'chest', // Pectoralis major
  5: 'triceps', // Triceps brachii
  6: 'abs', // Rectus abdominis
  7: 'calves', // Gastrocnemius
  8: 'glutes', // Gluteus maximus
  9: 'back', // Trapezius
  10: 'quads', // Quadriceps femoris
  11: 'hamstrings', // Biceps femoris
  12: 'back', // Latissimus dorsi
  13: 'biceps', // Brachialis
  14: 'abs', // Obliquus externus abdominis
  15: 'calves', // Soleus
}

/**
 * wger equipment id → our equipment, in order of precedence: an exercise can
 * list several items (barbell + bench), and the main load wins. Benches, mats
 * and the like are support only, so they are absent here and ignored.
 */
const EQUIPMENT_PRECEDENCE: [number, Equipment][] = [
  [1, 'barbell'], // Barbell
  [2, 'barbell'], // SZ-bar
  [3, 'dumbbell'], // Dumbbell
  [10, 'kettlebell'], // Kettlebell
  [12, 'cable'], // Cable machine
  [6, 'bodyweight'], // Pull-up bar
  [7, 'bodyweight'], // None (bodyweight exercise)
  [11, 'other'], // Resistance band
  [5, 'other'], // Swiss ball
]

/** The fields of GET /api/v2/exerciseinfo/ this script reads. */
interface WgerExercise {
  id: number
  muscles: { id: number }[]
  equipment: { id: number }[]
  translations: { language: number, name: string }[]
}

/**
 * Downloads wger's whole catalogue (about 1000 exercises) in one request,
 * rather than one request per picked id.
 *
 * @returns The exercises, indexed by wger id.
 */
async function fetchWger(): Promise<Map<number, WgerExercise>> {
  const response = await fetch('https://wger.de/api/v2/exerciseinfo/?limit=1000')
  if (!response.ok) throw new Error(`wger answered ${response.status}`)
  const { count, results } = await response.json() as { count: number, results: WgerExercise[] }
  // A silent truncation would make picks look "missing" for the wrong reason.
  if (results.length < count) throw new Error(`wger returned ${results.length} of ${count} exercises: raise the limit`)
  return new Map(results.map(exercise => [exercise.id, exercise]))
}

/**
 * Turns one pick into a catalogue row, applying its overrides on top of the
 * automatic mapping.
 *
 * @param pick - The picked id and its overrides.
 * @param exercise - wger's data for that id.
 * @returns The row for the JSON.
 * @throws If a field cannot be determined: the pick then needs an override.
 */
function toRow(pick: Pick, exercise: WgerExercise) {
  const frenchName = exercise.translations.find(t => t.language === FRENCH)?.name.trim()
  const name = pick.name ?? frenchName
  // wger lists primary muscles in no meaningful order: the first mapped one is
  // a guess, which is why ambiguous picks override it.
  const muscleGroup = pick.muscleGroup ?? exercise.muscles.map(m => MUSCLE_MAP[m.id]).find(Boolean)
  const ids = new Set(exercise.equipment.map(e => e.id))
  const equipment = pick.equipment ?? EQUIPMENT_PRECEDENCE.find(([id]) => ids.has(id))?.[1]

  // Same rules as the API, so the seed can never insert what a user could not.
  const parsed = exerciseSchema.safeParse({ name, muscleGroup, equipment })
  if (!parsed.success) {
    throw new Error(`wger #${pick.id} (${frenchName ?? 'no French name'}): ${parsed.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`)
  }
  return { wgerId: pick.id, ...parsed.data }
}

/** Entry point. */
async function main() {
  const catalogue = await fetchWger()

  // Every problem is collected before failing, so one run lists all the picks
  // that need an override instead of stopping at the first.
  const rows: ReturnType<typeof toRow>[] = []
  const errors: string[] = []
  for (const pick of SELECTION) {
    const exercise = catalogue.get(pick.id)
    if (!exercise) {
      errors.push(`wger #${pick.id} no longer exists: replace or drop it`)
      continue
    }
    try {
      rows.push(toRow(pick, exercise))
    }
    catch (error) {
      errors.push((error as Error).message)
    }
  }
  if (errors.length) throw new Error(`\n${errors.join('\n')}`)

  // The unique index is (user_id, name): two rows with one name would make
  // the second silently skipped by the seed's ON CONFLICT DO NOTHING.
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.name)) throw new Error(`Duplicate name "${row.name}"`)
    seen.add(row.name)
  }

  const output = {
    source: 'wger Workout Manager, https://wger.de',
    license: 'CC-BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/',
    note: 'Generated by scripts/import-wger.ts from a hand-picked selection; names shortened and muscles adapted. Do not edit by hand: change the script and run it again.',
    exercises: rows,
  }
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`${rows.length} exercises written to server/db/wgerExercises.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
