<script setup lang="ts">
import { ref, computed, triggerRef } from 'vue'

definePageMeta({
    layout: 'sidebar',
})

const MAX_LOG_COUNT = 200; 
const logs = ref<any[]>([]);
const filterQuery = ref('');
const isPaused = ref(false);

const sortKey = ref('');
const sortDesc = ref(true);

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
            
            Object.defineProperty(json, '__arrival', { value: Date.now(), enumerable: false });
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
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const getHighlightedSnippet = (obj: any, searchTerms: string[]): string | null => {
    if (!searchTerms.length) return null;

    const highlight = (text: string) => {
        let res = text;
        searchTerms.forEach(term => {
            if (!term) return;
            const regex = new RegExp(`(${term})`, 'gi');
            res = res.replace(regex, '<mark class="bg-yellow-200 text-black rounded-sm px-0.5">$1</mark>');
        });
        return res;
    };

    const stack = [{ path: '', value: obj }];
    
    while (stack.length > 0) {
        const { path, value } = stack.pop()!;

        if (value && typeof value === 'object') {
            for (const key in value) {
                stack.push({ path: path ? `${path}.${key}` : key, value: value[key] });
            }
        } else if (typeof value === 'string' || typeof value === 'number') {
            const strVal = String(value).toLowerCase();
            const hasMatch = searchTerms.some(term => strVal.includes(term));
            
            if (hasMatch) {
                return `<span class="font-bold text-xs opacity-70">${path}:</span> ${highlight(String(value))}`;
            }
        }
    }
    return null;
};


const processedLogs = computed(() => {
    let result = [...logs.value];
    const rawQuery = filterQuery.value.trim();

    if (rawQuery) {
        const terms = rawQuery.split(/\s+/);
        const fieldFilters: { key: string, value: string }[] = [];
        const searchTerms: string[] = [];

        terms.forEach(term => {
            if (term.includes(':')) {
                const [key, val] = term.split(':');
                if (key && val) fieldFilters.push({ key, value: val.toLowerCase() });
                else searchTerms.push(term.toLowerCase());
            } else {
                searchTerms.push(term.toLowerCase());
            }
        });

        result = result.filter(log => {
            const matchesFields = fieldFilters.every(({ key, value }) => {
                const logVal = getValueByPath(log, key);
                return logVal !== undefined && String(logVal).toLowerCase().includes(value);
            });
            if (!matchesFields) return false;

            if (searchTerms.length > 0) {
                const logString = JSON.stringify(log).toLowerCase();
                return searchTerms.every(term => logString.includes(term));
            }
            return true;
        });
    }

    result.sort((a, b) => {
        let valA, valB;

        if (sortKey.value) {
            valA = getValueByPath(a, sortKey.value);
            valB = getValueByPath(b, sortKey.value);
        } else {
            return sortDesc.value ? 0 : -1; // Keep array as is
        }

        if (valA === valB) return 0;
        
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;

        if (valA < valB) return sortDesc.value ? 1 : -1;
        if (valA > valB) return sortDesc.value ? -1 : 1;
        return 0;
    });

    if (!sortKey.value && !sortDesc.value) {
        result.reverse();
    }

    return result;
});

const activeSearchTerms = computed(() => {
    return filterQuery.value.split(/\s+/).filter(t => !t.includes(':') && t.trim() !== '').map(t => t.toLowerCase());
});
</script>

<template>
    <ClientOnly>
        <div class="p-4 flex flex-col h-screen">
            <div class="w-full mb-4 border-b p-4 rounded-xl bg-base-100 shadow-sm space-y-4">
                <div class="flex justify-between items-center">
                    <p class="font-bold text-lg">Realtime Log Streaming</p>
                    <div class="flex items-center gap-2">
                         <div class="badge gap-2">
                            Status: 
                            <span class="badge badge-sm" :class="status === 'OPEN' ? 'badge-info' : 'badge-error'">
                                {{ status }}
                            </span>
                        </div>
                        <span class="text-xs opacity-50">
                            Showing {{ processedLogs.length }} events
                        </span>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2 items-center">
                    <div class="join flex-1 min-w-2">
                        <input 
                            v-model="filterQuery"
                            type="text" 
                            placeholder="Filter: 'level:error service:api timeout'" 
                            class="input input-bordered input-sm join-item w-full font-mono"
                        />
                        <button v-if="filterQuery" @click="filterQuery = ''" class="btn btn-sm join-item">✕</button>
                    </div>

                    <div class="flex items-center gap-1 bg-base-200 rounded-lg p-1">
                        <span class="text-xs px-2 opacity-50">Sort by:</span>
                        <input 
                            v-model="sortKey" 
                            type="text" 
                            placeholder="Arrival (Default)" 
                            class="input input-xs input-ghost w-24 focus:bg-white"
                        />
                        <button 
                            @click="sortDesc = !sortDesc" 
                            class="btn btn-xs btn-ghost"
                            :title="sortDesc ? 'Descending (9-0)' : 'Ascending (0-9)'"
                        >
                            {{ sortDesc ? '⬇' : '⬆' }}
                        </button>
                    </div>

                    <div class="divider divider-horizontal m-0"></div>

                    <button @click="logs = []" class="btn btn-sm btn-ghost text-error">Clear</button>
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
                <div v-for="(log, i) in processedLogs" :key="i" class="card bg-base-200 shadow-sm p-2 text-sm hover:bg-base-300/60 transition-all">
                    <div class="flex flex-col gap-2">
                        
                        <div 
                            v-if="filterQuery && activeSearchTerms.length" 
                            class="bg-base-100 p-1.5 rounded text-xs font-mono break-all border border-base-300 mx-8"
                            v-html="getHighlightedSnippet(log, activeSearchTerms) || 'Match found in object structure'"
                        >
                        </div>

                        <div class="flex flex-row items-start gap-4">
                            <span class="font-mono opacity-30 text-xs mt-1 min-w-8 select-none">
                                #{{ i + 1 }}
                            </span>
                            
                            <div class="flex-1 overflow-x-auto" v-memo="[log]">
                                <JsonTree :data="log" />
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="processedLogs.length === 0" class="text-center opacity-50 mt-10">
                    No logs found.
                </div>
            </div>
        </div>

        <template #fallback>
            <p>Loading logs...</p>
        </template>
    </ClientOnly>
</template>