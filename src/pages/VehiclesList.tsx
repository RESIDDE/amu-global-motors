import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { PlusCircle, Search, Eye, Pencil, Trash2, Download, FileText, Printer, Car, ListFilter, DollarSign, Wrench, BarChart3, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, exportToJSON, printTable } from "@/lib/exportHelpers";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from "recharts";
import { useMemo } from "react";
import { format, subMonths, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(199 89% 48%)", "hsl(142 76% 36%)", "hsl(38 92% 50%)", "hsl(262 83% 58%)", "hsl(0 84% 60%)"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium flex justify-between gap-4" style={{ color: entry.color || entry.fill }}>
            <span>{entry.name}:</span> 
            <span>{entry.name.toLowerCase().includes('value') || entry.name.toLowerCase().includes('price') ? `₦${entry.value.toLocaleString()}` : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PAGE_SIZE = 20;

export default function VehiclesList() {
  const { role } = useAuth();
  const hasEdit = canEdit(role, "vehicles");

  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const fleet = vehicles.filter(v => v.status !== "Customer Car");
    const totalCount = fleet.length;
    const availableCount = fleet.filter(v => v.status?.toLowerCase() === "available").length;
    const repairCount = fleet.filter(v => v.status?.toLowerCase() === "under repair").length;
    const totalInventoryValue = fleet.filter(v => v.status?.toLowerCase() === "available").reduce((sum, v) => sum + Number(v.price || 0), 0);
    
    // Average price
    const avgPrice = availableCount > 0 ? totalInventoryValue / availableCount : 0;

    // Recent Additions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAdditions = fleet.filter(v => new Date(v.created_at) >= thirtyDaysAgo).length;

    // Make Distribution
    const makesMap = fleet.reduce((acc: Record<string, number>, v) => {
      acc[v.make] = (acc[v.make] || 0) + 1;
      return acc;
    }, {});
    const makeData = Object.entries(makesMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Condition Distribution
    const conditionMap = fleet.reduce((acc: Record<string, number>, v) => {
      const cond = (v as any).condition || "Unknown";
      acc[cond] = (acc[cond] || 0) + 1;
      return acc;
    }, {});
    const conditionData = Object.entries(conditionMap).map(([name, value]) => ({ name, value }));

    // Status Distribution
    const statusMap = fleet.reduce((acc: Record<string, number>, v) => {
      const s = v.status || "Unknown";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Monthly arrivals
    const monthlyTrend: { name: string; Arrivals: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const count = fleet.filter(v => {
        const arrivalDate = new Date((v as any).date_arrived || v.created_at);
        return isWithinInterval(arrivalDate, { start, end });
      }).length;
      monthlyTrend.push({ 
        name: format(d, "MMM"), 
        Arrivals: count 
      });
    }

    return {
      totalCount,
      availableCount,
      repairCount,
      totalInventoryValue,
      avgPrice,
      recentAdditions,
      makeData,
      conditionData,
      statusData,
      monthlyTrend
    };
  }, [vehicles]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
      await logAction("DELETE", "Vehicle", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted successfully");
    },
    onError: () => toast.error("Failed to delete vehicle"),
  });

  const filtered = vehicles.filter((v) => {
    // Hide customer cars from the main sales fleet view
    if (v.status === "Customer Car") return false;

    const q = search.toLowerCase();
    const matchesSearch = !q || v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || (v.vin && v.vin.toLowerCase().includes(q)) || ((v as any).source_company && (v as any).source_company.toLowerCase().includes(q));
    const matchesCondition = conditionFilter === "all" || (v as any).condition === conditionFilter;
    return matchesSearch && matchesCondition;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportCSV = () => {
    const rows = filtered.map((v) => ({
      Make: v.make, Model: v.model, Year: v.year, VIN: v.vin || "", Color: (v as any).color || "",
      Price: v.price, "Cost Price": (v as any).cost_price || "", Status: v.status, Condition: (v as any).condition || "",
      "Source Company": (v as any).source_company || "", "Date Arrived": (v as any).date_arrived || "",
    }));
    exportToCSV(rows, "vehicles_export");
  };

  const handleExportJSON = () => exportToJSON(filtered, "vehicles_export");

  const handlePrint = () => {
    const rows = filtered.map((v) => ({
      vehicle: `${v.year} ${v.make} ${v.model}`, vin: v.vin || "—", price: `₦${Number(v.price).toLocaleString()}`,
      status: v.status, condition: (v as any).condition || "—",
    }));
    printTable("Vehicles Inventory — AMU Global Motors", rows, [
      { key: "vehicle", label: "Vehicle" }, { key: "vin", label: "VIN" },
      { key: "price", label: "Price" }, { key: "status", label: "Status" }, { key: "condition", label: "Condition" },
    ]);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      {/* Dashboard Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 md:gap-6 items-stretch">
        {/* KPI Cards */}
        <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bento-card p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-sky-500/10 rounded-xl"><Car className="h-4 w-4 text-sky-500" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Fleet</span>
            </div>
            <h3 className="text-3xl font-bold">{stats.totalCount}</h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{stats.availableCount} Available</p>
          </div>

          <div className="bento-card p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl"><DollarSign className="h-4 w-4 text-emerald-500" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Value</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold truncate">₦{stats.totalInventoryValue >= 1000000 ? (stats.totalInventoryValue / 1000000).toFixed(1) + 'M' : stats.totalInventoryValue.toLocaleString()}</h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Market Value</p>
          </div>

          <div className="bento-card p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-500/10 rounded-xl"><Wrench className="h-4 w-4 text-amber-500" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Repairs</span>
            </div>
            <h3 className="text-3xl font-bold">{stats.repairCount}</h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Under Maintenance</p>
          </div>

          <div className="bento-card p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-violet-500/10 rounded-xl"><TrendingUp className="h-4 w-4 text-violet-500" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</span>
            </div>
            <h3 className="text-3xl font-bold">{stats.recentAdditions}</h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium">New Arrivals (30d)</p>
          </div>

          {/* Monthly Trend Area Chart - 8 Cols within this section */}
          <div className="col-span-2 md:col-span-4 bento-card p-6 h-[220px]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-sky-500" /> Inventory Growth
              </h4>
              <span className="text-[10px] bg-sky-500/10 text-sky-500 px-2 py-0.5 rounded-full font-bold">LAST 6 MONTHS</span>
            </div>
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorArrivals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Arrivals" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorArrivals)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Distribution Charts */}
        <div className="lg:col-span-4 grid grid-cols-1 gap-4">
          <div className="bento-card p-5 flex flex-col">
            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><PieChartIcon className="w-3.5 h-3.5 text-violet-500" /> Top Brands</h4>
            <div className="flex-1 h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.makeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4}>
                    {stats.makeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {stats.makeData.slice(0, 4).map((m, i) => (
                <div key={m.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-[10px] font-medium truncate">{m.name} ({m.value})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card p-5 flex flex-col">
            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><ListFilter className="w-3.5 h-3.5 text-emerald-500" /> Fleet Condition</h4>
            <div className="space-y-3">
              {stats.conditionData.map((c, i) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">{c.value} Vehicles</span>
                  </div>
                  <div className="h-1.5 w-full bg-foreground/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${(c.value / stats.totalCount) * 100}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-8">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Car className="w-4 h-4 text-sky-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-sky-500">Fleet Management</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            Inventory List
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg" className="rounded-2xl glass-panel border-white/10 hover:bg-white/5 transition-all">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
              <DropdownMenuItem onClick={handleExportCSV} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export to CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export to JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} className="rounded-lg cursor-pointer text-primary"><Printer className="mr-2 h-4 w-4" /> Print / PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild size="lg" className="rounded-2xl shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all bg-sky-500 hover:bg-sky-600">
            <Link to="/vehicles/new">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Vehicle
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters Control Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent pointer-events-none" />
        <div className="relative w-full sm:w-80 group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-sky-500 transition-colors" />
          <Input 
            placeholder="Search by name, model, VIN..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-sky-500/50 transition-all font-medium text-sm w-full"
          />
        </div>
        <div className="relative z-10 w-full sm:w-auto flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <Select value={conditionFilter} onValueChange={(v) => { setConditionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl bg-background/50 border-white/10">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent className="glass-panel rounded-xl">
              <SelectItem value="all">All Conditions</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Used">Used</SelectItem>
              <SelectItem value="Damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:ml-auto z-10">
           <span className="text-sm font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-white/5">
             {filtered.length} Results
           </span>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-card/40 animate-pulse" />)}
        </div>
      ) : paged.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-sky-500/10 p-5 rounded-full mb-4">
            <Car className="h-10 w-10 text-sky-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No vehicles found.</h2>
          <p className="text-muted-foreground max-w-sm mb-6">We couldn't find any vehicles matching your current search criteria.</p>
          <Button variant="outline" onClick={() => {setSearch(''); setConditionFilter('all')}} className="rounded-xl">Clear Filters</Button>
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader className="bg-foreground/5 pointer-events-none">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold px-6 py-4">Vehicle</TableHead>
                  <TableHead className="font-semibold">Year</TableHead>
                  <TableHead className="font-semibold">Chassis (VIN)</TableHead>
                  <TableHead className="font-semibold">Condition</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((v) => (
                  <TableRow key={v.id} className="border-border/10 hover:bg-white/5 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded-lg bg-foreground/5 group-hover:bg-sky-500/10 transition-colors">
                           <Car className="h-4 w-4 text-sky-500" />
                         </div>
                         <span className="font-semibold text-sm transition-colors group-hover:text-primary">{v.make} {v.model}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{v.year}</TableCell>
                    <TableCell>
                      {v.vin ? <span className="font-mono text-xs bg-foreground/5 px-2 py-1 rounded-md">{v.vin}</span> : <span className="opacity-50">—</span>}
                    </TableCell>
                    <TableCell>{(v as any).condition || "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate" title={(v as any).source_company}>{(v as any).source_company || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(v as any).date_arrived ? new Date((v as any).date_arrived).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        v.status?.toLowerCase() === 'available' ? 'bg-emerald-500/10 text-emerald-500' : 
                        v.status?.toLowerCase() === 'sold' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {v.status || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg hover:bg-primary/20 hover:text-primary"><Link to={`/vehicles/${v.id}`}><Eye className="h-4 w-4" /></Link></Button>
                        {hasEdit && (
                          <>
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg hover:bg-foreground/20"><Link to={`/vehicles/${v.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden flex flex-col">
            {paged.map((v, i) => (
              <div key={v.id} className={`p-5 flex flex-col gap-4 ${i !== paged.length -1 ? 'border-b border-border/10' : ''}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3">
                     <div className="p-2 rounded-xl bg-sky-500/10 shrink-0">
                       <Car className="h-5 w-5 text-sky-500" />
                     </div>
                     <div>
                       <p className="font-semibold text-foreground text-sm">{v.year} {v.make} {v.model}</p>
                       {v.vin && <p className="text-xs text-muted-foreground font-mono mt-1 w-full overflow-hidden text-ellipsis">VIN: {v.vin}</p>}
                     </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                    v.status?.toLowerCase() === 'available' ? 'bg-emerald-500/10 text-emerald-500' : 
                    v.status?.toLowerCase() === 'sold' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {v.status || "Unknown"}
                  </span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border/10 justify-between items-center">
                  <span className="text-xs text-muted-foreground font-medium">{(v as any).condition || "Unknown Cond."}</span>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" asChild className="h-8 text-xs rounded-lg border-white/10"><Link to={`/vehicles/${v.id}`}>View</Link></Button>
                    {hasEdit && (
                      <>
                        <Button variant="outline" size="sm" asChild className="h-8 text-xs rounded-lg border-white/10"><Link to={`/vehicles/${v.id}/edit`}>Edit</Link></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)} className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-6 border-t border-border/10">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => page > 0 && setPage(page - 1)}
                      className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i} className="hidden sm:block">
                      <PaginationLink 
                        isActive={page === i}
                        onClick={() => setPage(i)}
                        className="cursor-pointer"
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => page < totalPages - 1 && setPage(page + 1)}
                      className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <div className="text-center mt-4 text-xs text-muted-foreground sm:hidden">
                Page {page + 1} of {totalPages}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl glass-panel border-white/10 p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              Are you absolutely sure you want to delete this vehicle? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl border-white/10 text-foreground hover:bg-white/5 sm:mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 border-none">
              Delete Vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
