import * as React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#14b8a6', '#818cf8', '#f472b6', '#fbbf24'];

export const CrawlChart = ({ data }: { data: { name: string; pages: number; domains: number }[] }) => (
  <div className="card">
    <h3 className="text-sm font-medium text-ink-200 mb-4">Crawl activity</h3>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="white/5" vertical={false} />
          <XAxis dataKey="name" stroke="white/10" fontSize="11" />
          <YAxis stroke="white/10" fontSize="11" />
          <Tooltip />
          <Line type="monotone" dataKey="pages" stroke="#14b8a6" strokeWidth={2} dot={false} name="Pages crawled" />
          <Line type="monotone" dataKey="domains" stroke="#818cf8" strokeWidth={2} dot={false} name="Domains found" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const AuthorityPie = ({ data }: { data: { name: string; value: number }[] }) => (
  <div className="card">
    <h3 className="text-sm font-medium text-ink-200 mb-4">Authority distribution</h3>
    <div className="h-64 flex items-center justify-center">
      <ResponsiveContainer width={260} height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx={130} cy={130} innerRadius={70} outerRadius={110}
            fill="#888" labelLine={false}
          >
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
);
