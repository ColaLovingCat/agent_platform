<script setup lang="ts">
import { ref } from 'vue';

const category = ref('blueprint')
</script>

<template>
    <div class="btns">
        <a-radio-group v-model:value="category">
            <a-radio value="blueprint">数字蓝图</a-radio>
            <a-radio value="mesh">流光星云</a-radio>
            <a-radio value="kinetic">极速起航</a-radio>
            <a-radio value="ide">精密代码空间</a-radio>
            <a-radio value="glass">层级玻璃</a-radio>
        </a-radio-group>
    </div>

    <div class="bg-blueprint" v-if="category == 'blueprint'">
        <div class="glow-sphere"></div>

        <div class="content-slot">
        </div>
    </div>

    <div class="bg-mesh" v-if="category == 'mesh'">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <div class="glass-overlay"></div>

        <div class="content-slot">
        </div>
    </div>

    <div class="bg-kinetic" v-if="category == 'kinetic'">
        <div v-for="i in 20" :key="i" :class="['speed-line', `line-${i}`]"></div>

        <div class="content-slot">
        </div>
    </div>

    <div class="bg-ide" v-if="category == 'ide'">
        <div class="neon-glow"></div>

        <div class="floating-code code-1">
            <pre>
/** 
 * Engineering Change Management 
 * Next-gen Platform 
 */
        </pre>
        </div>
        <div class="floating-code code-2">
            <pre>const liftoff = (ide) => ide.boost();</pre>
        </div>

        <div class="content-slot">
        </div>
    </div>

    <div class="bg-glass" v-if="category == 'glass'">
        <div class="glass-card card-1"></div>
        <div class="glass-card card-2"></div>
        <div class="glass-card card-3"></div>

        <div class="content-slot">
        </div>
    </div>
</template>

<style scoped lang="scss">
.btns {
    position: fixed;
    top: 90px;
    left: 20px;
    z-index: 999;
}

.bg-blueprint {
    width: 100%;
    height: 100%;
    background-color: #f8fafc;
    background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
    background-size: 32px 32px;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    &::before {
        content: "";
        position: absolute;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at 80% 20%, rgba(0, 123, 192, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(0, 123, 192, 0.03) 0%, transparent 50%);
        pointer-events: none;
    }

    .glow-sphere {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(0, 123, 192, 0.08) 0%, transparent 70%);
        filter: blur(50px);
        animation: pulse 8s infinite ease-in-out;
    }
}

@keyframes pulse {

    0%,
    100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.5;
    }

    50% {
        transform: translate(-50%, -50%) scale(1.2);
        opacity: 0.8;
    }
}

.bg-mesh {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: #ffffff;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.4;
        z-index: 1;
    }

    /* 博世蓝调色盘 */
    .orb-1 {
        width: 500px;
        height: 500px;
        background: #007bc0;
        top: -100px;
        right: -100px;
        animation: move 20s infinite alternate;
    }

    .orb-2 {
        width: 400px;
        height: 400px;
        background: #005a8c;
        bottom: -50px;
        left: -50px;
        animation: move 15s infinite alternate-reverse;
    }

    .orb-3 {
        width: 300px;
        height: 300px;
        background: #52c41a; // 注入一点成功的绿色
        top: 40%;
        left: 30%;
        opacity: 0.15;
        animation: move 25s infinite linear;
    }

    /* 玻璃感覆盖层：增加噪点纹理，提升高级感 */
    .glass-overlay {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(120px); // 极高的模糊值形成丝绸感
        z-index: 2;

        // 模拟微弱的纸张/胶片噪点
        &::after {
            content: "";
            position: absolute;
            inset: 0;
            opacity: 0.03;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
    }

    .content-slot {
        position: relative;
        z-index: 10;
    }
}

@keyframes move {
    from {
        transform: translate(0, 0) rotate(0deg);
    }

    to {
        transform: translate(100px, 50px) rotate(30deg);
    }
}

.bg-kinetic {
    width: 100%;
    height: 100%;
    background: #0f172a; // 深蓝色底
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;

    /* 背景斜线流光 */
    .speed-line {
        position: absolute;
        width: 2px;
        height: 100px;
        background: linear-gradient(to bottom, transparent, #007bc0, transparent);
        opacity: 0.3;
        animation: moveDown 3s linear infinite;
    }

    /* 制造 20 条随机分布的流光 */
    @for $i from 1 through 20 {
        .line-#{$i} {
            left: random(100) + vw;
            top: -100px;
            animation-delay: random(5) + s;
            animation-duration: (random(20) / 10 + 1) + s;
        }
    }

    /* 底部发光 */
    &::after {
        content: "";
        position: absolute;
        bottom: 0;
        width: 100%;
        height: 30%;
        background: linear-gradient(to top, rgba(0, 123, 192, 0.2), transparent);
    }
}

@keyframes moveDown {
    to {
        transform: translateY(110vh);
    }
}

.bg-ide {
    width: 100%;
    height: 100%;
    background-color: #121212;
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px; // 网格大小
    position: relative;

    /* 模拟 IDE 侧边栏的装饰线 */
    &::before {
        content: "";
        position: absolute;
        left: 60px;
        top: 0;
        bottom: 0;
        width: 1px;
        background: rgba(0, 123, 192, 0.3);
    }

    /* 漂浮的虚构代码片段 */
    .floating-code {
        position: absolute;
        font-family: 'Monaco', monospace;
        font-size: 10px;
        color: rgba(0, 123, 192, 0.2);
        user-select: none;
        pointer-events: none;

        &.code-1 {
            top: 20%;
            right: 10%;
        }

        &.code-2 {
            bottom: 15%;
            left: 15%;
        }
    }

    /* 霓虹角落光 */
    .neon-glow {
        position: absolute;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(0, 123, 192, 0.15) 0%, transparent 70%);
        top: -100px;
        left: -100px;
        filter: blur(40px);
    }
}

.bg-glass {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%);
    overflow: hidden;
    position: relative;

    .glass-card {
        position: absolute;
        background: rgba(255, 255, 255, 0.4);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 20px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
        animation: float 10s infinite ease-in-out;
    }

    .card-1 {
        width: 300px;
        height: 180px;
        top: 15%;
        right: 10%;
        animation-delay: 0s;
    }

    .card-2 {
        width: 200px;
        height: 200px;
        bottom: 10%;
        left: 5%;
        animation-delay: -2s;
    }

    .card-3 {
        width: 150px;
        height: 150px;
        top: 40%;
        right: 40%;
        animation-delay: -5s;
        opacity: 0.5;
    }

    /* 这种背景下，打字机文字可以用深灰色，显得很高级 */
    :deep(.dynamic-text) {
        background: linear-gradient(to right, #1a202c, #4a5568);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
}

@keyframes float {

    0%,
    100% {
        transform: translateY(0) rotate(0deg);
    }

    50% {
        transform: translateY(-20px) rotate(2deg);
    }
}
</style>