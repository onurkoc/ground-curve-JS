<template>
  <div class="app-layout">

    <ParameterPanel :params="params" @change="recalculate" />

    <div class="chart-area">
      <Tabs value="basic" class="chart-tabs" @update:value="onTabChange">
        <TabList>
          <Tab value="basic">Basic</Tab>
          <Tab value="enhanced">Enhanced</Tab>
          <Tab value="print">Print</Tab>
        </TabList>
        <TabPanels>

          <!-- Basic tab: simple GRC chart -->
          <TabPanel value="basic">
            <div class="chart-tab-content">
              <div id="graphBasic" style="width:100%;height:100%"></div>
            </div>
          </TabPanel>

          <!-- Enhanced tab: 4-axis chart with LDP and time plots -->
          <TabPanel value="enhanced">
            <div class="chart-tab-content">
              <div id="graph" style="width:100%;height:100%"></div>
            </div>
          </TabPanel>

          <!-- Print tab: sends current parameters to print screen window -->
          <TabPanel value="print">
            <div class="print-panel">
              <Button label="Open Parameter Summary" @click="openPrintScreen" />
              <div class="print-param-list">
                <div v-for="[key, val] in paramEntries" :key="key" class="print-param-row">
                  <span class="print-param-label">{{ paramLabels[key] ?? key }}</span>
                  <span class="print-param-value">{{ val }}</span>
                  <span class="print-param-unit">{{ paramUnits[key] ?? '' }}</span>
                </div>
              </div>
            </div>
          </TabPanel>

        </TabPanels>
      </Tabs>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import Plotly from 'plotly.js-cartesian-dist'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Button from 'primevue/button'
import ParameterPanel from './components/ParameterPanel.vue'
import { updateGraphic } from './physics/groundCurveCalc.js'

// ── Reactive parameters (all 19) ─────────────────────────────────────────────
const params = reactive({
  // Soil
  gamma: 20,
  H:     500,
  nu:    0.30,
  E:     1050,
  c:     1000,
  phi:   28,
  // Tunnel
  D:     8,
  // Shotcrete
  f_ck:         30,
  E_c:          31000,
  nu_c:         0.2,
  t_c:          0.2,
  dis_sup:      2,
  advance_rate: 2,
  l_yield:      0,
  // Rock bolt
  t_bf: 250,
  s_l:  2,
  s_r:  1.5,
  d_b:  0.034,
  l_b:  3
})

// ── Labels and units for print panel ────────────────────────────────────────
const paramLabels = {
  gamma: 'γ',
  H:     'H',
  nu:    'ν',
  E:     'E',
  c:     'c',
  phi:   'φ',
  D:     'Tunnel Diameter',
  f_ck:         'SpC Strength',
  E_c:          'SpC Elasticity',
  nu_c:         'SpC Poisson\'s Ratio',
  t_c:          'SpC Thickness',
  dis_sup:      'SpC Distance',
  advance_rate: 'Advance Rate',
  l_yield:      'LSC Yield',
  t_bf: 'Bolt Pull-out Force',
  s_l:  'Bolt Longitudinal Spacing',
  s_r:  'Bolt Radial Spacing',
  d_b:  'Bolt Diameter',
  l_b:  'Bolt Length'
}
const paramUnits = {
  gamma: 'kN/m³', H: 'm', nu: '—', E: 'MPa', c: 'kPa', phi: '°',
  D: 'm',
  f_ck: 'MPa', E_c: 'MPa', nu_c: '—', t_c: 'm',
  dis_sup: 'm', advance_rate: 'm/day', l_yield: 'cm',
  t_bf: 'kN', s_l: 'm', s_r: 'm', d_b: 'm', l_b: 'm'
}
const paramEntries = computed(() => Object.entries(params))

// ── Recalculate and render ───────────────────────────────────────────────────
function recalculate() {
  const p = params
  updateGraphic(
    p.gamma, p.H, p.nu, p.E, p.D, p.c, p.phi,
    p.f_ck, p.E_c, p.nu_c, p.t_c,
    p.dis_sup, p.advance_rate,
    p.t_bf, p.s_l, p.s_r, p.d_b, p.l_b, p.l_yield
  )
}

onMounted(() => nextTick(() => recalculate()))

// ── Resize chart when switching to a tab that was hidden ─────────────────────
function onTabChange(tabValue) {
  nextTick(() => {
    const id = tabValue === 'enhanced' ? 'graph' : 'graphBasic'
    const el = document.getElementById(id)
    if (el) Plotly.Plots.resize(el)
  })
}

// ── Print screen ─────────────────────────────────────────────────────────────
function openPrintScreen() {
  const p = params
  const valueObject = {
    gamma:                String(p.gamma),
    height:               String(p.H),
    nu:                   String(p.nu),
    elasticity:           String(p.E),
    diameter:             String(p.D),
    cohesion:             String(p.c),
    friction:             String(p.phi),
    concStrength:         String(p.f_ck),
    concElasticity:       String(p.E_c),
    concNu:               String(p.nu_c),
    concThickness:        String(p.t_c),
    distSupport:          String(p.dis_sup),
    advanceRate:          String(p.advance_rate),
    pullOutForce:         String(p.t_bf),
    boltLongitudinalLength: String(p.s_l),
    boltRadialLength:     String(p.s_r),
    boltDiamater:         String(p.d_b),
    boltLength:           String(p.l_b),
    lscYield:             String(p.l_yield)
  }
  window.electronAPI.printScreen(valueObject)
}
</script>
