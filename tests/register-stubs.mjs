// Preloaded by `node --test --import`: redirect the Plotly bundle to a stub.
// The calculation core imports Plotly at module level, but tests never render.
import { register } from 'node:module'

register(new URL('./stub-hooks.mjs', import.meta.url))
