import { useEffect, useMemo, useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Switch, type MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';

import { useSystemStore } from '@/commons/stores/systems';
import { useLoadingStore } from '@/commons/stores/loading';
import { useUserStore } from '@/commons/stores/users';

import MainLayout from '@/components/layouts';
import WhiteboardModal from '@/components/whiteboard';

import * as extend from '@/commons/utils/extends';
import * as messages from '@/commons/utils/messages';
import eventBus from '@/commons/utils/eventBus';
import { logger } from '@/commons/utils/logger'
const log = logger.create("App");

import { menus } from './commons/datas/menus';
import * as current from '@/services/login.services';

function App() {
  const navigate = useNavigate();

  const { startLoading, endLoading, clearLoading } = useLoadingStore();
  const userInfos = useUserStore((state) => state.userInfo);
  const { setUserInfo, clearUser } = useUserStore();
  const { setSystemInfo, setSiderShow, setDebug } = useSystemStore();
  const debug = useSystemStore((state) => state.systemState.debug);

  // 国际化
  const { t, i18n } = useTranslation();
  const changeLang = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
    //
    extend.ExLocalStore.set('lang', newLang)
  };

  // 环境
  const env = import.meta.env.VITE_APP_ENV
  // 设备类型
  const [deviceType, setDeviceType] = useState('');
  // 当前宽高
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const updateSize = () => {
    const size = extend.ExWeb.viewSize()
    setWidth(size.w);
    setHeight(size.h);
  };

  const [whiteboardOpen, setWhiteboardOpen] = useState(false);

  // 信息展示列表
  const infos: MenuProps['items'] = useMemo(() => [
    {
      key: 'whiteboard',
      label: (
        <>
          <i className="fa-solid fa-chalkboard"></i>
          <span>Whiteboard</span>
        </>
      ),
    },
    {
      key: 'env',
      label: (
        <><i className="fa-solid fa-code"></i><span>{t(`env.${env}`)}</span></>
      ),
    },
    {
      key: 'device',
      label: (
        <><i className="fa-solid fa-globe"></i><span>{deviceType}</span></>
      ),
    },
    {
      key: 'size',
      label: (
        <><i className="fa-solid fa-display"></i><span>{width} * {height}</span></>
      ),
    },
    {
      key: 'debug',
      label: (
        <span
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <i className="fa-solid fa-bug"></i>
          <span>Debug</span>
          <Switch size="small" checked={debug} onChange={setDebug} />
        </span>
      ),
    },
  ], [debug, deviceType, width, height, env, setDebug, t]);

  // 获取菜单
  interface Menus { key: string; icon?: JSX.Element; label: string; children?: MenuItem[] }
  interface MenuItem { key: string; icon?: JSX.Element; label: string; }
  const [menuData, setMenuData] = useState<Menus[]>([]);
  const getlistMenu = async () => {
    setMenuData(menus)
  }

  const clearSystem = () => {
    // 清除用户信息
    extend.ExLocalStore.delete('token')
    clearUser()
    // 清除菜单
    setMenuData([])
  }
  const logout = () => {
    clearSystem();
    log.log('user', 'log out')
    navigate('/login', { replace: true });
  };
  const jumpHome = () => {
    navigate('/home')
  }

  // 获取用户
  const getinfosUser = async () => {
    startLoading()
    try {
      // 先获取用户信息
      const resp: any = await current.getinfosUser()
      const { status, data, message } = resp
      if (status) {
        setUserInfo({ ...data })
        log.log('Userinfos', data)
      } else {
        messages.showError(message)
      }
    } catch (error) {
      log.log('GetUserinfos', error)
      logout()
    } finally {
      endLoading()
    }
  }
  const users: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <a target="_blank" rel="noopener noreferrer" onClick={logout}>
          <i className="fa-solid fa-power-off"></i><span>{t('login.logout')}</span>
        </a>
      ),
    },
  ];

  // 页面加载时触发
  useEffect(() => {
    // 清除loading
    clearLoading()

    // 展示菜单
    setSiderShow(true)

    // 更新网页大小
    updateSize();
    window.addEventListener("resize", updateSize);
    setDeviceType(extend.ExWeb.device())

    // 设置语言
    const lang = extend.ExLocalStore.get('lang')
    i18n.changeLanguage(lang);

    // 更新系统信息
    setSystemInfo({
      name: "Demo System",
      loginMode: "sso-iuser",
      azure: "configs",
      azureAuto: false,
      azureConfigs: {
        host: "https://login.microsoftonline.com/0ae51e19-07c8-4e4b-bb6d-648ee58410f4/oauth2/v2.0/authorize",
        client_id: "30a3180e-ef46-4d44-98c3-b8a0bc8e7a13",
        scope: "api://30a3180e-ef46-4d44-98c3-b8a0bc8e7a13/sso",
        response_type: "code",
      },
      adminKey: "SystemAdmin",
    });

    const refreshInfos = async () => {
      try {
        // 检测token
        const token = extend.ExLocalStore.get('token')
        if (token && token != '') {
          // 如果有token则加载用户信息和菜单
          await getinfosUser()
        }
        getlistMenu()
      } catch (error) {
        console.log('Testing: ', error)
      }
    };
    refreshInfos()

    eventBus.on('getinfosUser', getinfosUser)
    eventBus.on('jumpHome', jumpHome)
    eventBus.on('clearSystem', clearSystem)
    eventBus.on('logout', logout)
  }, []);

  return (
    <>
    <MainLayout
      menus={menuData}
      logo={
        <img className="logo" src={`/systems/logos/logo-name.png`} alt="" />
      }
      logo_mini={
        <img className="logo-mini" src={`/systems/logos/logo.png`} alt="" />
      }
      infos={
        <>
          {/* 信息 */}
          <Dropdown
            menu={{
              items: infos,
              onClick: ({ key }) => {
                if (key === 'whiteboard') setWhiteboardOpen(true);
              },
            }}
          >
            <a onClick={(e) => e.preventDefault()}>
              <i className="fa-solid fa-circle-info"></i>
            </a>
          </Dropdown>
          {/* 语言 */}
          <div className="langs">
            <img className="img-lan" src={`/systems/lan/lan-${i18n.language}.png`} onClick={changeLang} />
          </div>
          {/* 用户 */}
          <Dropdown menu={{ items: users }}>
            <a onClick={(e) => e.preventDefault()}>
              <i className="fa-solid fa-user"></i>
              <span>{userInfos?.username}</span>
            </a>
          </Dropdown >
        </>
      }
    />
    <WhiteboardModal open={whiteboardOpen} onClose={() => setWhiteboardOpen(false)} />
    </>
  )
}

export default App
