import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Layout, Menu, theme, Spin } from 'antd';

import { useSystemStore } from '@/commons/stores/systems';
import { useIsLoading } from '@/commons/stores/loading';

const { Header, Sider, Content } = Layout;

const themeStr = "light"

interface MainLayoutProps {
    logo?: React.ReactNode;
    logo_mini?: React.ReactNode;
    infos?: React.ReactNode;
    menus: any[];
}

function findParentKey(
    arr: any[],
    targetKey: string,
    parentKey: string | null = null
): string | null {
    for (const item of arr) {
        if (item.key === targetKey) {
            return parentKey;
        }

        if (item.children?.length) {
            const result = findParentKey(
                item.children,
                targetKey,
                item.key
            );

            if (result !== null) {
                return result;
            }
        }
    }

    return null;
}

export default function MainLayout({ logo, logo_mini, infos, menus }: MainLayoutProps) {
    // 隐藏菜单
    const systemState = useSystemStore((state) => state.systemState);
    // 加载动画
    const isLoading = useIsLoading();

    const [collapsed, setCollapsed] = useState(false);
    const [menuOpenKeys, setMenuOpenKeys] = useState<string[]>([]);

    const {
        token: { colorBgContainer },
    } = theme.useToken();

    const location = useLocation();
    const isMicroApp = location.pathname.startsWith('/apps/');
    const { selectedKeys, openKeys } = useMemo(() => {
        // 当前路由路径
        const segment = location.pathname.replace(/^\//, '').split('/')[0] || 'home';
        const keys = segment === '' ? ['home'] : [segment];

        // 展开
        const parentKey = findParentKey(menus, keys[0]);
        const open = parentKey ? [parentKey] : []
        return { selectedKeys: keys, openKeys: open };
    }, [location.pathname, menus]);

    // 默认全部展开
    const defaultOpen = true
    useEffect(() => {
        if (defaultOpen) {
            if (menuOpenKeys.length === 0) {
                const temps: string[] = []
                menus.forEach((menu: any) => {
                    if (menu.children?.length) temps.push(menu.key)
                })
                setMenuOpenKeys(temps);
            }
        } else {
            if (openKeys.length > 0) {
                setMenuOpenKeys(openKeys);
            }
        }
    }, [openKeys]);

    // 跳转页面
    const navigate = useNavigate();
    const handleMenuClick = ({ key }: { key: string }) => {
        navigate(`/${key}`);
    };

    return (
        <Layout className={`pages page-three${isMicroApp ? ' full' : ''}`}>
            {systemState.siderShow && !isMicroApp && (
                <Sider width={250} trigger={null} collapsible collapsed={collapsed} theme={themeStr}>
                    <div className="sider-logo">
                        {collapsed ? logo_mini : logo}
                    </div>
                    <Menu
                        theme={themeStr}
                        mode="inline"
                        styles={{
                            itemIcon: {
                                fontSize: 21
                            },
                            subMenu: {
                                itemIcon: {
                                    fontSize: 18
                                }
                            }
                        }}
                        selectedKeys={selectedKeys}
                        openKeys={menuOpenKeys}
                        onOpenChange={setMenuOpenKeys}
                        onClick={handleMenuClick}
                        items={menus}
                    />
                </Sider>
            )}

            <Layout>
                {!isMicroApp && (
                <Header className="headers" style={{ padding: '0 20px 0 0', background: colorBgContainer }}>
                    <div>
                        {systemState.siderShow && (
                            <Button
                                type="text"
                                icon={collapsed ? <i className="bosch-ic bosch-ic-list-view-mobile"></i> : <i className="bosch-ic bosch-ic-back-left"></i>}
                                onClick={() => setCollapsed(!collapsed)}
                                style={{
                                    fontSize: '16px',
                                    width: 64,
                                    height: 64,
                                }}
                            />
                        )}
                    </div>
                    <div className="infos">
                        {infos}
                    </div>
                </Header>
                )}
                <Content className={`page-contents${isMicroApp ? ' page-contents-show' : ''}`}>
                    <Outlet />
                </Content>
            </Layout>
            {isLoading && (
                <Spin size="large" fullscreen />
            )}
        </Layout>
    );
}