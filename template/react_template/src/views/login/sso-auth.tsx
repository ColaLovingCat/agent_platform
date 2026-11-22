import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import eventBus from '@/commons/utils/eventBus';
import * as extend from '@/commons/utils/extends';
import * as messages from '@/commons/utils/messages';
import { useLoadingStore } from '@/commons/stores/loading';
import * as login from '@/services/login.services';

export default function SsoAuthView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startLoading = useLoadingStore((state) => state.start);
  const endLoading = useLoadingStore((state) => state.end);

  useEffect(() => {
    const params = extend.ExWeb.params();
    if (!params.code) return;

    startLoading();
    const redirect_uri = `${extend.ExWeb.url().server}/sso-auth`;
    const param = {
      code: params.code,
      redirectUri: redirect_uri,
    };

    login
      .loginAzure(param)
      .then((resp) => {
        endLoading();
        const { status, message } = resp;
        if (status) {
          eventBus.emit('getinfosUser');
          if (params.state) {
            const path =
              decodeURIComponent(
                atob(decodeURIComponent(decodeURIComponent(params.state))),
              ) || '/';
            navigate(path);
          } else {
            eventBus.emit('jumpHome');
          }
        } else {
          messages.showError(message);
        }
      })
      .catch((err) => {
        endLoading();
        messages.showError(err);
        eventBus.emit('logout');
      });
  }, [startLoading, endLoading, navigate]);

  return <div className="sections">{t('login.ssoing')}</div>;
}
