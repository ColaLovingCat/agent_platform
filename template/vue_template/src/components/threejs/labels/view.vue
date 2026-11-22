<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

const props = defineProps<{
    scene: THREE.Scene
    renderer2D: any
    camera: THREE.Camera
    position: THREE.Vector3
    infos: any
}>()

const labelDiv = ref<HTMLDivElement | null>(null)
let labelObject: CSS2DObject | null = null
let line: THREE.Line | null = null

const updateLabel = () => {
    if (!props.camera || !labelObject || !line) return

    // 计算相机前方一定距离的位置作为 label 的位置
    const direction = new THREE.Vector3()
    props.camera.getWorldDirection(direction)

    const labelPosition = props.position.clone().add(direction.multiplyScalar(15))
    labelObject.position.copy(labelPosition)

    // 更新折线 geometry
    const positions = line.geometry.attributes.position.array as Float32Array
    positions[0] = props.position.x
    positions[1] = props.position.y
    positions[2] = props.position.z
    positions[3] = labelPosition.x
    positions[4] = labelPosition.y
    positions[5] = labelPosition.z
    line.geometry.attributes.position.needsUpdate = true
}

onMounted(() => {
    // 构建 HTML 元素
    const div = document.createElement('div')
    div.className = 'label-content'
    div.textContent = props.infos.content
    Object.assign(div.style, {
        padding: '4px 8px',
        background: '#fff',
        color: '#000',
        borderRadius: '4px',
        fontSize: '12px',
        whiteSpace: 'nowrap',
    })
    labelObject = new CSS2DObject(div)
    labelDiv.value = div

    // 设置初始位置
    updateLabel()

    // 添加标签到 scene
    props.scene.add(labelObject)

    // 添加折线
    const geometry = new THREE.BufferGeometry()
    const points = new Float32Array(6) // 起点到终点
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3))

    const material = new THREE.LineBasicMaterial({ color: 0xffffff })
    line = new THREE.Line(geometry, material)
    props.scene.add(line)

    // 注册渲染时更新
    props.renderer2D.__labelUpdateCallbacks ??= []
    props.renderer2D.__labelUpdateCallbacks.push(updateLabel)
})

onUnmounted(() => {
    labelObject && props.scene.remove(labelObject)
    line && props.scene.remove(line)

    if (props.renderer2D.__labelUpdateCallbacks) {
        props.renderer2D.__labelUpdateCallbacks =
            props.renderer2D.__labelUpdateCallbacks.filter((fn: any) => fn !== updateLabel)
    }
})
</script>

<template>
    <!-- Label 渲染在 threejs 场景中 -->
</template>

<style scoped></style>
