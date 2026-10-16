// Regression baseline: full groundCurve() output for fixed input sets, stored under tests/golden/.
// Regenerate deliberately with:  UPDATE_GOLDEN=1 npm run test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { run, DEFAULTS } from './helpers.js'

export const SETS = {
    // App defaults (src/App.vue); includes the rate-of-flow stress for advance_rate = 2 m/d
    defaults: { ...DEFAULTS },
    // Defaults with LSC yield length 20 cm (u_gap = 0.2 m / 2π)
    lsc: { ...DEFAULTS, l_yield: 20 },
    // Defaults with a slow advance (0.5 m/d) to exercise the rate-of-flow model
    rateOfFlow: { ...DEFAULTS, advance_rate: 0.5 }
}

// Every n-th point of long curves keeps the files small while still pinning the shape.
const sample = (arr, n) => arr.filter((_, i) => i % n === 0 || i === arr.length - 1)
const sampleXY = (o, n) => o ? { x: sample(o.x, n), y: sample(o.y, n) } : null

function snapshot(inputs) {
    const { obj, intersection, safetyFactor } = run(inputs)
    return {
        inputs,
        safetyFactor: Number(safetyFactor),
        intersection,
        criticalPoint: obj.criticalPoint,
        plasticRadius: obj.plasticRadius,
        u_if: obj.u_if.u_if,
        liningForces: obj.liningForces,
        supportCurve: obj.supportCurve,
        groundCurve: sampleXY(obj.groundCurve, 100),
        groundCurveLargeStrain: sampleXY(obj.groundCurveLargeStrain, 100),
        originalLDP: sampleXY(obj.originalLDP, 10),
        targetStress: sampleXY(obj.targetStress, 24),
        targetSupportPressure: sampleXY(obj.targetSupportPressure, 24),
        LDP_redIntersect: obj.LDP ? sampleXY(obj.LDP.redIntersect, 10) : null,
        actualStress: sampleXY(obj.actualStress, 5),
        utilisationSpC: sampleXY(obj.utilisationSpC, 5)
    }
}

const REL = 1e-9, ABS = 1e-12
function compare(actual, expected, path) {
    if (typeof expected === 'number') {
        assert.equal(typeof actual, 'number', `${path}: type`)
        assert.ok(Math.abs(actual - expected) <= Math.max(ABS, REL * Math.abs(expected)), `${path}: ${actual} != ${expected}`)
    } else if (Array.isArray(expected)) {
        assert.ok(Array.isArray(actual), `${path}: not an array`)
        assert.equal(actual.length, expected.length, `${path}: length`)
        expected.forEach((e, i) => compare(actual[i], e, `${path}[${i}]`))
    } else if (expected && typeof expected === 'object') {
        assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${path}: keys`)
        for (const k of Object.keys(expected)) compare(actual[k], expected[k], `${path}.${k}`)
    } else {
        assert.equal(actual, expected, path)
    }
}

for (const [name, inputs] of Object.entries(SETS)) {
    test(`golden: ${name}`, () => {
        const file = new URL(`./golden/${name}.json`, import.meta.url)
        const actual = JSON.parse(JSON.stringify(snapshot(inputs)))
        if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
            writeFileSync(file, JSON.stringify(actual, null, 1) + '\n')
            return
        }
        compare(actual, JSON.parse(readFileSync(file, 'utf8')), name)
    })
}
