
import { useNavigate } from 'react-router-dom';

import './styles.scss'

export default function HomeView() {
  const navigate = useNavigate();

  type Status = 'done' | 'try' | 'open'
  interface Group {
    group: string;
    list: Item[];
  }
  interface Item {
    name: string;
    path: string;
    icon: string;
    status: Status;
  }

  const datas: Group[] = [
    {
      group: '组件',
      list: [
        { name: 'eChart', path: '/chart-using', icon: 'fa-chart-line', status: 'done' },
        { name: 'Chat', path: '/chat-using', icon: 'fa-comments', status: 'done' },
        { name: 'Upload', path: '/upload-using', icon: 'fa-upload', status: 'done' },
      ]
    },
  ]

  const statusIcons = {
    done: <i className="fa-solid fa-check-circle status-icon done"></i>,
    try: <i className="fa-solid fa-flask status-icon try"></i>,
    open: <i className="fa-solid fa-rocket status-icon open"></i>,
  };

  const pageGo = (path: string) => {
    navigate(path)
  }

  return (
    <div className="sections dashboard-bright">
      <div className="glow-sphere sphere-1"></div>
      <div className="glow-sphere sphere-2"></div>

      {datas.map((group) => (
        <div className="group-container" key={group.group}>
          <div className="group-header">
            <span className="group-tag">Explore</span>
            <h2 className="group-title">{group.group}</h2>
            <div className="title-line"></div>
          </div>

          <div className="card-layout">
            {group.list.map(item => (
              <div className="neo-card" key={item.name} onClick={() => pageGo(item.path)} >
                <div className="card-inner">
                  <div className={['icon-wrapper', item.status].join(' ')}>
                    <i className={['fa-solid', item.icon].join(' ')}></i>
                  </div>

                  <div className="text-content">
                    <div className="name-row">
                      <span className="item-name">{item.name}</span>
                      {statusIcons[item.status] || statusIcons.open}
                    </div>
                    <span className="item-path">{item.path}</span>
                  </div>

                  <div className="arrow-go">
                    <i className="fa-solid fa-chevron-right"></i>
                  </div>
                </div>
              </div>
            ))
            }
          </div >
        </div >
      ))
      }
    </div >
  );
}