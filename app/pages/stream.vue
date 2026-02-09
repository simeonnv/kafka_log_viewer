<script setup lang="ts">
import { shallowRef, ref, computed, triggerRef } from 'vue'

definePageMeta({
    layout: 'sidebar',
})

const MAX_LOG_COUNT = 200; 
const logs = ref<any[]>([]);
const filterQuery = ref('');
const isPaused = ref(false);

const { status, send } = useWebSocket('/kafka', { 
    autoReconnect: true,
    immediate: true,
    onConnected(ws) {
        console.log('Connected to ws!')
        send("harvester_logs")
    }, 
    onMessage(ws, event) {
        if (isPaused.value) return;

        let msg = event.data;
        if (!msg || msg.trim() === "") return;
        
        try {
            let json = JSON.parse(msg);
            
            Object.freeze(json);

            const currentLogs = logs.value;
            currentLogs.unshift(json);

            if (currentLogs.length > MAX_LOG_COUNT) {
                currentLogs.length = MAX_LOG_COUNT;
            }

            triggerRef(logs);
        } catch (e) {
            console.error("JSON Parse error", e);
        }
    },
})

const getValueByPath = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const filteredLogs = computed(() => {
    const rawQuery = filterQuery.value.trim();
    
    if (!rawQuery) return logs.value;

    const terms = rawQuery.split(/\s+/);
    const fieldFilters: { key: string, value: string }[] = [];
    const searchTerms: string[] = [];

    terms.forEach(term => {
        if (term.includes(':')) {
            const [key, val] = term.split(':');
            if (key && val) {
                fieldFilters.push({ key, value: val.toLowerCase() });
            } else {
                searchTerms.push(term.toLowerCase());
            }
        } else {
            searchTerms.push(term.toLowerCase());
        }
    });

    return logs.value.filter(log => {
        const matchesFields = fieldFilters.every(({ key, value }) => {
            const logVal = getValueByPath(log, key);
            if (logVal === undefined || logVal === null) return false;
            return String(logVal).toLowerCase().includes(value);
        });

        if (!matchesFields) return false;

        if (searchTerms.length > 0) {
            const logString = JSON.stringify(log).toLowerCase();
            return searchTerms.every(term => logString.includes(term));
        }

        return true;
    });
});
</script>

<template>
    <ClientOnly>
        <div class="p-4 flex flex-col h-screen">
            <div class="w-full mb-4 border-b p-4 rounded-xl bg-base-100 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <p class="font-bold text-lg">Realtime Log Streaming</p>
                    <div class="flex items-center gap-2">
                         <div class="badge gap-2">
                            Status: 
                            <span class="badge badge-sm" 
                            :class="status === 'OPEN' ? 'badge-info' : 'badge-error'">
                                {{ status }}
                            </span>
                        </div>
                        <span class="text-xs opacity-50">
                            Showing {{ filteredLogs.length }} events
                        </span>
                    </div>
                </div>

                <div class="flex gap-2">
                    <input 
                        v-model="filterQuery"
                        type="text" 
                        placeholder="Filter: 'level:error service:api timeout'" 
                        class="input input-bordered input-sm w-full max-w-md font-mono"
                    />
                    <button 
                        @click="logs = []" 
                        class="btn btn-sm btn-ghost text-error"
                    >
                        Clear
                    </button>
                    <button 
                        @click="isPaused = !isPaused" 
                        class="btn btn-sm"
                        :class="isPaused ? 'btn-warning' : 'btn-ghost'"
                    >
                        {{ isPaused ? 'Resume' : 'Pause' }}
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2 pb-8">
                <div v-for="(log, i) in filteredLogs" :key="i" class="card bg-base-200 shadow-sm p-2 text-sm">
                    <div class="flex flex-row items-start gap-4">
                        <span class="font-mono opacity-50 text-xs mt-1 min-w-8">
                            #{{ filteredLogs.length - i }}
                        </span>
                        <div class="flex-1 overflow-x-auto" v-memo="[log]">
                            <JsonTree :data="log" />
                        </div>
                    </div>
                </div>

                <div v-if="filteredLogs.length === 0" class="text-center opacity-50 mt-10">
                    No logs found matching filter.
                </div>
            </div>
        </div>

        <template #fallback>
            <p>Loading logs...</p>
        </template>
    </ClientOnly>
</template>