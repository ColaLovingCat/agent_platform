import { lazy } from 'react';

export const Content = lazy(() => import('../components/layouts/contents'));
export const Home = lazy(() => import('../views/home'));
export const Login = lazy(() => import('../views/login'));
export const SsoAuth = lazy(() => import('../views/login/sso-auth'));
export const NotFound = lazy(() => import('../views/system/404'));

// 自定义组件
export const ChartUse = lazy(() => import('@/components/echarts/using'));
export const ChatUse = lazy(() => import('@/components/chats/using'));
export const UploadUse = lazy(() => import('@/components/uploads/using'));

export const Test = lazy(() => import('../views/system/test.tsx'));
export const Configs_User = lazy(() => import('../views/system/users'));

export const FlowsList = lazy(() => import('../views/func/flows/list'));
export const FlowEdit = lazy(() => import('../views/func/flows'));

export const StaticMicroApp = lazy(() => import('@/components/micro-app/StaticMicroApp'));
export const AppsHub = lazy(() => import('../views/func/portals/apps-hub'));
