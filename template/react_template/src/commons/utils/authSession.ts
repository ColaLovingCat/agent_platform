// authSession.ts
import eventBus from '@/commons/utils/eventBus';
import { useSystemStore } from '@/commons/stores/systems';
import * as extend from './extends';

export function handleUnauthorized() {
  extend.ExLocalStore.delete('token');
  useSystemStore.getState().showLogout(() => {
    eventBus.emit('logout');
  });
}