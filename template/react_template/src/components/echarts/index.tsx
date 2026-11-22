import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

import * as extend from "@/commons/utils/extends";

interface ComponentProps {
    options?: any;
    width?: string;
    height?: string;
    changeMark?: boolean;
    onChartClick?: (params: any) => void; 
}

const EChartComponent: React.FC<ComponentProps> = ({
    options = {},
    width = "100%",
    height = "100%",
    changeMark,
    onChartClick,
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);
    const isFirstRender = useRef(true);

    // 3. 用 useState 管理组件内部状态
    const [hasError, setHasError] = useState(false);

    // --- 初始化 & 销毁逻辑 ---
    useEffect(() => {
        if (!containerRef.current) return;

        // 初始化图表实例
        const chart = echarts.init(containerRef.current);
        chartInstanceRef.current = chart;

        // 监听 Resize
        const handleResize = () => {
            chart.resize();
        };
        const debouncedResize = extend.Optimize.debounceFn(handleResize, 500);

        if (containerRef.current.parentElement) {
            observerRef.current = new ResizeObserver(() => debouncedResize());
            observerRef.current.observe(containerRef.current.parentElement);
        }

        // 组件卸载时销毁
        return () => {
            observerRef.current?.disconnect();
            chart.dispose();
            chartInstanceRef.current = null;
        };
    }, []); // 空依赖数组：等价于 Vue 的 onMounted 和 onBeforeUnmount

    // --- 监听 Options 变化 ---
    useEffect(() => {
        if (!chartInstanceRef.current) return;

        let didError = false;
        try {
            chartInstanceRef.current.setOption(options);
        } catch {
            didError = true;
        }
        setHasError(didError);
    }, [options]); // 等价于 Vue 中的 watch(() => props.options)

    // --- 监听 changeMark 变化 ---
    useEffect(() => {
        // 首次渲染跳过（模拟 vue 只在后续触发），否则会和初始化重叠
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (!chartInstanceRef.current) return;
        chartInstanceRef.current.clear();

        let didError = false;
        try {
            chartInstanceRef.current.setOption(options);
        } catch {
            didError = true;
        }
        setHasError(didError);
    }, [changeMark]); // 等价于 Vue 中的 watch(() => props.changeMark)

    // --- 绑定点击事件 ---
    useEffect(() => {
        const chart = chartInstanceRef.current;
        if (!chart) return;

        const clickHandler = (params: any) => {
            if (onChartClick) {
                onChartClick(params);
            }
        };

        chart.on("click", clickHandler);

        // 每次 onChartClick 回调更新时，解绑旧事件，绑定新事件
        return () => {
            chart.off("click", clickHandler);
        };
    }, [onChartClick]);

    // 样式对象
    const errorStyle: React.CSSProperties = {
        position: "absolute",
        top: 0,
        left: 0,
        color: "#5a5a5f4d",
        fontSize: "16px",
        border: "2px dashed #c4cecf6d",
        borderRadius: "8px",
        background: "#fff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
    };

    return (
        <div
            className="echart-container"
            style={{ position: "relative", width, height }}
        >
            <div
                className="echart-ele"
                style={{ width: "100%", height: "100%" }}
                ref={containerRef}
            />
            {hasError && (
                <div className="echart-error" style={errorStyle}>
                    图表初始化失败，请检查数据或配置
                </div>
            )}
        </div>
    );
};

export default EChartComponent;