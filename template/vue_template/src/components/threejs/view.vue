<script lang="ts" setup>
import { onMounted, ref, reactive, onUnmounted } from 'vue'

//@ts-ignore
import * as THREE from "three";
//@ts-ignore
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
//@ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { gsap } from "gsap";
//@ts-ignore
import { Pane } from 'tweakpane'

// 自定义组件
import labelView from './labels/view.vue'
import { WallGeometry } from "./walls/WallGeometry";
import { FlowWallMaterial } from "./walls/FlowWallMaterial";

import * as current from "./index.services";
import * as db from "./datas";

// name
defineOptions({
  name: 'three-dashboard'
})

const emits = defineEmits<{
  (event: 'changed', values: any): void
}>()

const sceneInfos = reactive({
  debug: true,
  showHelpers: true, // 显示网格、辅助线
  //
  size: {
    width: 0,
    height: 0
  },
  camera: {
    position: [0, 0, 0],
    lookAt: [0, 0, 0],
  },
  // 场景是否已经准备好渲染（控制 label 渲染）
  renderReady: false,
  //
  timers: {
    camera: {
      isAuto: true,
      isMoving: false,
      duration: 5,
      moveDuration: 2,
      currentIndex: 0,
      timer: null as any,
    },
    agv: {
      duration: 10,
      currentIndex: 0,
    }
  }
})

const runViews = async () => {
  // 加载 HDR 环境光
  await current.loadExr(SCENE, "/docs/models/hdr/studio_small_02_1k.exr");

  // 加载工厂模型
  const model: any = await current.loadGLB("/docs/models/factory.glb");
  model.position.set(0, 0, 0)
  model.scale.set(6, 6, 6)
  SCENE.add(model);

  // 添加 3D 标签
  const label: any = await current.loadText('Factory', 1.5)
  label.position.set(0, 0, -15)
  SCENE.add(label);

  // 添加光墙
  const material = new FlowWallMaterial({ time: u_time });
  db.walls.forEach((wall: any) => {
    const wallMesh = new THREE.Mesh(
      new WallGeometry({
        points: wall,
        height: 3,
      }),
      material
    );
    SCENE.add(wallMesh);
  });

  // 添加 AGV
  const agv: any = await current.loadGLB("/docs/models/agv.glb");
  SCENE.add(agv);
  agv.position.set(...db.agvs[0].position)
  autoAGV(agv)

  // 道路
  db.roads.forEach((road: any) => {
    const { size, position, color } = road
    // 创建地面（白色 #fff）
    const geometry = new THREE.PlaneGeometry(size.width, size.height); // 指定大小，例如 10x10 的地面
    const material = new THREE.MeshBasicMaterial({ color }); // 设置颜色为 #fff
    const plane = new THREE.Mesh(geometry, material);
    geometry.translate(size.width / 2, size.height / 2, 0);
    // 调整地面的旋转角度，平放在XZ平面上
    plane.rotation.x = -Math.PI / 2;
    // 设置地面的位置
    plane.position.set(position[0], position[1], position[2]); // 指定地面的位置

    // 将地面添加到场景
    SCENE.add(plane);
  });

  // 镜头移动
  if (sceneInfos.timers.camera.isAuto) {
    sceneInfos.timers.camera.timer = setInterval(() => {
      sceneInfos.timers.camera.currentIndex = (sceneInfos.timers.camera.currentIndex + 1) % db.cameras.length
      let infos = db.cameras[sceneInfos.timers.camera.currentIndex]
      moveCameraTo(JSON.parse(JSON.stringify(infos)))
      //
      emits('changed', {
        action: 'camera',
        values: infos
      })
    }, sceneInfos.timers.camera.duration * 1000);
  }
}
const autoAGV = (agv: any) => {
  sceneInfos.timers.agv.currentIndex = (sceneInfos.timers.agv.currentIndex + 1) % db.agvs.length
  let point = db.agvs[sceneInfos.timers.agv.currentIndex]
  moveModelTo(agv, {
    position: point.position,
    duration: sceneInfos.timers.agv.duration,
  }, () => {
    emits('changed', {
      action: 'agv',
      values: point
    })
    //
    autoAGV(agv)
  })
}

const canvasRef: any = ref(null);
let RENDERER: any = null; // WebGL 渲染器
let RENDERER2D: any = null; // 2D 标签渲染器
let SCENE: any = null; // Three.js 场景
let CAMERA: any = null; // 相机
let CONTROLS: any = null; // 鼠标控制器

let axesHelper: THREE.AxesHelper | null = null
let gridHelper: THREE.GridHelper | null = null

// 用于光墙 动态材质时间参数
const u_time = ref<number>(0);

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    //
    sceneInfos.size = { width, height }
    canvas.width = width
    canvas.height = height
  }

  initial3D()

  if (boxRef.value) observer.observe(boxRef.value)
})
onUnmounted(() => {
  observer.disconnect()
  //
  if (PANE) {
    PANE.dispose()
    PANE = null
  }
  //
  if (sceneInfos.timers.camera.timer) {
    clearInterval(sceneInfos.timers.camera.timer)
    sceneInfos.timers.camera.timer = null
  }
})

// 自适应
const boxRef = ref<HTMLDivElement | null>(null)
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect
    console.log('[ThreeJS] size changed:', width, height)

    sceneInfos.size = { width, height }

    if (CAMERA) {
      CAMERA.aspect = width / height
      CAMERA.updateProjectionMatrix()
    }

    if (RENDERER) RENDERER.setSize(width, height)
    if (RENDERER2D) RENDERER2D.setSize(width, height)
  }
})

// 初始化 Three.js 场景
const initial3D = () => {
  sceneInfos.renderReady = false

  // WebGL渲染器 设置
  RENDERER = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
  });

  // 初始化 SCENE
  SCENE = new THREE.Scene();
  SCENE.background = new THREE.Color(0x00060c);

  // 光源
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
  directionalLight.position.set(400, 200, 300);
  // SCENE.add(directionalLight);
  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  // SCENE.add(ambient);

  const { width, height } = sceneInfos.size

  // 2D渲染器
  RENDERER2D = new CSS2DRenderer()
  RENDERER2D.setSize(width, height)
  //
  RENDERER2D.domElement.style.position = 'absolute'
  RENDERER2D.domElement.style.top = '0px'
  RENDERER2D.domElement.style.left = '0px'
  //
  RENDERER2D.domElement.style.pointerEvents = 'none'
  canvasRef.value.parentElement.appendChild(RENDERER2D.domElement)

  // 初始化 CAMERA 和 CONTROLS
  CAMERA = new THREE.PerspectiveCamera(
    30, // fov|视角大小
    width / height, // aspect|纵宽比
    1, // near|可见最近平面
    3000 // far|可见最远平面
  );
  CONTROLS = new OrbitControls(CAMERA, RENDERER.domElement);

  // 初始化 CAMERA 位置
  sceneInfos.camera = {
    position: [...db.cameras[0].position],
    lookAt: [...db.cameras[0].lookAt]
  }
  syncCameraPosition()

  sceneInfos.renderReady = true

  // 辅助线
  axesHelper = new THREE.AxesHelper(100)
  gridHelper = new THREE.GridHelper(200, 20)
  if (sceneInfos.showHelpers) {
    SCENE.add(axesHelper)
    SCENE.add(gridHelper)
  }

  if (sceneInfos.debug) {
    initialPane()
    //
    CONTROLS.addEventListener('change', () => {
      // 阻断回循环
      if (isSyncingCamera) return
      syncSceneInfosFromCamera()
    })
  }

  //
  runViews()

  // 渲染循环
  RENDERER.setSize(width, height);
  render();
};
const clock = new THREE.Clock();
const render = () => {
  u_time.value = clock.getElapsedTime();

  // 渲染
  RENDERER.render(SCENE, CAMERA);
  if (RENDERER2D.__labelUpdateCallbacks) {
    RENDERER2D.__labelUpdateCallbacks.forEach((fn: any) => fn())
  }
  RENDERER2D.render(SCENE, CAMERA)

  requestAnimationFrame(render);
};

// 移动相机
const moveCameraTo = (target: { position: number[]; lookAt: number[] }) => {
  if (!CAMERA) return;

  // 创建 timeline
  const tl = gsap.timeline({
    onStart: () => {
      if (CONTROLS) CONTROLS.enabled = false;
      //
      sceneInfos.timers.camera.isMoving = true;
    },
    onUpdate: () => {
      syncCameraPosition()
    },
    onComplete: () => {
      if (CONTROLS) {
        CONTROLS.enabled = true;
        CONTROLS.update();
      }
      //
      sceneInfos.timers.camera.isMoving = false;
    }
  });

  tl.to(sceneInfos.camera.position, {
    0: target.position[0],
    1: target.position[1],
    2: target.position[2],
    duration: sceneInfos.timers.camera.moveDuration,
    ease: "power1.inOut",
    onUpdate: () => {
    }
  }, 0);
  tl.to(sceneInfos.camera.lookAt, {
    0: target.lookAt[0],
    1: target.lookAt[1],
    2: target.lookAt[2],
    duration: sceneInfos.timers.camera.moveDuration,
    ease: "power1.inOut",
    onUpdate: () => {
    }
  }, 0);
}
// 移动物体
const moveModelTo = (model: any, moveTo: { position: number[], duration: number }, complete: Function) => {
  gsap.to(model.position, {
    x: moveTo.position[0],
    y: moveTo.position[1],
    z: moveTo.position[2],
    duration: moveTo.duration,
    onUpdate: () => { },
    onComplete: () => {
      complete()
    },
  });
}

// 控制面板
let PANE: any = null;
const initialPane = () => {
  PANE = new Pane()
  PANE.element.style.position = 'absolute'
  PANE.element.style.top = '70px'
  PANE.element.style.right = '10px'
  PANE.element.style.zIndex = '1000'
  //
  const helperFolder = PANE.addFolder({ title: 'Helpers' })
  helperFolder.addBinding(sceneInfos, 'showHelpers', { label: 'Axes/Grid' }).on('change', (value: any) => {
    if (!axesHelper || !gridHelper) return

    if (value.value) { SCENE.add(axesHelper); SCENE.add(gridHelper); }
    else { SCENE.remove(axesHelper); SCENE.remove(gridHelper); }
  })
  // 相机位置调试
  const cameraFolder = PANE.addFolder({ title: 'Camera' })
  cameraFolder.addBinding(sceneInfos.camera.position, '0', { label: 'x', min: -200, max: 200 }).on('change', syncCameraPosition)
  cameraFolder.addBinding(sceneInfos.camera.position, '1', { label: 'y', min: -200, max: 200 }).on('change', syncCameraPosition)
  cameraFolder.addBinding(sceneInfos.camera.position, '2', { label: 'z', min: -200, max: 200 }).on('change', syncCameraPosition)
  cameraFolder.addBinding(sceneInfos.camera.lookAt, '0', { label: 'lookX', min: -200, max: 200 }).on('change', syncCameraPosition)
  cameraFolder.addBinding(sceneInfos.camera.lookAt, '1', { label: 'lookY', min: -200, max: 200 }).on('change', syncCameraPosition)
  cameraFolder.addBinding(sceneInfos.camera.lookAt, '2', { label: 'lookZ', min: -200, max: 200 }).on('change', syncCameraPosition)
}
//
const syncSceneInfosFromCamera = () => {
  const pos = CAMERA.position
  const target = CONTROLS.target

  sceneInfos.camera.position[0] = pos.x
  sceneInfos.camera.position[1] = pos.y
  sceneInfos.camera.position[2] = pos.z

  sceneInfos.camera.lookAt[0] = target.x
  sceneInfos.camera.lookAt[1] = target.y
  sceneInfos.camera.lookAt[2] = target.z

  // 选配：刷新 tweakpane（防止只在 init 时绑定）
  PANE.refresh()
}
let isSyncingCamera = false
const syncCameraPosition = () => {
  if (CAMERA) {
    isSyncingCamera = true

    const { position, lookAt } = sceneInfos.camera

    const [x, y, z] = position
    CAMERA.position.set(x, y, z)

    if (CONTROLS) {
      const [lx, ly, lz] = lookAt
      CONTROLS.target.set(lx, ly, lz)
      CONTROLS.update()
    }

    CAMERA.updateProjectionMatrix()

    isSyncingCamera = false
  }
}
</script>

<template>
  <div class="box-three" ref="boxRef">
    <canvas id="canvas" ref="canvasRef"></canvas>
    <labelView v-if="sceneInfos.renderReady" v-for="(label, idx) in db.labels" :key="idx" :scene="SCENE"
      :renderer2D="RENDERER2D" :camera="CAMERA" :position="new THREE.Vector3(...label.position)" :infos="label.infos" />
  </div>
</template>

<style scoped lang="scss">
.box-three {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
}
</style>
