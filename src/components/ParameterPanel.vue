<template>
  <div class="sidebar">
    <Accordion :value="[]" multiple>

      <!-- Soil Properties -->
      <AccordionPanel value="soil">
        <AccordionHeader>Soil Properties</AccordionHeader>
        <AccordionContent>
          <ParamRow v-model="p.gamma"   label="γ"    unit="kN/m³" :min="15"     :max="30"       :step="0.1"   :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.H"       label="H"    unit="m"     :min="10"     :max="1000"     :step="1"     :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.nu"      label="ν"    unit="—"     :min="0.05"   :max="0.49"     :step="0.01"  :fractionDigits="2" @change="emit('change')" />
          <ParamRow v-model="p.E"       label="E"    unit="MPa"   :min="10"     :max="16000"    :step="10"    :fractionDigits="0" :useGrouping="true" @change="emit('change')" />
          <ParamRow v-model="p.c"       label="c"    unit="kPa"   :min="0"      :max="10000"    :step="10"    :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.phi"     label="φ"    unit="°"     :min="0"      :max="45"       :sliderMin="15" :step="0.1" :fractionDigits="1" @change="emit('change')" />
        </AccordionContent>
      </AccordionPanel>

      <!-- Tunnel Properties -->
      <AccordionPanel value="tunnel">
        <AccordionHeader>Tunnel Properties</AccordionHeader>
        <AccordionContent>
          <ParamRow v-model="p.D" label="Dia." unit="m" :min="3" :max="20" :step="0.1" :fractionDigits="1" @change="emit('change')" />
        </AccordionContent>
      </AccordionPanel>

      <!-- Shotcrete Properties -->
      <AccordionPanel value="shotcrete">
        <AccordionHeader>Shotcrete Properties</AccordionHeader>
        <AccordionContent>
          <ParamRow v-model="p.f_ck"          label="f_ck"     unit="MPa"   :min="10"  :max="60"    :step="1"    :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.E_c"           label="E_c"      unit="MPa"   :min="3000" :max="35000" :step="1000" :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.nu_c"          label="ν_c"      unit="—"     :min="0.1"  :max="0.3"   :step="0.01" :fractionDigits="2" @change="emit('change')" />
          <ParamRow v-model="p.t_c"           label="t_c"      unit="m"     :min="0"    :max="1"     :step="0.05" :fractionDigits="2" @change="emit('change')" />
          <ParamRow v-model="p.dis_sup"       label="d_face"   unit="m"     :min="0"    :max="20"    :step="0.1"  :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.advance_rate"  label="adv."     unit="m/day" :min="0.5"  :max="10"    :step="0.1"  :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.l_yield"       label="LSC"      unit="cm"    :min="0"    :max="500"   :step="5"    :fractionDigits="0" @change="emit('change')" />
        </AccordionContent>
      </AccordionPanel>

      <!-- Rock Bolt Properties -->
      <AccordionPanel value="bolt">
        <AccordionHeader>Rock Bolt Properties</AccordionHeader>
        <AccordionContent>
          <ParamRow v-model="p.t_bf" label="T_bf"  unit="kN"  :min="0" :max="1000"  :step="1"     :fractionDigits="0" @change="emit('change')" />
          <ParamRow v-model="p.s_l"  label="S_l"   unit="m"   :min="0" :max="10"    :step="0.1"   :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.s_r"  label="S_r"   unit="m"   :min="0" :max="5"     :step="0.1"   :fractionDigits="1" @change="emit('change')" />
          <ParamRow v-model="p.d_b"  label="d_b"   unit="m"   :min="0" :max="0.1"   :step="0.001" :fractionDigits="3" @change="emit('change')" />
          <ParamRow v-model="p.l_b"  label="L_b"   unit="m"   :min="0" :max="15"    :step="0.1"   :fractionDigits="1" @change="emit('change')" />
        </AccordionContent>
      </AccordionPanel>

    </Accordion>
  </div>
</template>

<script setup>
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import ParamRow from './ParamRow.vue'

const props = defineProps({ params: Object })
const emit = defineEmits(['update:params', 'change'])

// Two-way binding: p proxies each param field
import { computed } from 'vue'
const p = computed({
  get: () => props.params,
  set: (v) => emit('update:params', v)
})
</script>
