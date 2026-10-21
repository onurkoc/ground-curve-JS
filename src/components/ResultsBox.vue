<template>
  <!-- Phone only: results above the first chart (the legend keeps only the curve names) -->
  <div class="results-box">
    <p v-if="r.noEquilibrium" class="results-message">{{ r.message }}</p>
    <dl class="results-grid">
      <div class="results-item">
        <dt>{{ r.fsLabel }}</dt>
        <dd :class="{ 'results-red': r.fsRed }">{{ r.fs }}</dd>
      </div>
      <div v-if="r.fsShotcrete" class="results-item">
        <dt>FS (shotcrete)</dt><dd>{{ r.fsShotcrete }}</dd>
      </div>
      <div v-if="r.boltUtilisation" class="results-item">
        <dt>bolt utilisation</dt><dd>{{ r.boltUtilisation }}</dd>
      </div>
      <div class="results-item"><dt>u_face</dt><dd>{{ r.uFace }}</dd></div>
      <div class="results-item"><dt>u_support</dt><dd>{{ r.uSupport }}</dd></div>
      <div class="results-item"><dt>u_final</dt><dd>{{ r.uFinal }}</dd></div>
      <div class="results-item"><dt>p_eq</dt><dd>{{ r.pEq }}</dd></div>
      <div class="results-item"><dt>P_cr</dt><dd>{{ r.pCr }}</dd></div>
      <div class="results-item"><dt>R_p</dt><dd>{{ r.rP }}</dd></div>
      <div v-if="r.remainingYieldPath" class="results-item">
        <dt>remaining yield path</dt><dd>{{ r.remainingYieldPath }}</dd>
      </div>
      <div v-if="r.yielding.length" class="results-item">
        <dt>yielding</dt><dd>{{ r.yielding.join(', ') }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup>
defineProps({ r: { type: Object, required: true } })
</script>
