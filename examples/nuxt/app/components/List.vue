<script lang="ts" setup>
const props = withDefaults(defineProps<{ items?: any[] }>(), { items: () => [] })

function isPrimitive(val: unknown): boolean {
  const t = typeof val
  return t === 'string' || t === 'number' || t === 'boolean'
}
</script>

<template>
  <ol class="list-inside list-decimal text-sm text-center sm:text-left w-full text-center">
    <li
      v-for="(item, i) in props.items"
      :key="i"
      :class="{ 'mb-2': i < props.items.length - 1 }"
    >
      <span v-if="isPrimitive(item)">{{ item }}</span>
      <component v-else :is="item" />
    </li>
  </ol>
</template>