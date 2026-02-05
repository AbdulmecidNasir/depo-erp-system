import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Brush
} from 'recharts';
import { formatUZS } from '../../utils/currency';
import { useTheme } from '../../contexts/ThemeContext';

interface LocationTurnoverChartProps {
  data: Array<Record<string, any>>; // [{ date, LOC1, LOC2, ... }]
  locations: string[]; // ['LOC1','LOC2']
  title?: string;
}

const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} млрд`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} тыс`;
  return String(value);
}

const CustomTooltip = ({ active, payload, label, isDark }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className={`rounded-lg shadow px-3 py-2 border transition-all duration-300 ${isDark
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200'
      }`}>
      <div className={`text-xs mb-1 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>{label}</div>
      <div className="space-y-0.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className={`transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>{p.dataKey}:</span>
            <span className={`font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
              }`}>{formatUZS(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LocationTurnoverChart: React.FC<LocationTurnoverChartProps> = ({ data, locations, title }) => {
  const { isDark } = useTheme();

  return (
    <div className={`rounded-lg shadow p-4 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
      }`}>
      {title ? <h3 className={`text-lg font-semibold mb-4 transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
        }`}>{title}</h3> : null}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: isDark ? '#d1d5db' : '#374151' }}
              tickLine={false}
              axisLine={{ stroke: isDark ? '#374151' : '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: isDark ? '#d1d5db' : '#374151' }}
              tickFormatter={formatCompact}
              tickLine={false}
              axisLine={{ stroke: isDark ? '#374151' : '#e5e7eb' }}
            />
            <Tooltip content={<CustomTooltip isDark={isDark} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: isDark ? '#d1d5db' : '#374151' }} />
            {locations.map((loc, idx) => (
              <Area key={loc} type="monotone" dataKey={loc} stroke={COLORS[idx % COLORS.length]} fill={COLORS[idx % COLORS.length]} fillOpacity={0.12} strokeWidth={2} activeDot={{ r: 3 }} />
            ))}
            <Brush dataKey="date" height={24} travellerWidth={8} stroke={isDark ? '#6b7280' : '#9ca3af'} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LocationTurnoverChart;


