"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { TrendingUp, DollarSign, Clock, Percent, Calculator, ArrowRight } from "lucide-react";

export default function CompoundCalculatorPage() {
  const [principal, setPrincipal] = useState<number>(100000);
  const [rate, setRate] = useState<number>(12);
  const [years, setYears] = useState<number>(10);
  const [frequency, setFrequency] = useState<number>(1); // 1 = Annually
  const [ratePeriod, setRatePeriod] = useState<number>(1); // 1 = Annually
  const [months, setMonths] = useState<number>(0);

  const calculateData = useMemo(() => {
    let chartData = [];
    const r = (rate * ratePeriod) / 100;
    const n = frequency;
    const totalYears = years + months / 12;
    const totalPeriods = Math.floor(totalYears * n);

    let prevAmount = principal;
    let totalAccruedInterest = 0;

    // Period 0 (Initial)
    chartData.push({
      periodLabel: "0",
      earnedThisPeriod: 0,
      interest: 0,
      amount: principal,
      principal: principal
    });

    for (let p = 1; p <= totalPeriods; p++) {
      const amountForPeriod = principal * Math.pow(1 + r / n, p);
      const earnedThisPeriod = amountForPeriod - prevAmount;
      totalAccruedInterest += earnedThisPeriod;

      chartData.push({
        periodLabel: `${p}`,
        earnedThisPeriod: earnedThisPeriod,
        interest: totalAccruedInterest,
        amount: Math.round(amountForPeriod * 100) / 100,
        principal: principal
      });
      prevAmount = amountForPeriod;
    }

    // Add trailing edge if fraction
    if (totalYears * n > totalPeriods) {
      const amountForPeriod = principal * Math.pow(1 + r / n, totalYears * n);
      const earnedThisPeriod = amountForPeriod - prevAmount;
      totalAccruedInterest += earnedThisPeriod;
      
      chartData.push({
        periodLabel: `${years}Y ${months}M`,
        earnedThisPeriod: earnedThisPeriod,
        interest: totalAccruedInterest,
        amount: Math.round(amountForPeriod * 100) / 100,
        principal: principal
      });
    }

    const finalAmount = chartData[chartData.length - 1]?.amount || principal;
    const totalInterest = chartData[chartData.length - 1]?.interest || 0;

    return {
      chartData,
      finalAmount,
      totalInterest
    };
  }, [principal, rate, years, months, frequency, ratePeriod]);

  const { chartData, finalAmount, totalInterest } = calculateData;

  const pieData = [
    { name: "Initial Amount", value: principal },
    { name: "Total Interest", value: totalInterest }
  ];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const COLORS = ['#3b82f6', '#10b981']; // blue-500, emerald-500

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1e2433] p-4 sm:p-6 lg:p-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Calculator className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Compound Interest Calculator
          </h1>
          <p className="mt-2 text-gray-600 dark:text-slate-400">
            Calculate your investment growth over time through the power of compound interest.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Input Panel */}
          <div className="lg:col-span-1 bg-white dark:bg-[#252d3d] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-[#4a6fa5]">
            <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Investment Details
            </h2>

            <div className="space-y-5">
              {/* Principal Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  Initial Principal Amount
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-medium">₹</span>
                  <input
                    type="number"
                    value={principal}
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white font-medium"
                    min="0"
                  />
                </div>
              </div>

              {/* Interest Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-gray-500" />
                  Interest Rate (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-2/3 px-4 py-3 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white font-medium"
                    step="0.1"
                    min="0"
                  />
                  <select
                    value={ratePeriod}
                    onChange={(e) => setRatePeriod(Number(e.target.value))}
                    className="w-1/3 px-2 py-3 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white font-medium"
                  >
                    <option value={1}>Annually</option>
                    <option value={4}>Quarterly</option>
                    <option value={12}>Monthly</option>
                    <option value={26}>Bi-Weekly</option>
                    <option value={52}>Weekly</option>
                    <option value={365}>Daily</option>
                  </select>
                </div>
              </div>

              {/* Total Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  Total Time
                </label>
                <div className="flex gap-2">
                  <div className="w-1/2 relative">
                    <input
                      type="number"
                      value={years}
                      onChange={(e) => setYears(Number(e.target.value))}
                      className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white font-medium"
                      min="0"
                      max="100"
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 text-sm font-medium pointer-events-none">Years</span>
                  </div>
                  <div className="w-1/2 relative">
                    <input
                      type="number"
                      value={months}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 11) setMonths(val);
                      }}
                      className="w-full pl-4 pr-16 py-3 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white font-medium"
                      min="0"
                      max="11"
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 text-sm font-medium pointer-events-none">Months</span>
                  </div>
                </div>
              </div>

              {/* Compounding Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Compounding Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white font-medium"
                >
                  <option value={1}>Annually (1/yr)</option>
                  <option value={2}>Semi-Annually (2/yr)</option>
                  <option value={4}>Quarterly (4/yr)</option>
                  <option value={12}>Monthly (12/yr)</option>
                  <option value={26}>Bi-Weekly (26/yr)</option>
                  <option value={52}>Weekly (52/yr)</option>
                  <option value={365}>Daily (365/yr)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results & Visuals */}
          <div className="lg:col-span-2 space-y-6">

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#252d3d] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-[#4a6fa5] flex flex-col justify-center">
                <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mb-1">Initial Amount</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(principal)}
                </p>
              </div>

              <div className="bg-white dark:bg-[#252d3d] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-[#4a6fa5] flex flex-col justify-center">
                <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mb-1 flex items-center justify-between">
                  Compounded Value
                  <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    +{formatCurrency(totalInterest)}
                  </span>
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(finalAmount)}
                </p>
              </div>

              <div className="hidden lg:flex bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl shadow-sm flex-col justify-center text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <TrendingUp className="w-16 h-16" />
                </div>
                <p className="text-sm text-blue-100 font-medium mb-1 relative z-10">Total Return</p>
                <p className="text-3xl font-bold relative z-10">
                  {((finalAmount / (principal || 1)) * 100 - 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Graphs Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Area Chart */}
              <div className="lg:col-span-2 bg-white dark:bg-[#252d3d] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-[#4a6fa5]">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Growth Over Time</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                      <XAxis
                        dataKey="periodLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        tickMargin={10}
                      />
                      <YAxis
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        width={60}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area
                        type="monotone"
                        dataKey="principal"
                        name="Principal"
                        stackId="1"
                        stroke="#3b82f6"
                        fill="url(#colorPrincipal)"
                      />
                      <Area
                        type="monotone"
                        dataKey="interest"
                        name="Accrued Interest"
                        stackId="1"
                        stroke="#10b981"
                        fill="url(#colorInterest)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="lg:col-span-1 bg-white dark:bg-[#252d3d] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-[#4a6fa5] flex flex-col items-center justify-center relative">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 self-start w-full text-left">Distribution</h3>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Custom Legend for Pie */}
                <div className="w-full mt-4 space-y-2">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                        <span className="text-gray-600 dark:text-slate-400">{entry.name}</span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {((entry.value / finalAmount) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* Dynamic Interval Table Section */}
            <div className="bg-white dark:bg-[#252d3d] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-[#4a6fa5] mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  {frequency === 1 ? "Yearly Breakdown" : frequency === 12 ? "Monthly Breakdown" : frequency === 4 ? "Quarterly Breakdown" : frequency === 365 ? "Daily Breakdown" : frequency === 52 ? "Weekly Breakdown" : "Interval Breakdown"}
                </h3>
                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-slate-400">
                        <thead className="text-xs uppercase bg-gray-50 dark:bg-[#2d3748] text-gray-700 dark:text-slate-300 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">
                                  {frequency === 1 ? "Year" : frequency === 12 ? "Month" : frequency === 4 ? "Quarter" : frequency === 365 ? "Day" : frequency === 52 ? "Week" : "Period"}
                                </th>
                                <th className="px-4 py-3 text-right">Interest</th>
                                <th className="px-4 py-3 text-right">Accrued Interest</th>
                                <th className="px-4 py-3 text-right rounded-tr-lg">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map((row, idx) => {
                                const isLastRow = idx === chartData.length - 1;
                                return (
                                    <tr key={idx} className={`border-b dark:border-[#4a6fa5] last:border-0 hover:bg-gray-50 dark:hover:bg-[#2d3748]/50 transition-colors ${isLastRow ? 'bg-gray-50 dark:bg-[#2d3748]/30' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.periodLabel}</td>
                                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                                            {row.earnedThisPeriod === 0 ? "–" : `+${formatCurrency(row.earnedThisPeriod)}`}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                            {row.interest === 0 ? "–" : `+${formatCurrency(row.interest)}`}
                                        </td>
                                        <td className={`px-4 py-3 text-right text-gray-900 dark:text-white ${isLastRow ? 'font-bold text-lg' : 'font-medium'}`}>
                                            {formatCurrency(row.amount)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
