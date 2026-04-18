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
import { PlusCircle, Search, Eye, Pencil, Trash2, Download, FileText, Printer, Car, ListFilter } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, exportToJSON, printTable } from "@/lib/exportHelpers";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";
import { logAction } from "@/lib/logger";

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
    printTable("Vehicles Inventory — Beetee Autos", rows, [
      { key: "vehicle", label: "Vehicle" }, { key: "vin", label: "VIN" },
      { key: "price", label: "Price" }, { key: "status", label: "Status" }, { key: "condition", label: "Condition" },
    ]);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Car className="w-4 h-4 text-sky-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-sky-500">Fleet Management</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            Vehicles
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
            View, add, and manage your vehicle inventory.
          </p>
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
