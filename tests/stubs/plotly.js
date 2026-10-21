// Node stub for plotly.js-cartesian-dist: the calculation core imports Plotly at module level.
// newPlot() only records its arguments, so tests can check the traces and layout built by
// updateGraphic() without rendering.
export const calls = []
export default {
    newPlot(id, data, layout) { calls.push({ id, data, layout }) }
}
