import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Suspense } from 'react';

import App from '../App.tsx';
import { Login, SsoAuth, Home, NotFound, Configs_User, Test, Content } from './imports.tsx';
import { ChatUse, ChartUse, UploadUse } from './imports.tsx';
import { FlowsList, FlowEdit } from './imports.tsx';
import { StaticMicroApp, AppsHub } from './imports.tsx';

const lazyLoad = (Component: React.LazyExoticComponent<React.ComponentType>) => {
  return (
    <Suspense fallback={<div className="sections flex items-center justify-center">加载中...</div>}>
      <Component />
    </Suspense>
  );
};

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/home" replace />,
      },

      {
        path: '/login',
        element: lazyLoad(Login),
      },
      {
        path: '/sso-auth',
        element: lazyLoad(SsoAuth),
      },
      {
        path: '/test',
        element: lazyLoad(Test),
      },
      {
        path: '/apps/:appId/*',
        element: lazyLoad(StaticMicroApp),
      },

      {
        path: 'chat-using',
        element: lazyLoad(ChatUse),
      },
      {
        path: 'chart-using',
        element: lazyLoad(ChartUse),
      },
      {
        path: 'upload-using',
        element: lazyLoad(UploadUse),
      },

      {
        path: '/',
        // 用于路由守卫，验证token是否存在
        element: <Content />,
        children: [
          {
            path: 'home',
            element: lazyLoad(Home),
          },

          {
            path: 'flows',
            element: lazyLoad(FlowsList),
          },
          {
            path: 'flow/:id',
            element: lazyLoad(FlowEdit),
          },

          {
            path: 'hub-apps',
            element: lazyLoad(AppsHub),
          },
          {
            path: 'configs-user',
            element: lazyLoad(Configs_User),
          },
        ],
      },
      {
        path: '*',
        element: lazyLoad(NotFound),
      },
    ],
  },
]);

export default router;
