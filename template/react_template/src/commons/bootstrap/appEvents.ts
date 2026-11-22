import eventBus from '@/commons/utils/eventBus';
import { useUserStore } from '@/commons/stores/users';
import * as users from '@/services/users.services';

let initialized = false;

export function setupAppEvents(navigate: (path: string, options?: { replace?: boolean }) => void) {
  if (initialized) return;
  initialized = true;

  eventBus.on('getinfosUser', async () => {
    try {
      const resp = await users.getUserInfos();
      if (resp.status && resp.result) {
        useUserStore.getState().setUserInfo(resp.result);
        const token = (resp.result as { token?: string }).token;
        if (token) {
          useUserStore.getState().setToken(token);
        }
      }
    } catch {
      // 用户信息拉取失败时不阻断跳转
    }
  });

  eventBus.on('jumpHome', () => {
    navigate('/home', { replace: true });
  });

  eventBus.on('clearSystem', () => {
    useUserStore.getState().clearUser();
  });

  eventBus.on('logout', () => {
    useUserStore.getState().clearUser();
    navigate('/login', { replace: true });
  });
}
