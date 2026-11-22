// src/views/error/404.tsx
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
    const navigate = useNavigate();

    const goHome = () => {
        navigate('/home', { replace: true });
    };

    return (
        <div className="sections flex items-center justify-center bg-gray-50">
            <Result
                status="404"
                title="404"
                subTitle="抱歉，您访问的页面不存在或已被移除。"
                extra={
                    <Button type="primary" size="large" onClick={goHome}>
                        返回首页
                    </Button>
                }
            />
        </div>
    );
}