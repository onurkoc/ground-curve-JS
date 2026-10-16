<template>
  <div class="app-layout">

    <!-- Phone only (≤ 768 px): bar with toggle for the parameter sidebar -->
    <div class="mobile-bar">
      <button type="button" class="mobile-bar-toggle" :aria-expanded="sidebarOpen"
        aria-controls="parameter-sidebar" @click="sidebarOpen = !sidebarOpen">
        <i :class="sidebarOpen ? 'pi pi-times' : 'pi pi-sliders-h'" aria-hidden="true"></i>
        <span>Parameters</span>
      </button>
    </div>
    <div v-if="isMobile && sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false"></div>

    <ParameterPanel id="parameter-sidebar" :class="{ 'sidebar--open': sidebarOpen }"
      :params="params" v-model:largeStrain="showLargeStrain" @change="recalculate" />

    <div class="chart-area">
      <Tabs value="basic" class="chart-tabs" @update:value="onTabChange">
        <TabList>
          <Tab value="basic">Basic</Tab>
          <Tab value="enhanced">Enhanced</Tab>
          <Tab value="parameter">Parameter</Tab>
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

          <!-- Parameter tab: summary of the current input parameters -->
          <TabPanel value="parameter">
            <div class="summary-panel">
              <div class="summary-param-list">
                <div v-for="[key, val] in paramEntries" :key="key" class="summary-param-row">
                  <span class="summary-param-label">{{ paramLabels[key] ?? key }}</span>
                  <span class="summary-param-value">{{ val }}</span>
                  <span class="summary-param-unit">{{ paramUnits[key] ?? '' }}</span>
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
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Plotly from 'plotly.js-cartesian-dist'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
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
  F_LSC:        0,
  // Rock bolt
  t_bf: 250,
  s_l:  2,
  s_r:  1.5,
  d_b:  0.034,
  l_b:  3
})

// ── Labels and units for parameter panel ────────────────────────────────────
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
  F_LSC:        'LSC Force',
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
  dis_sup: 'm', advance_rate: 'm/day', l_yield: 'cm', F_LSC: 'kN/m',
  t_bf: 'kN', s_l: 'm', s_r: 'm', d_b: 'm', l_b: 'm'
}
const paramEntries = computed(() => Object.entries(params))

// Display only: overlay the large-strain ground curve (Vrakas & Anagnostou 2015)
const showLargeStrain = ref(false)

// ── Phone layout (≤ 768 px): collapsible sidebar, legend below the chart ─────
const mobileQuery = window.matchMedia('(max-width: 768px)')
const isMobile = ref(mobileQuery.matches)
const sidebarOpen = ref(false)
function onMediaChange(e) {
  isMobile.value = e.matches
  if (!e.matches) sidebarOpen.value = false
}
mobileQuery.addEventListener('change', onMediaChange)
onBeforeUnmount(() => mobileQuery.removeEventListener('change', onMediaChange))

// ── Recalculate and render ───────────────────────────────────────────────────
function recalculate() {
  const p = params
  updateGraphic(
    p.gamma, p.H, p.nu, p.E, p.D, p.c, p.phi,
    p.f_ck, p.E_c, p.nu_c, p.t_c,
    p.dis_sup, p.advance_rate,
    p.t_bf, p.s_l, p.s_r, p.d_b, p.l_b, p.l_yield, p.F_LSC,
    { showLargeStrain: showLargeStrain.value, legendBelow: isMobile.value }
  )
}

onMounted(() => nextTick(() => recalculate()))
watch([showLargeStrain, isMobile], recalculate)

// ── Resize chart when switching to a tab that was hidden ─────────────────────
function onTabChange(tabValue) {
  // The parameter tab has no chart
  if (tabValue === 'parameter') return
  nextTick(() => {
    const id = tabValue === 'enhanced' ? 'graph' : 'graphBasic'
    const el = document.getElementById(id)
    if (el) Plotly.Plots.resize(el)
  })
}
</script>
