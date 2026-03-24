'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

type DataPoint = { date: string; weight: number }

type Props = {
  data: DataPoint[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm">
      <p className="text-neutral-400 text-xs">{label}</p>
      <p className="text-orange-400 font-bold">{payload[0].value} kg</p>
    </div>
  )
}

export default function ProgressChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-neutral-600 text-sm">
        Zu wenig Daten — mehr trainieren!
      </div>
    )
  }

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#737373', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#737373', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit=" kg"
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#f97316"
          strokeWidth={2.5}
          dot={{ fill: '#f97316', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#fb923c' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
