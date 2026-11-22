import ChartView from '@/components/echarts';

const ChartUse = () => {
    const options = {
        xAxis: {
            type: 'category',
            data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        },
        yAxis: {
            type: 'value'
        },
        //
        series: [
            {
                type: 'line',
                data: [150, 230, 224, 218, 135, 147, 260],
            }
        ]
    }

    const chartStyle = {
        width: '800px',
        height: '500px',
    }

    const onChartClick = (event: any) => {
        console.log('Testing: ', event)
    }

    return (
        <div className='sections'>
            <div style={chartStyle}>
                <ChartView options={options} onChartClick={onChartClick}></ChartView>
            </div>
        </div>
    );
};

export default ChartUse;