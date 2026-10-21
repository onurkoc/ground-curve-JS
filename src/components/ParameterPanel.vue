<template>
  <div class="sidebar">
    <Accordion :value="[]" multiple>

      <!-- Soil Properties -->
      <AccordionPanel value="soil">
        <AccordionHeader>Soil Properties</AccordionHeader>
        <AccordionContent>
          <ParamRow v-model="p.gamma" :tooltip="labels.gamma"   label="γ"    unit="kN/m³" :min="15"     :max="30"       :step="0.1"   :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.H" :tooltip="labels.H"       label="H"    unit="m"     :min="10"     :max="1000"     :step="1"     :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.nu" :tooltip="labels.nu"      label="ν"    unit="—"     :min="0.05"   :max="0.49"     :step="0.01"  :fractionDigits="2" @change="emit('change')" />
          <ParamRow v-model="p.E" :tooltip="labels.E"       label="E"    unit="MPa"   :min="10"     :max="16000"    :step="10"    :fractionDigits="0" :useGrouping="true" @change="emit('change')" />
          <ParamRow v-model="p.c" :tooltip="labels.c"       label="c"    unit="kPa"   :min="0"      :max="10000"    :step="10"    :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.phi" :tooltip="labels.phi"     label="φ"    unit="°"     :min="0"      :max="45"       :sliderMin="15" :step="0.1" :fractionDigits="1" @change="emit('change')" />
        </AccordionContent>
      </AccordionPanel>

      <!-- Tunnel Properties -->
      <AccordionPanel value="tunnel">
        <AccordionHeader>Tunnel Properties</AccordionHeader>
        <AccordionContent>
          <ParamRow v-model="p.D" :tooltip="labels.D" label="Dia." unit="m" :min="3" :max="20" :step="0.1" :fractionDigits="1" @change="emit('change')" />
        </AccordionContent>
      </AccordionPanel>

      <!-- Shotcrete Properties -->
      <AccordionPanel value="shotcrete">
        <AccordionHeader>Shotcrete Properties</AccordionHeader>
        <AccordionContent>
          <ParamRow v-model="p.f_ck" :tooltip="labels.f_ck"          label="f_ck"     unit="MPa"   :min="10"  :max="60"    :step="1"    :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.E_c" :tooltip="labels.E_c"           label="E_c"      unit="MPa"   :min="3000" :max="35000" :step="1000" :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.nu_c" :tooltip="labels.nu_c"          label="ν_c"      unit="—"     :min="0.1"  :max="0.3"   :step="0.01" :fractionDigits="2" @change="emit('change')" />
          <ParamRow v-model="p.t_c" :tooltip="labels.t_c"           label="t_c"      unit="m"     :min="0"    :max="1"     :step="0.05" :fractionDigits="2" @change="emit('change')" />
          <ParamRow v-model="p.dis_sup" :tooltip="labels.dis_sup"       label="d_face"   unit="m"     :min="0"    :max="20"    :step="0.1"  :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.advance_rate" :tooltip="labels.advance_rate"  label="adv."     unit="m/day" :min="0.5"  :max="10"    :step="0.1"  :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.l_yield" :tooltip="labels.l_yield"       label="LSC"      unit="cm"    :min="0"    :max="500"   :step="5"    :fractionDigits="0" @change="emit('change')"
            help="Yield path of the element, tangential (cm)." />
          <ParamRow v-model="p.F_LSC" :tooltip="labels.F_LSC"         label="LSC force" unit="kN/m" :min="0"    :max="5000"  :step="50"   :fractionDigits="0" stacked @change="emit('change')"
            help="Ring force carried by the yielding element (kN per m tunnel). 0 = open slot without load (previous behaviour)." />
        </AccordionContent>
      </AccordionPanel>

      <!-- Rock Bolt Properties -->
      <AccordionPanel value="bolt">
        <AccordionHeader>Rock Bolt Properties</AccordionHeader>
        <AccordionContent>
          <ParamRow v-model="p.t_bf" :tooltip="labels.t_bf" label="T_bf"  unit="kN"  :min="0" :max="1000"  :step="1"     :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.s_l" :tooltip="labels.s_l"  label="S_l"   unit="m"   :min="0" :max="10"    :step="0.1"   :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.s_r" :tooltip="`${labels.s_r} (s_c after Hoek)`"  label="S_c"   unit="m"   :min="0" :max="5"     :step="0.1"   :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.d_b" :tooltip="labels.d_b"  label="d_b"   unit="m"   :min="0" :max="0.1"   :step="0.001" :fractionDigits="3" @change="emit('change')" />
          <ParamRow v-model="p.l_b" :tooltip="labels.l_b"  label="L_b"   unit="m"   :min="0" :max="15"    :step="0.1"   :fractionDigits="1" @change="emit('change')" />
        </AccordionContent>
      </AccordionPanel>

    </Accordion>

    <!-- Display option: large-strain ground curve (no effect on equilibrium, FS or LDP) -->
    <label class="sidebar-option">
      <Checkbox v-model="largeStrain" binary />
      <span>Large strain (Vrakas &amp; Anagnostou 2015)</span>
    </label>
  </div>
</template>

<script setup>
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Checkbox from 'primevue/checkbox'
import ParamRow from './ParamRow.vue'

const props = defineProps({ params: Object, labels: { type: Object, default: () => ({}) } })
const emit = defineEmits(['update:params', 'change'])
const largeStrain = defineModel('largeStrain', { type: Boolean, default: false })

// Two-way binding: p proxies each param field
import { computed } from 'vue'
const p = computed({
  get: () => props.params,
  set: (v) => emit('update:params', v)
})
</script>
