import React, { useEffect, useMemo, useState } from 'react';

interface EmptyProps {
    datas?: Record<string, any>;
    changeMark?: boolean;
    onUpdate?: (values: any) => void;
}

const Empty: React.FC<EmptyProps> = ({
    datas = {},
    changeMark,
    onUpdate
}) => {

    const [count, setCount] = useState(0);

    const processedData = useMemo(() => {
        return Object.keys(datas).length;
    }, [datas]);

    useEffect(() => {
        console.log('Component Mounted');
        return () => console.log('Component Unmounted');
    }, []);

    useEffect(() => {
        console.log('changeMark changed:', changeMark);

        if (onUpdate) {
            onUpdate({ status: 'changed', changeMark });
        }
    }, [changeMark]); // 依赖项数组，当 changeMark 变化时执行

    return (
        <div className='sections'>
            Empty
        </div>
    );
};

Empty.displayName = 'custom-name';
export default Empty;