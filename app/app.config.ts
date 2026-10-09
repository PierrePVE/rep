/**
 * App-level config, merged into the Nuxt UI theme.
 * Tailwind v4 no longer sets `cursor: pointer` on buttons by default,
 * so it is added once here for every UButton.
 */
export default defineAppConfig({
    ui: {
        button: {
            slots: {
                base: 'cursor-pointer'
            }
        }
    }
})