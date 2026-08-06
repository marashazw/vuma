"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function RidesChart({ data }: { data: { day: string; rides: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8098B6" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8098B6" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid #D7DEE8", fontSize: 12 }}
          cursor={{ fill: "#FEF6E9" }}
        />
        <Bar dataKey="rides" fill="#F2A93B" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
