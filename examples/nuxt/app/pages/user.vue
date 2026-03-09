<script lang="ts" setup>
const { getUser } = useUser();
const { data, status: userStatus, execute } = await useAsyncData("user", () => getUser());

onMounted(() => {
  execute();
});

</script>

<template>
  <div 
    v-if="userStatus !== 'pending'"
    className="flex flex-col items-center justify-center min-h-screen p-8 pb-20 gap-16 sm:p-20"
  >
    <main className="flex flex-col gap-8 row-start-2 justify-center items-center sm:items-start">
      <div class="flex flex-row items-center ">
        <img class="dark:invert size-24" src="/nuxt.svg" alt="Nuxt logo" />
        <div class="ml-3.5 mr-2 font-mono opacity-70">&amp;</div>
        <img class="dark:invert" src="/bknd.svg" alt="bknd logo" width="183" height="59" />
      </div>
      <div v-if="data?.user">
        Logged in as {{ data.user.email }}.
        <a className="font-medium underline" href='/api/auth/logout'>
          Logout
        </a>
      </div>
      <div v-else className="flex flex-col gap-1">
        <p>
          Not logged in.
          <a className="font-medium underline" href="/admin/auth/login">
            Login
          </a>
        </p>
        <p className="text-xs opacity-50">
          Sign in with:
          <b>
            <code>test@bknd.io</code>
          </b>
          /
          <b>
            <code>12345678</code>
          </b>
        </p>
      </div>
    </main>
    <Footer />
  </div>
</template>