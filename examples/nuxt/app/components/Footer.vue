<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const pathname = computed(() => route.path)
</script>

<template>
  <footer class="row-start-3 flex gap-6 flex-wrap items-center justify-center">
    <NuxtLink class="flex items-center gap-2 hover:underline hover:underline-offset-4"
      :to="pathname === '/' ? '/user' : '/'">
      <img aria-hidden src="/file.svg" alt="File icon" width="16" height="16" />
      {{ pathname === '/' ? 'User' : 'Home' }}
    </NuxtLink>

    <!-- external is attribute required to hit the trigger middleware -->
    <NuxtLink external class="flex items-center gap-2 hover:underline hover:underline-offset-4" href="/admin/data">
      <img aria-hidden src="/window.svg" alt="Window icon" width="16" height="16" />
      Admin
    </NuxtLink>

    <a class="flex items-center gap-2 hover:underline hover:underline-offset-4" href="https://bknd.io" target="_blank"
      rel="noopener noreferrer">
      <img aria-hidden src="/globe.svg" alt="Globe icon" width="16" height="16" />
      Go to bknd.io →
    </a>
  </footer>
</template>
