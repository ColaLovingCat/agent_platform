
import { type JSX } from 'react';
interface Menus { key: string; icon?: JSX.Element; label: string; children?: MenuItem[] }
interface MenuItem { key: string; icon?: JSX.Element; label: string; }

export const menus: Menus[] = [
  {
    key: 'home',
    icon: <i className="bosch-ic bosch-ic-home"></i>,
    label: 'Home',
  },
  {
    key: 'portals',
    icon: <i className="bosch-ic bosch-ic-cubes"></i>,
    label: 'Portals',
    children: [
      {
        key: 'hub-apps',
        icon: <i className="bosch-ic bosch-ic-cubes"></i>,
        label: 'Apps Hub',
      },
    ],
  },
  {
    key: 'configs',
    icon: <i className="bosch-ic bosch-ic-gears"></i>,
    label: 'Configs',
    children: [
      {
        key: 'configs-user',
        icon: <i className="bosch-ic bosch-ic-user"></i>,
        label: 'Users'
      },
    ],
  },
];
