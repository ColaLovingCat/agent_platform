import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { useSystemStore } from '@/commons/stores/systems';
import { handleUnauthorized } from '@/commons/utils/authSession';

import * as extend from '@/commons/utils/extends';

const Content = () => {
  const debug = useSystemStore((state) => state.systemState.debug);

    useEffect(() => {
        const token = extend.ExLocalStore.get('token')
        if ((token && token != '') || debug) {
            // 有token
        } else {
            handleUnauthorized();
        }
    }, []);


    return (
        <Outlet />
    );
};
export default Content;