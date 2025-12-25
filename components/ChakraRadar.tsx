import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { CHAKRA_DATA } from '../constants';

interface ChakraRadarProps {
  resonance: number;
}

export const ChakraRadar: React.FC<ChakraRadarProps> = ({ resonance }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Calculate active chakra stats for the side panel
  const activeIndex = Math.min(Math.floor(resonance * 7), 6);
  const activeChakra = CHAKRA_DATA[activeIndex];
  
  // Compute normalized display values (random slight fluctuation for "live" feel)
  const frequency = activeChakra.frequency;
  const power = (activeChakra.elementPower * (0.8 + resonance * 0.2)).toFixed(0);
  const balance = (activeChakra.balance * (0.9 + Math.random() * 0.1)).toFixed(0);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current, null, { renderer: 'svg' });

    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      chartInstance.current?.dispose();
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!chartInstance.current) return;

    // Mask data based on resonance (simulate unlocking chakras)
    const maskedFreq = CHAKRA_DATA.map((c, i) => i <= activeIndex ? c.frequency : 100);
    const maskedPower = CHAKRA_DATA.map((c, i) => i <= activeIndex ? c.elementPower * 10 : 200);
    const maskedBalance = CHAKRA_DATA.map((c, i) => i <= activeIndex ? c.balance * 10 : 200);

    const option = {
      backgroundColor: 'transparent',
      animationDuration: 300,
      radar: {
        indicator: CHAKRA_DATA.map(c => ({ name: '', max: 1000 })), // Hide labels on chart to clean up
        shape: 'circle',
        radius: '65%',
        center: ['50%', '50%'], // Center in the left half
        splitNumber: 3,
        axisName: { show: false },
        splitLine: {
          lineStyle: {
            color: [
                'rgba(255,255,255,0.03)',
                'rgba(255,255,255,0.06)',
                'rgba(255,255,255,0.1)'
            ].reverse()
          }
        },
        axisLine: {
          lineStyle: { color: 'rgba(255,255,255,0.1)' }
        },
        splitArea: { show: false }
      },
      series: [
        {
          type: 'radar',
          symbol: 'none', // Cleaner look without dots
          lineStyle: { width: 1, type: 'dashed' },
          areaStyle: { color: 'rgba(168, 85, 247, 0.2)' }, 
          itemStyle: { color: '#a855f7' },
          data: [{ value: maskedFreq }]
        },
        {
          type: 'radar',
          symbol: 'none',
          lineStyle: { width: 2 },
          areaStyle: { color: 'rgba(6, 182, 212, 0.2)' },
          itemStyle: { color: '#06b6d4' },
          data: [{ value: maskedPower }]
        },
        {
          type: 'radar',
          symbol: 'none',
          lineStyle: { width: 1.5 },
          areaStyle: { color: 'rgba(234, 179, 8, 0.2)' },
          itemStyle: { color: '#eab308' },
          data: [{ value: maskedBalance }]
        }
      ]
    };

    chartInstance.current.setOption(option);
  }, [resonance, activeIndex]);

  return (
    <div className="flex w-full h-full">
        {/* Left: The Radar Chart */}
        <div className="w-[60%] h-full relative border-r border-white/5">
            <div ref={chartRef} className="w-full h-full" />
            <div className="absolute top-2 left-2 text-[8px] text-white/20 font-mono tracking-widest">
                SPECTRAL ANALYSIS
            </div>
        </div>

        {/* Right: Data Column */}
        <div className="w-[40%] h-full p-4 flex flex-col justify-center bg-black/20">
            {/* Header / Active Chakra */}
            <div className="mb-4">
                <div className="text-[9px] text-white/40 font-mono uppercase tracking-widest mb-1">Target Node</div>
                <div className="text-sm font-bold text-white tracking-wide uppercase" style={{ textShadow: `0 0 10px ${activeChakra.color}` }}>
                    {activeChakra.name.split(' ')[0]}
                </div>
            </div>

            {/* Metrics List */}
            <div className="space-y-3 font-mono text-[10px]">
                {/* Metric 1 */}
                <div className="flex justify-between items-center border-b border-white/5 pb-1">
                    <span className="text-purple-400">FREQ</span>
                    <span className="text-white">{frequency} <span className="text-white/30 text-[8px]">Hz</span></span>
                </div>
                {/* Metric 2 */}
                <div className="flex justify-between items-center border-b border-white/5 pb-1">
                    <span className="text-cyan-400">PWR</span>
                    <span className="text-white">{power} <span className="text-white/30 text-[8px]">U</span></span>
                </div>
                {/* Metric 3 */}
                <div className="flex justify-between items-center border-b border-white/5 pb-1">
                    <span className="text-yellow-400">BAL</span>
                    <span className="text-white">{balance} <span className="text-white/30 text-[8px]">%</span></span>
                </div>
            </div>

            {/* Footer / Total Resonance */}
            <div className="mt-4 pt-2 border-t border-white/10">
                <div className="flex justify-between items-end">
                    <span className="text-[8px] text-white/40">TOTAL SYNC</span>
                    <span className="text-lg font-light text-white leading-none">
                        {(resonance * 100).toFixed(0)}<span className="text-xs text-white/50">%</span>
                    </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/10 mt-1 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300" 
                        style={{ width: `${resonance * 100}%` }}
                    />
                </div>
            </div>
        </div>
    </div>
  );
};