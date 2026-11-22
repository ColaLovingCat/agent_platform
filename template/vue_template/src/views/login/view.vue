<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'

import { useSystemInfosStore } from '@/commons/stores/index'
const systemInfosStore = useSystemInfosStore()
import { useLoadingStore } from '@/commons/stores/index'
const loadingStore = useLoadingStore()

import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import eventBus from '@/commons/utils/eventBus'
import * as extend from '@/commons/utils/extends'
import * as messages from '@/commons/utils/messages'

import * as current from '@/services/login.services'
import * as users from '@/services/users.services'

onMounted(async () => {
  // 背景
  if (canvas.value) {
    ctx = canvas.value.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    if (activeDynamic) {
      animate();
    }
  }
  // 回车触发登录
  window.addEventListener('keydown', onKeyDown)
  // 记住用户名
  let remember = JSON.parse(extend.ExLocalStore.get('remember'))
  if (remember && remember.remember) {
    loginForm.account = remember.account
    loginForm.remember = remember.remember
  }
  // 跳转
  let params = extend.ExWeb.params()
  pageInfos.type = params.type
  if (params.type) {
    switch (params.type) {
      case 'logout': {
        eventBus.emit('clearSystem')
        break
      }
      case 'jump': {
        pageInfos.path = params.path
        loginSSO()
        break
      }
      default: {
        break
      }
    }
  }
})
onUnmounted(() => {
  systemInfosStore.setHeader(true)
  //
  window.removeEventListener('keydown', onKeyDown)
})

const onKeyDown = (event: any) => {
  if (event.keyCode == 13) {
    login()
  }
}

//#region Background
const activeDynamic = false
const canvas: any = ref(null)
let ctx: any = null
//
let circles: any[] = []
const colors = ['#836fff', '#15f5ba', '#692ff']
//
const initialCircle = () => {
  circles = []
  //
  const circleCount = Math.floor(window.innerWidth / 100);
  for (let loop = 0; loop < circleCount; loop++) {
    let radius = window.innerWidth / 4
    let x = extend.ExNumber.createRand(radius, canvas.value.width - radius)
    let y = extend.ExNumber.createRand(radius, canvas.value.height - radius)
    let dx = extend.ExNumber.createRand(window.innerWidth / -2000, window.innerWidth / 2000)
    let dy = extend.ExNumber.createRand(window.innerWidth / -2000, window.innerWidth / 2000)
    //
    let color = colors[Math.floor(Math.random() * colors.length)]
    circles.push({ x, y, dx, dy, radius, color })
  }
}
const drawCircle = (circle: any) => {
  if (!ctx) return;
  //
  ctx.beginPath()
  ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2, false)
  ctx.fillStyle = circle.color
  ctx.fill()
  ctx.closePath()
}
const animate = () => {
  if (!ctx) return;
  //
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  //
  circles.map((circle: any) => {
    if (circle.x + circle.radius > canvas.value.width || circle.x - circle.radius < 0) {
      circle.dx = -circle.dx
    }
    if (circle.y + circle.radius > canvas.value.height || circle.y - circle.radius < 0) {
      circle.dy = -circle.dy
    }
    //
    circle.x += circle.dx
    circle.y += circle.dy
    //
    drawCircle(circle)
  })
  requestAnimationFrame(animate)
}
const resizeCanvas = () => {
  if (!canvas.value) return;
  //
  canvas.value.width = window.innerWidth * 1.5
  canvas.value.height = window.innerHeight * 1.5
  //
  initialCircle()
}
//#endregion

// 用于直接跳转到指定页面
const pageInfos = reactive({
  type: '',
  path: ''
})

const isLogin = ref(true);
// Login
const loginForm = reactive({
  account: '',
  password: '',
  remember: false
})
const login = () => {
  loadingStore.loading()
  //
  extend.ExLocalStore.set(
    'remember',
    JSON.stringify({
      remember: loginForm.remember,
      account: loginForm.account
    })
  )
  //
  switch (systemInfosStore.infos.loginMode) {
    case 'sso-local': {
      const params = {
        account: loginForm.account,
        password: loginForm.password
      }
      current.login(params).then(
        (resp: any) => {
          loadingStore.end()
          //
          const { status, message } = resp
          if (status) {
            eventBus.emit('getinfosUser')
            //
            eventBus.emit('jumpHome')
          } else {
            messages.showError(message)
          }
        },
        (err: any) => {
          loadingStore.end()
          //
          messages.showError(err)
        }
      )
      break
    }
    case 'sso-iuser': {
      let params = {
        account: loginForm.account,
        password: loginForm.password
      }
      current.loginiUser(params).then(
        (resp: any) => {
          loadingStore.end()
          //
          const { status, message } = resp
          if (status) {
            eventBus.emit('getinfosUser')
            //
            eventBus.emit('jumpHome')
          } else {
            messages.showError(message)
          }
        },
        (err: any) => {
          loadingStore.end()
          //
          messages.showError(err)
        }
      )
      break
    }
    default: {
      break
    }
  }
}
const loginSSO = () => {
  const redirect_uri = extend.ExWeb.url().server + '/sso-auth'
  const { host, client_id, scope, response_type } = systemInfosStore.infos.azureConfigs
  let params = {
    client_id,
    scope,
    response_type,
    redirect_uri,
    state: ''
  }
  if (pageInfos.type == 'jump') {
    params.state = encodeURIComponent(btoa(pageInfos.path))
  }
  let url = `${host}?` + extend.ExObject.stringifyParams(params)
  window.open(url, '_self')
}
// Register
const registerForm = reactive({
  userno: '',
  ntAccount: '',
  username: '',
  department: '',
  email: '',
  password: '',
  confirm: ''
});
const register = async () => {
  const { password, confirm } = registerForm;

  const vaild = current.checkPassword(password, confirm)
  if (vaild == -1) {
    messages.showError(t("message.password.notmatch"))
    return;
  }
  if (vaild == -2) {
    messages.showError(t("message.password.notcom"))
    return;
  }

  const params = {
    ...registerForm,
    id: "",
    status: 1,
    avatar: "",
    roleIDs: [],
  }
  let resp: any = await users.saveUser(params)
  const { status, result } = resp;
  if (status) {
    isLogin.value = true
  }
};
</script>

<template>
  <div class="contents">
    <div class="box-contents">
      <div class="col-left">
        <div class="box-img">
          <div class="login-titles">
            <p>
              Login to <br />
              Open the World
            </p>
          </div>
        </div>
        <div class="bg-img">
          <!-- <img src="/docs/imgs/earth.jpg" alt="" srcset=""> -->
        </div>
      </div>
      <div class="col-right">
        <div class="box-login">
          <div class="titles">{{ systemInfosStore.infos.name }}</div>

          <!-- SSO表单 -->
          <div class="box-sso" v-if="systemInfosStore.infos.loginMode == 'sso-only'">
            <p class="title-second">- Login only works from Bosch network -</p>
            <a-button type="primary" class="btn btn-sso" @click="loginSSO">
              <i class="fa-solid fa-cloud"></i>
              <span>{{ $t('btn.sso') }}</span>
            </a-button>
          </div>

          <div class="box-iuser" v-else>
            <transition name="fade-slide" mode="out-in">

              <!-- 登录表单 -->
              <div v-if="isLogin" key="login">
                <a-form :model="loginForm" layout="vertical" name="basic" :label-col="{ span: 5 }" autocomplete="off"
                  @finish="login">
                  <a-form-item :label="$t('form.account')" name="account"
                    :rules="[{ required: true, message: 'Please input your account!' }]">
                    <a-input v-model:value="loginForm.account" />
                  </a-form-item>

                  <a-form-item :label="$t('form.password')" name="password"
                    :rules="[{ required: true, message: 'Please input your password!' }]">
                    <a-input-password v-model:value="loginForm.password" />
                  </a-form-item>

                  <div class="form-footer-actions">
                    <a-checkbox v-model:checked="loginForm.remember" class="btn-check">
                      {{ $t('login.remember') }}
                    </a-checkbox>
                    <a type="link" class="switch-btn" @click="isLogin = false">{{ $t('login.create') }} &gt;&gt;</a>
                  </div>

                  <a-form-item>
                    <a-button type="primary" class="btn btn-login" html-type="submit">
                      {{ $t('btn.login') }}
                    </a-button>
                  </a-form-item>
                </a-form>
              </div>

              <!-- 注册表单 -->
              <div v-else key="register">
                <div class="sub-title">{{ $t('login.create') }}</div>
                <a-form :model="registerForm" layout="vertical" @finish="register">
                  <a-form-item name="userno" :rules="[{ required: true, message: 'Please input your userno!' }]">
                    <a-input placeholder="User No" v-model:value="registerForm.userno">
                      <template #prefix><i class="fa-solid fa-circle-user" style="color: #ccc"></i></template>
                    </a-input>
                  </a-form-item>

                  <a-form-item name="ntAccount" :rules="[{ required: true, message: 'Please input your account!' }]">
                    <a-input placeholder="NT Account" v-model:value="registerForm.ntAccount">
                      <template #prefix><i class="fa-solid fa-circle-user" style="color: #ccc"></i></template>
                    </a-input>
                  </a-form-item>

                  <a-form-item name="username" :rules="[{ required: true, message: 'Please input your username!' }]">
                    <a-input placeholder="User Name" v-model:value="registerForm.username">
                      <template #prefix><i class="fa-solid fa-user" style="color: #ccc"></i></template>
                    </a-input>
                  </a-form-item>

                  <a-form-item name="department"
                    :rules="[{ required: true, message: 'Please input your department!' }]">
                    <a-input placeholder="Department" v-model:value="registerForm.department">
                      <template #prefix><i class="fa-solid fa-briefcase" style="color: #ccc"></i></template>
                    </a-input>
                  </a-form-item>

                  <a-form-item name="email">
                    <a-input placeholder="Email" v-model:value="registerForm.email">
                      <template #prefix><i class="fa-solid fa-at" style="color: #ccc"></i></template>
                    </a-input>
                  </a-form-item>

                  <a-form-item name="password" :rules="[{ required: true, message: 'Please input password!' }]">
                    <a-input-password placeholder="Password" v-model:value="registerForm.password">
                      <template #prefix><i class="fa-solid fa-lock" style="color: #ccc"></i></template>
                    </a-input-password>
                  </a-form-item>

                  <a-form-item name="confirm" :rules="[{ required: true, message: 'Please confirm password!' }]">
                    <a-input-password placeholder="Confirm Password" v-model:value="registerForm.confirm">
                      <template #prefix><i class="fa-solid fa-lock" style="color: #ccc"></i></template>
                    </a-input-password>
                  </a-form-item>

                  <div class="form-footer-actions">
                    <span>{{ $t('login.already') }}</span>
                    <a type="link" class="switch-btn" @click="isLogin = true">&lt;&lt; {{ $t('login.back') }}</a>
                  </div>

                  <a-form-item>
                    <a-button type="primary" class="btn btn-register" html-type="submit">
                      {{ $t('login.register') }}
                    </a-button>
                  </a-form-item>
                </a-form>
              </div>
            </transition>

            <!-- SSO -->
            <div class="others" v-if="isLogin">
              <div class="line-divider">
                <div class="line"></div>
                <span>{{ $t('login.other') }}</span>
                <div class="line"></div>
              </div>
              <div class="btns">
                <a-button type="primary" class="btn btn-sso" @click="loginSSO">
                  <i class="fa-solid fa-cloud"></i>
                  <span>{{ $t('btn.sso') }}</span>
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <canvas ref="canvas" width="500" height="500"></canvas>
    </div>
  </div>
</template>

<style scoped lang="scss">
.contents {
  position: relative;
  overflow: hidden;
  background: var(--color-content-bg);

  .box-contents {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  canvas {
    // display: none;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: -1;
  }

  .col-left,
  .col-right {
    flex: 1;
    position: relative;
    height: 100%;
    overflow: hidden;
    z-index: 1;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .bg-img {
    display: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}

.box-img {
  .login-titles {
    position: relative;
    padding: 70px 0;

    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 15%;
      left: 0;
      width: 280px;
      height: 100px;
      background: linear-gradient(to right, #4460f1, #c471ed, #f64f59);
      z-index: -1;
      filter: blur(70px);
      animation: float 8s ease-in-out infinite alternate;
    }

    &::after {
      top: 50%;
      left: 30%;
      width: 200px;
      height: 200px;
      background: linear-gradient(to right, #72ca92, #e552da);
      filter: blur(100px);
      animation-delay: 4s;
    }

    p {
      font-size: 35px;
      font-weight: 700;
    }
  }
}

@keyframes float {
  0% {
    transform: translate(0, 0) scale(1);
  }

  50% {
    transform: translate(80px, 60px) scale(1.1);
  }

  100% {
    transform: translate(-60px, -50px) scale(1);
  }
}

.col-right {
  border-radius: 25px;
  background: #ffffff3d;
}

.box-login {
  width: 500px;
  padding: 70px 40px;

  .titles {
    margin-bottom: 30px;
    text-align: center;
    font-size: 2.3rem;
    line-height: 4.5rem;
    font-weight: 700;
  }

  .sub-title {
    margin-bottom: 20px;
    text-align: center;
    font-size: 1.2rem;
    color: #5a5a5f;
    font-weight: 500;
  }

  .form-footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    font-size: 14px;

    .switch-btn {
      color: #4c40f7;
      cursor: pointer;
      font-weight: 600;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .btn {
    height: 45px;
    font-size: 16px;
    font-weight: 700;
  }

  .btn-login {
    width: 100%;
    background: #4c40f7;
  }

  .btn-check {
    color: #5a5a5f;
  }

  .btn-register {
    width: 100%;
    background: #008dff; // 换个颜色区分注册
  }

  .others {
    margin-top: 65px;
  }

  .line-divider {
    position: relative;
    display: block;
    height: 1px;
    width: 100%;
    margin: 24px 0;
    display: flex;
    align-items: center;
    column-gap: 10px;

    .line {
      flex: 1;
      height: 1px;
      background: #dcdfe6;
    }

    span {
      color: #5a5a5f;
      font-weight: 900;
      font-size: 14px;
      font-weight: 500;
    }
  }
}

.box-sso {
  p {
    text-align: center;
  }

  .title-second {
    margin: 36px 0 24px;
    color: #9da1a8;
    font-size: 18px;
    font-weight: 400;
    line-height: 20px;
  }

  .title-desc {
    margin-bottom: 24px;
    font-size: 18px;
    font-weight: 700;
    line-height: 30px;
  }

  .btn-sso {
    width: 100%;
    border-radius: 30px;
  }
}

// 过渡动画：淡入淡出 + 位移
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
