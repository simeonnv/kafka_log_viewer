<script setup lang="ts">
    let route = useRoute()
</script>

<template>
    <div class="flex flex-row h-screen">
        <div class="h-full border-r border-dashed rounded-r-xl py-2 px-4 flex flex-col gap-4 card">
            <h1 class="text-center align-middle items-center pt-6 font-bold text-xl">logs</h1>
            
            <div class="divider p-0 m-0"/>

            <NuxtLink to="/stream">
                <button class="btn btn-ghost py-8 w-32" :class="route.path == '/stream' ? 'btn-active' : ''">
                    <Icon name="streamline-flex:link-chain-solid" size="32"/>
                    <p>Realtime streaming</p>
                </button>
            </NuxtLink>
            
            <NuxtLink to="/database">
                <button class="btn btn-ghost py-8 w-32" :class="route.path == '/database' ? 'btn-active' : '' ">
                    <Icon name="material-symbols:database" size="32"/>
                    <p>Log database</p>
                </button>
            </NuxtLink>
        </div>
        <div class="w-full h-screen">

          <slot />

        </div>
    </div>
</template>