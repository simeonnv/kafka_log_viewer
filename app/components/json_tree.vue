<script setup>
    const { data } = defineProps(['data']);
    console.log(typeof data)
</script>

<template>
  <ul class="ml-4 border-y rounded-r-md p-2 m-2">
    <li v-for="(value, key) in data" :key="key" class="">
      <strong class="badge badge-primary mr-4 text-wrap">{{ key }}:</strong>
      
      <JsonTree 
        v-if="typeof value === 'object' && value !== null" 
        :data="value" 
      />
      
      <span v-else class="badge badge-soft badge-primary text-wrap"> {{ value }}</span>
    </li>
  </ul>
</template>
