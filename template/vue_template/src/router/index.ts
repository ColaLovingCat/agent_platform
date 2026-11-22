import { createRouter, createWebHistory } from "vue-router";

const routes = [
  // 添加重定向
  {
    path: "/",
    redirect: "/home",
  },

  // 登录页面
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/login/view.vue"),
  },
  {
    path: "/sso-auth",
    name: "ssoAuth",
    component: () => import("@/views/login/sso-auth.vue"),
  },

  {
    path: "/home",
    name: "home",
    component: () => import("@/views/home/view.vue"),
  },
  {
    path: "/configs-users",
    name: "configs-users",
    component: () => import("@/views/system/users/users.vue"),
  },
  {
    path: "/post-api",
    name: "post-api",
    component: () => import("@/components/editor-code/post.vue"),
  },

  // 业务页面
  {
    path: "/",
    name: "/",
    component: () => import("@/components/layouts/contents.vue"),
    children: [],
  },

  // 组件测试页面
  {
    path: "/comps",
    name: "comps",
    children: [
      {
        path: "/chats-using",
        name: "chats-using",
        component: () => import("@/components/chats/using.vue"),
      },
      {
        path: "/forms-using",
        name: "forms-using",
        component: () => import("@/components/forms/using.vue"),
      },
      {
        path: "/echarts-using",
        name: "echarts-using",
        component: () => import("@/components/echarts/using.vue"),
      },
      {
        path: "/charts-cloud",
        name: "charts-cloud",
        component: () => import("@/components/chart-cloud/using.vue"),
      },
      {
        path: "/charts-graph",
        name: "charts-graph",
        component: () => import("@/components/chart-graph/using.vue"),
      },
      {
        path: "/upload-using",
        name: "upload-using",
        component: () => import("@/components/upload-form/using.vue"),
      },
      {
        path: "/camera-using",
        name: "camera-using",
        component: () => import("@/components/camera/using.vue"),
      },
      {
        path: "/barcode-using",
        name: "barcode-using",
        component: () => import("@/components/barcode/using.vue"),
      },
      {
        path: "/workflows-using",
        name: "workflows-using",
        component: () => import("@/views/func/flows/using.vue"),
      },
      {
        path: "/drag-using",
        name: "drag-using",
        component: () => import("@/components/others/drag.vue"),
      },
      {
        path: "/three-using",
        name: "three-using",
        component: () => import("@/components/threejs/using.vue"),
      },
      {
        path: "/editors-code",
        name: "editors-code",
        component: () => import("@/components/editor-code/using.vue"),
      },

      {
        path: "/flips-using",
        name: "flips-using",
        component: () => import("@/components/flips/using.vue"),
      },
      {
        path: "/article-using",
        name: "article-using",
        component: () => import("@/components/articles/using.vue"),
      },
      {
        path: "/type-using",
        name: "type-using",
        component: () => import("@/components/type-writer/using.vue"),
      },
      {
        path: "/gantt-using",
        name: "gantt-using",
        component: () => import("@/components/gantt/using.vue"),
      },
      {
        path: "/label-using",
        name: "label-using",
        component: () => import("@/components/annotations/using.vue"),
      },
      {
        path: "/robot-using",
        name: "robot-using",
        component: () => import("@/components/robot/using.vue"),
      },

      {
        path: "/gsap-using",
        name: "gsap-using",
        component: () => import("@/components/others/gasp.vue"),
      },

      // 语法
      {
        path: "/extend-using",
        name: "extend-using",
        component: () => import("@/commons/utils/extends/using.vue"),
      },
      {
        path: "/directives-using",
        name: "directives-using",
        component: () => import("@/commons/directives/using.vue"),
      },
      {
        path: "/hooks-using",
        name: "hooks-using",
        component: () => import("@/commons/hooks/using.vue"),
      },
      {
        path: "/indexedDB-using",
        name: "indexedDB-using",
        component: () => import("@/commons/utils/indexedDB.vue"),
      },

      //
      {
        path: "/bgs-using",
        name: "bgs-using",
        component: () => import("@/components/bgs.vue"),
      },
      {
        path: "/style-using",
        name: "style-using",
        component: () => import("@/components/others/style.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // history: createWebHashHistory(),
  routes,
});

// 拦截路由
router.beforeEach((to: any, from: any, next: any) => {
  next();
});

export default router;
