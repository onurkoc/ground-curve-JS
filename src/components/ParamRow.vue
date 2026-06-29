<template>
  <div class="param-row">
    <span class="param-label">{{ label }}</span>
    <InputNumber
      v-model="val"
      :min="min"
      :max="max"
      :step="step"
      :min-fraction-digits="0"
      :max-fraction-digits="fractionDigits"
      :use-grouping="useGrouping"
      fluid
      @value-change="$emit('change')"
    />
    <span class="param-unit">{{ unit }}</span>
  </div>
  <div class="param-slider-row">
    <input
      type="range"
      class="gc-slider"
      :min="sliderMin ?? min"
      :max="sliderMax ?? max"
      :step="step"
      :value="modelValue"
      :style="fillStyle"
      @input="onInput"
      @change="$emit('change')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import InputNumber from 'primevue/inputnumber'

const props = defineProps({
  modelValue:     Number,
  label:          String,
  unit:           String,
  min:            Number,
  max:            Number,
  sliderMin:      { type: Number, default: null },
  sliderMax:      { type: Number, default: null },
  step:           { type: Number, default: 1 },
  fractionDigits: { type: Number, default: 2 },
  useGrouping:    { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const val = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const fillStyle = computed(() => {
  const lo  = props.sliderMin ?? props.min
  const hi  = props.sliderMax ?? props.max
  const pct = Math.max(0, Math.min(100, ((props.modelValue - lo) / (hi - lo)) * 100))
  return { '--fill': `${pct}%` }
})

function onInput(e) {
  emit('update:modelValue', Number(e.target.value))
}
</script>
