<script setup lang="ts">
import { ref } from "vue"
import Window from "./window.vue"

const apps = ref([
    { id: 1, name: "Notes", icon: "/icons/note.png", component: "NotesApp" },
    { id: 2, name: "Browser", icon: "/icons/browser.png", component: "BrowserApp" },
])

const dockApps = ref([
    { id: 1, name: "Notes", icon: "/icons/note.png", component: "NotesApp" },
])

const windows = ref<any[]>([])

function openApp(app: any) {
    // 防止重复打开
    if (!windows.value.find(w => w.id === app.id)) {
        windows.value.push({ ...app })
    }
}

function closeApp(id: number) {
    windows.value = windows.value.filter(w => w.id !== id)
}
</script>

<template>
    <div class="box-desktop h-[calc(100vh-70px)] relative overflow-hidden">
        <!-- Widgets -->
        <div class="desktop-widgets w-full">

        </div>

        <!-- 桌面图标 -->
        <div class="desktop-main p-4 flex gap-6">
            <div v-for="app in apps" :key="app.id" class="app-item flex flex-col items-center cursor-pointer"
                @dblclick="openApp(app)">
                <img :src="app.icon" class="w-12 h-12" />
                <span class="text-xs mt-1">{{ app.name }}</span>
            </div>
        </div>

        <!-- Docker -->
        <div class="desktop-docker flex gap-4 px-4 py-2 bg-white/70 backdrop-blur-md rounded-xl shadow-lg">
            <div v-for="dockApp in dockApps" :key="dockApp.id" class="app-item flex flex-col items-center cursor-pointer"
                @click="openApp(dockApp)">
                <img :src="dockApp.icon" class="w-10 h-10 transition-transform hover:scale-110" />
            </div>
        </div>

        <!-- 窗口层 -->
        <div v-for="win in windows" :key="win.id">
            <Window :title="win.name" :component="win.component" @close="closeApp(win.id)" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.box-desktop {
    display: flex;
    flex-direction: column;

    .desktop-widgets {
        height: 30px;
        background: var(--color-black);
    }

    .desktop-main {
        flex: 1;
    }

    .desktop-docker {
        margin: 0 auto;
        height: 60px;
    }

    .app-item {
        width: 80px;
        height: 80px;
    }
}
</style>
