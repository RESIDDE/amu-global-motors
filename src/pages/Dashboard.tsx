import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Car, Users, DollarSign, Wrench, PlusCircle, Search, ChevronRight, 
  TrendingUp, Calendar, ArrowUpRight, BarChart3, Clock, PieChart as PieChartIcon
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area
} from "recharts";
import { differenceInDays } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(0 84% 60%)", "hsl(262 83% 58%)", "hsl(38 92% 50%)", "hsl(199 89% 48%)"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50 min-w-[150px]">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => {
          let val = entry.value;
          if (entry.name.toLowerCase().includes('revenue') || entry.name.toLowerCase().includes('price') || entry.name.toLowerCase().includes('profit')) {
             val = `₦${entry.value.toLocaleString()}`;
          }
          if (entry.name.toLowerCase().includes('time')) {
             val = `${entry.value} days`;
          }
          return (
            <p key={index} className="text-sm font-medium flex justify-between gap-4" style={{ color: entry.color || entry.fill }}>
              <span>{entry.name}:</span> <span>{val}</span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const { data: vehicles = [], isLoading: loadingV } = useQuery({
    queryKey: ["dash-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["dash-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales = [], isLoading: loadingS } = useQuery({
    queryKey: ["dash-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, vehicles(make, model, cost_price)");
      if (error) throw error;
      return data;
    },
  });

  const { data: repairs = [], isLoading: loadingR } = useQuery({
    queryKey: ["dash-repairs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("repairs").select("*");
      if (error) throw error;
      return data;
    },
  });

  const totalSalesRevenue = sales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0);
  const totalRepairsRevenue = repairs.reduce((sum, r) => sum + Number(r.repair_cost || 0), 0);
  const totalRevenue = totalSalesRevenue + totalRepairsRevenue;

  // 1. Monthly Revenue Trend (Last 6 Months)
  const monthlyTimeline = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString("default", { month: "short" });
      const y = d.getFullYear(); const m = d.getMonth();
      
      const sRev = sales.filter(s => new Date(s.sale_date || s.created_at).getMonth() === m && new Date(s.sale_date || s.created_at).getFullYear() === y).reduce((sum, s) => sum + Number(s.sale_price || 0), 0);
      const rRev = repairs.filter(r => new Date(r.created_at).getMonth() === m && new Date(r.created_at).getFullYear() === y).reduce((sum, r) => sum + Number(r.repair_cost || 0), 0);
      
      months.push({ name: label, "Sales Revenue": sRev, "Repairs Revenue": rRev, "Total Revenue": sRev + rRev });
    }
    return months;
  }, [sales, repairs]);

  // 2. Profit Margin per Sold Vehicle (Top 5 Recent)
  const profitMarginData = useMemo(() => {
    return sales
      .filter(s => s.vehicles && s.vehicles.cost_price != null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(s => {
         const cost = Number(s.vehicles?.cost_price || 0);
         const sale = Number(s.sale_price || 0);
         return {
           name: `${s.vehicles?.make} ${s.vehicles?.model}`.substring(0, 15),
           Cost: cost,
           Profit: sale - cost,
         };
      });
  }, [sales]);

  // 3. Repair Turnaround Time
  const turnaroundWait = useMemo(() => {
     const completed = repairs.filter(r => r.payment_status === 'paid_in_full');
     if (completed.length === 0) return 0;
     const days = completed.map(r => differenceInDays(new Date(r.updated_at), new Date(r.created_at)));
     const avg = days.reduce((a, b) => a + b, 0) / completed.length;
     return avg < 1 ? 1 : Math.round(avg);
  }, [repairs]);

  // 4. Inventory Aging
  const inventoryAging = useMemo(() => {
     const unsold = vehicles.filter(v => v.status !== 'sold');
     const aging = { "0-30 days": 0, "31-60 days": 0, "61-90 days": 0, "90+ days": 0 };
     unsold.forEach(v => {
       const days = differenceInDays(new Date(), new Date(v.created_at));
       if (days <= 30) aging["0-30 days"]++;
       else if (days <= 60) aging["31-60 days"]++;
       else if (days <= 90) aging["61-90 days"]++;
       else aging["90+ days"]++;
     });
     return Object.entries(aging).map(([name, Count]) => ({ name, Count }));
  }, [vehicles]);

  // 5. Sales vs Repairs Revenue
  const revSplit = [
    { name: "Vehicle Sales", value: totalSalesRevenue },
    { name: "Service & Repairs", value: totalRepairsRevenue }
  ].filter(x => x.value > 0);

  // 6. Top Selling Makes
  const topMakes = useMemo(() => {
     const makes = (sales || []).reduce((acc, s) => {
       const make = (s as any).vehicles?.make || 'Unknown';
       acc[make] = (acc[make] || 0) + 1;
       return acc;
     }, {} as Record<string, number>);
     const entries = Object.entries(makes) as [string, number][];
     return entries.sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [sales]);

  const filteredVehicles = vehicles
    .filter((v) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || v.year.toString().includes(q));
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const currentDateInfo = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-up pb-10">
      <svg width="0" height="0">
        <defs>
          <linearGradient id="splitSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/></linearGradient>
          <linearGradient id="splitRepairs" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.8}/><stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0.1}/></linearGradient>
        </defs>
      </svg>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{currentDateInfo}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            {greeting}!
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
            Here's what's happening with your dealership today. Review your latest insights and performance tracking below.
          </p>
        </div>
        <Button asChild size="lg" className="rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all group shrink-0">
          <Link to="/vehicles/new"><PlusCircle className="mr-2 h-5 w-5 group-hover:rotate-90 transition-transform duration-300" /> Add Vehicle</Link>
        </Button>
      </div>

      {(loadingV || loadingS || loadingR) ? (
        <div className="h-64 rounded-3xl bg-card/40 animate-pulse border border-white/5" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 md:gap-6 auto-rows-max">

          {/* MAIN KPI PANEL - 8 Cols */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 relative">
            <Link to="/sales" className="md:col-span-2 group">
              <div className="bento-card h-full p-6 sm:p-8 flex flex-col justify-between overflow-hidden relative min-h-[160px]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 blur-3xl rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors duration-500"></div>
                <div className="flex justify-between items-start z-10 relative">
                  <div className="p-3 bg-primary/10 rounded-2xl"><DollarSign className="h-6 w-6 text-primary" /></div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full"><TrendingUp className="w-3 h-3" /> Total Revenue</div>
                </div>
                <div className="mt-6 z-10 relative">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Company Lifetime Revenue</p>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight truncate" title={`₦${totalRevenue.toLocaleString()}`}>₦{totalRevenue.toLocaleString()}</h2>
                </div>
              </div>
            </Link>

            <Link to="/sales" className="md:col-span-1 group">
               <div className="bento-card p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden h-full min-h-[160px]">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-2xl rounded-full pointer-events-none transition-colors duration-500 group-hover:bg-violet-500/20" />
                 <div className="p-2 sm:p-3 bg-violet-500/10 w-fit rounded-xl sm:rounded-2xl mb-2 sm:mb-4 group-hover:bg-violet-500/20"><DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-violet-500" /></div>
                 <div className="z-10 relative">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">₦{totalSalesRevenue >= 1000000 ? (totalSalesRevenue / 1000000).toFixed(1) + 'M' : totalSalesRevenue >= 1000 ? (totalSalesRevenue / 1000).toFixed(1) + 'k' : totalSalesRevenue}</h2>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1 sm:mt-2 font-semibold line-clamp-1">Sales Rev.</p>
                 </div>
               </div>
            </Link>

            <Link to="/repairs" className="md:col-span-1 group">
               <div className="bento-card p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden h-full min-h-[160px]">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-2xl rounded-full pointer-events-none transition-colors duration-500 group-hover:bg-amber-500/20" />
                 <div className="p-2 sm:p-3 bg-amber-500/10 w-fit rounded-xl sm:rounded-2xl mb-2 sm:mb-4 group-hover:bg-amber-500/20"><Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" /></div>
                 <div className="z-10 relative">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">₦{totalRepairsRevenue >= 1000000 ? (totalRepairsRevenue / 1000000).toFixed(1) + 'M' : totalRepairsRevenue >= 1000 ? (totalRepairsRevenue / 1000).toFixed(1) + 'k' : totalRepairsRevenue}</h2>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1 sm:mt-2 font-semibold line-clamp-1">Repairs Rev.</p>
                 </div>
               </div>
            </Link>

            <div className="md:col-span-1 bento-card p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group h-full min-h-[160px]">
               <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-2xl rounded-full pointer-events-none transition-colors duration-500 group-hover:bg-sky-500/20" />
               <div className="p-2 sm:p-3 bg-sky-500/10 w-fit rounded-xl sm:rounded-2xl mb-2 sm:mb-4 group-hover:bg-sky-500/20"><Clock className="h-5 w-5 sm:h-6 sm:w-6 text-sky-500" /></div>
               <div className="z-10 relative">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">{turnaroundWait} <span className="text-sm sm:text-lg text-muted-foreground font-medium">days</span></h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1 sm:mt-2 font-semibold line-clamp-1">Avg Turnaround</p>
               </div>
            </div>

            {/* MONTHLY REVENUE LINE CHART - 4 Cols */}
            <div className="md:col-span-4 bento-card p-6 flex flex-col min-h-[350px]">
              <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" /> Revenue Growth</h3>
                    <p className="text-sm text-muted-foreground">Sales & Service combined over last 6 months</p>
                  </div>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground)/0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${(v/1000)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Sales Revenue" stroke="hsl(var(--primary))" fill="url(#splitSales)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Repairs Revenue" stroke="hsl(38 92% 50%)" fill="url(#splitRepairs)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inventory Aging - 2 Cols */}
            <div className="md:col-span-2 bento-card p-6 flex flex-col min-h-[280px]">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-1"><Car className="w-4 h-4 text-sky-500" /> Inventory Aging</h3>
              <p className="text-sm text-muted-foreground mb-4">Time left in stock for unsold vehicles</p>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={inventoryAging} margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--foreground)/0.05)'}} />
                    <Bar dataKey="Count" fill="hsl(199 89% 48%)" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue Split - 2 Cols */}
            <div className="md:col-span-2 bento-card p-5 flex flex-col items-center min-h-[280px]">
              <h3 className="font-semibold text-sm self-start mb-0 w-full flex items-center gap-2"><PieChartIcon className="w-4 h-4" /> Split</h3>
              {revSplit.length > 0 ? (
                <div className="w-full h-full min-h-[200px] flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                     <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Total</span>
                     <span className="text-lg font-bold">₦{(totalRevenue / 1000000).toFixed(1)}M</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={revSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                        {revSplit.map((_, i) => <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : "hsl(38 92% 50%)"} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground mt-10">No data</p>}
            </div>

            {/* Profit Margin - 4 Cols */}
            <div className="md:col-span-4 bento-card p-6 flex flex-col min-h-[280px]">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-emerald-500" /> Profit Margins</h3>
              <p className="text-sm text-muted-foreground mb-4">Cost vs Profit breakdown for recent sales</p>
              <div className="flex-1 w-full min-h-0">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitMarginData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground)/0.05)" />
                       <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                       <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${(v/1000)}k`} />
                       <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--foreground)/0.05)'}} />
                       <Bar dataKey="Cost" stackId="a" fill="hsl(var(--muted))" barSize={35} radius={[0,0,4,4]} />
                       <Bar dataKey="Profit" stackId="a" fill="hsl(142 76% 36%)" barSize={35} radius={[4,4,0,0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* SIDEBAR PANEL - 4 Cols */}
          <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">
            
            {/* Top Makes Mini-List */}
            <div className="bento-card p-6">
              <h3 className="font-semibold text-lg mb-4">Top Brands Sold</h3>
              <div className="space-y-4">
                 {topMakes.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet.</p> : topMakes.map(([make, count], idx) => (
                    <div key={make} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-foreground/5'}`}>#{idx+1}</div>
                          <span className="font-medium">{make}</span>
                       </div>
                       <span className="text-sm font-semibold text-muted-foreground">{count} {count === 1 ? 'sold' : 'sold'}</span>
                    </div>
                 ))}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <Link to="/vehicles" className="bento-card p-5 group flex flex-col">
                <div className="p-2.5 bg-sky-500/10 w-fit rounded-xl group-hover:bg-sky-500/20 transition-colors mb-3"><Car className="h-5 w-5 text-sky-500" /></div>
                <h3 className="text-2xl font-bold">{vehicles.length}</h3>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Vehicles</p>
              </Link>
              <Link to="/customers" className="bento-card p-5 group flex flex-col">
                <div className="p-2.5 bg-violet-500/10 w-fit rounded-xl group-hover:bg-violet-500/20 transition-colors mb-3"><Users className="h-5 w-5 text-violet-500" /></div>
                <h3 className="text-2xl font-bold">{customers.length}</h3>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Customers</p>
              </Link>
            </div>

            {/* Recent Inventory List */}
            <div className="glass-panel p-0 flex flex-col overflow-hidden bg-card/20 border-white/10 flex-1">
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-card/40">
                <h3 className="font-semibold text-foreground">Recent Imports</h3>
              </div>
              <div className="p-3">
                {filteredVehicles.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-8">Inventory is empty.</p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredVehicles.map((v) => (
                      <Link key={v.id} to={`/vehicles/${v.id}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition-all group border border-transparent hover:border-white/5">
                        <div className="bg-foreground/5 p-2 rounded-xl shrink-0 group-hover:bg-primary/10 transition-colors"><Car className="h-4 w-4 text-foreground/70 group-hover:text-primary" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{v.year} {v.make} {v.model}</p>
                          <p className="text-[11px] text-muted-foreground uppercase">{v.status || "In Stock"}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
