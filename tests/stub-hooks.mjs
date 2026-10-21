const STUBS = {
    'plotly.js-cartesian-dist': new URL('./stubs/plotly.js', import.meta.url).href
}

export async function resolve(specifier, context, nextResolve) {
    if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true }
    return nextResolve(specifier, context)
}
