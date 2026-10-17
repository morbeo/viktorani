/**
 * Bundled font faces, so the app looks the same offline (ADR 0022). Workbox precaches the
 * `woff2` files with the rest of the build. Only the weights the app uses are loaded, in
 * the Latin, Latin Extended and Cyrillic subsets; each `@font-face` has a `unicode-range`,
 * so a browser fetches only the subsets a page needs. DM Mono has no Cyrillic.
 *
 * The font roles that use these families are `--font-display`, `--font-body` and
 * `--font-mono` in `index.css`. Classic uses the first three families; the rest are the
 * curated choices in the theme editor (`FONT_KEYS` in `db/index.ts`).
 */
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/playfair-display/latin-ext-700.css'
import '@fontsource/playfair-display/cyrillic-700.css'
import '@fontsource/playfair-display/latin-900.css'
import '@fontsource/playfair-display/latin-ext-900.css'
import '@fontsource/playfair-display/cyrillic-900.css'

import '@fontsource/lora/latin-400.css'
import '@fontsource/lora/latin-ext-400.css'
import '@fontsource/lora/cyrillic-400.css'
import '@fontsource/lora/latin-400-italic.css'
import '@fontsource/lora/latin-ext-400-italic.css'
import '@fontsource/lora/cyrillic-400-italic.css'
import '@fontsource/lora/latin-600.css'
import '@fontsource/lora/latin-ext-600.css'
import '@fontsource/lora/cyrillic-600.css'

import '@fontsource/dm-mono/latin-400.css'
import '@fontsource/dm-mono/latin-ext-400.css'
import '@fontsource/dm-mono/latin-500.css'
import '@fontsource/dm-mono/latin-ext-500.css'

import '@fontsource/oswald/latin-700.css'
import '@fontsource/oswald/latin-ext-700.css'
import '@fontsource/oswald/cyrillic-700.css'

import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-ext-400.css'
import '@fontsource/inter/cyrillic-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-ext-600.css'
import '@fontsource/inter/cyrillic-600.css'

import '@fontsource/merriweather/latin-400.css'
import '@fontsource/merriweather/latin-ext-400.css'
import '@fontsource/merriweather/cyrillic-400.css'
import '@fontsource/merriweather/latin-700.css'
import '@fontsource/merriweather/latin-ext-700.css'
import '@fontsource/merriweather/cyrillic-700.css'

import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-ext-400.css'
import '@fontsource/jetbrains-mono/cyrillic-400.css'
