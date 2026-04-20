import { format } from "date-fns";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
import { PlusCircle, Pencil, Trash2, MessageSquare, Car, Users, Search, Eye, Download, FileJson, FileSpreadsheet, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { exportToCSV, exportToJSON, downloadTableAsPDF } from "@/lib/exportHelpers";

const statuses = ["Open", "In Progress", "Closed"];
const emptyForm = { 
  customer_id: "", 
  vehicle_id: "", 
  message: "", 
  status: "Open",
  manual_customer_name: "",
  manual_customer_phone: "",
  manual_customer_email: "",
  manual_vehicle_make: "",
  manual_vehicle_model: "",
  manual_vehicle_year: "",
};

export default function Inquiries() {
  const { role } = useAuth();
  const hasEdit = canEdit(role, "inquiries");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;
  const queryClient = useQueryClient();

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inquiries").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, make, model, year");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, `${v.year} ${v.make} ${v.model}`]));
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));

  const filtered = inquiries.filter((i) => {
    const q = search.toLowerCase();
    const cName = i.customer_id ? (customerMap[i.customer_id] || "").toLowerCase() : (i.manual_customer_name || "").toLowerCase();
    const vName = i.vehicle_id ? (vehicleMap[i.vehicle_id] || "").toLowerCase() : `${i.manual_vehicle_year || ""} ${i.manual_vehicle_make || ""} ${i.manual_vehicle_model || ""}`.toLowerCase();
    const msg = i.message.toLowerCase();
    return !q || cName.includes(q) || vName.includes(q) || msg.includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        customer_id: form.customer_id || null,
        vehicle_id: form.vehicle_id || null,
        message: form.message,
        status: form.status,
      };

      // Only add manual fields if they have values to avoid schema issues if columns don't exist yet
      if (form.manual_customer_name) payload.manual_customer_name = form.manual_customer_name;
      if (form.manual_customer_phone) payload.manual_customer_phone = form.manual_customer_phone;
      if (form.manual_customer_email) payload.manual_customer_email = form.manual_customer_email;
      if (form.manual_vehicle_make) payload.manual_vehicle_make = form.manual_vehicle_make;
      if (form.manual_vehicle_model) payload.manual_vehicle_model = form.manual_vehicle_model;
      if (form.manual_vehicle_year) payload.manual_vehicle_year = form.manual_vehicle_year;
      if (editId) {
        const { error } = await supabase.from("inquiries").update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inquiries").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast.success(editId ? "Inquiry updated" : "Inquiry added");
      closeDialog();
    },
    onError: (error: any) => {
      console.error("Save inquiry error:", error);
      toast.error(`Failed to save inquiry: ${error.message || "Unknown error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inquiries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast.success("Inquiry deleted");
    },
    onError: () => toast.error("Failed to delete inquiry"),
  });

  const handleExport = async (type: "csv" | "json" | "pdf") => {
    const exportData = filtered.map(i => ({
      Customer: i.customer_id ? (customerMap[i.customer_id] || "Unknown") : (i.manual_customer_name || "—"),
      Contact: (!i.customer_id && (i.manual_customer_phone || i.manual_customer_email)) 
        ? `${i.manual_customer_phone || ""} ${i.manual_customer_email || ""}`.trim() 
        : "—",
      Vehicle: i.vehicle_id ? (vehicleMap[i.vehicle_id] || "—") : 
        (i.manual_vehicle_make ? `${i.manual_vehicle_year || ""} ${i.manual_vehicle_make} ${i.manual_vehicle_model || ""}` : "—"),
      Message: i.message,
      Status: i.status,
      Date: format(new Date(i.created_at), "yyyy-MM-dd HH:mm")
    }));

    if (type === "csv") {
      exportToCSV(exportData, "inquiries_export");
    } else if (type === "json") {
      exportToJSON(exportData, "inquiries_export");
    } else {
      const columns = [
        { key: "Customer", label: "Customer" },
        { key: "Vehicle", label: "Vehicle Interest" },
        { key: "Status", label: "Status" },
        { key: "Date", label: "Date" }
      ];
      await downloadTableAsPDF("Customer Inquiries", exportData, columns);
    }
  };

  const closeDialog = () => { setDialogOpen(false); setEditId(null); setForm(emptyForm); };

  const openEdit = (i: any) => {
    setEditId(i.id);
    setForm({
      customer_id: i.customer_id || "",
      vehicle_id: i.vehicle_id || "",
      message: i.message,
      status: i.status,
      manual_customer_name: i.manual_customer_name || "",
      manual_customer_phone: i.manual_customer_phone || "",
      manual_customer_email: i.manual_customer_email || "",
      manual_vehicle_make: i.manual_vehicle_make || "",
      manual_vehicle_model: i.manual_vehicle_model || "",
      manual_vehicle_year: i.manual_vehicle_year || "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-indigo-500">Support & Leads</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            Inquiries
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
            Track customer requests, messages, and vehicle interest logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg" className="rounded-2xl border-white/10 hover:bg-white/5">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass-panel border-white/10 rounded-xl">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer">
                <FileJson className="mr-2 h-4 w-4 text-amber-500" /> Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                <Printer className="mr-2 h-4 w-4 text-indigo-500" /> Print / Save PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }} size="lg" className="rounded-2xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all bg-indigo-500 hover:bg-indigo-600 text-white">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Inquiry
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent pointer-events-none" />
        <div className="relative w-full group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
          <Input 
            placeholder="Search by customer, vehicle, or inquiry content..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-indigo-500/50 transition-all font-medium text-sm w-full"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-indigo-500/10 p-5 rounded-full mb-4">
            <MessageSquare className="h-10 w-10 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No inquiries yet.</h2>
          <p className="text-muted-foreground max-w-sm mb-6">There are currently no active messages from customers.</p>
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }} className="rounded-xl shadow-lg shadow-indigo-500/20 bg-indigo-500 hover:bg-indigo-600 text-white">Add Inquiry</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader className="bg-foreground/5 pointer-events-none">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-semibold px-6 py-4">Customer</TableHead>
                    <TableHead className="font-semibold">Vehicle Interest</TableHead>
                    <TableHead className="font-semibold">Message</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((i) => (
                    <TableRow key={i.id} className="border-border/10 hover:bg-white/5 transition-colors group">
                        <TableCell className="px-6 py-4">
                           <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                 <Users className="h-4 w-4 text-muted-foreground" />
                                 <span className="font-semibold text-sm transition-colors group-hover:text-indigo-500">
                                   {i.customer_id ? (customerMap[i.customer_id] || "—") : (i.manual_customer_name || "—")}
                                 </span>
                              </div>
                              {(!i.customer_id && (i.manual_customer_phone || i.manual_customer_email)) && (
                                <span className="text-[10px] text-muted-foreground ml-6">
                                  {i.manual_customer_phone} {i.manual_customer_email && `| ${i.manual_customer_email}`}
                                </span>
                              )}
                           </div>
                        </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                            {(i.vehicle_id || i.manual_vehicle_make) ? <Car className="h-4 w-4 text-muted-foreground" /> : null}
                            <span className="text-sm">
                              {i.vehicle_id ? (vehicleMap[i.vehicle_id] || "—") : 
                               (i.manual_vehicle_make ? `${i.manual_vehicle_year || ""} ${i.manual_vehicle_make} ${i.manual_vehicle_model || ""}` : "—")
                              }
                            </span>
                         </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">{i.message}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                          i.status === "Open" ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20" :
                          i.status === "In Progress" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                          "bg-muted/50 text-muted-foreground border border-white/5"
                        }`}>{i.status}</span>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => setViewId(i.id)} className="h-8 w-8 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-500">
                             <Eye className="h-4 w-4" />
                          </Button>
                          {hasEdit && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(i)} className="h-8 w-8 rounded-lg hover:bg-foreground/20">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(i.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

      <Dialog open={!!viewId} onOpenChange={(open) => { if (!open) setViewId(null); }}>
        <DialogContent className="max-w-lg rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-indigo-500/5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-400">
                <MessageSquare className="h-5 w-5" /> Inquiry Details
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-6">
            {viewId && (
              <>
                <div className="grid grid-cols-2 gap-6 pb-6 border-b border-white/5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</Label>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-500" />
                      <span className="font-bold text-sm">
                        {(() => {
                          const i = inquiries.find(x => x.id === viewId);
                          return i?.customer_id ? (customerMap[i.customer_id] || "—") : (i?.manual_customer_name || "—");
                        })()}
                      </span>
                    </div>
                    {(() => {
                      const i = inquiries.find(x => x.id === viewId);
                      return (!i?.customer_id && (i?.manual_customer_phone || i?.manual_customer_email)) && (
                        <p className="text-xs text-muted-foreground pl-6">
                          {i.manual_customer_phone} {i.manual_customer_email && `| ${i.manual_customer_email}`}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inquiry Date</Label>
                    <p className="text-sm font-medium">
                      {format(new Date(inquiries.find(x => x.id === viewId)?.created_at), "PPP p")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Vehicle Interest</Label>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        inquiries.find(x => x.id === viewId)?.status === "Open" ? "bg-indigo-500/20 text-indigo-400" :
                        inquiries.find(x => x.id === viewId)?.status === "In Progress" ? "bg-amber-500/20 text-amber-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {inquiries.find(x => x.id === viewId)?.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold">
                        {(() => {
                          const i = inquiries.find(x => x.id === viewId);
                          return i?.vehicle_id ? (vehicleMap[i.vehicle_id] || "—") : 
                            (i?.manual_vehicle_make ? `${i.manual_vehicle_year || ""} ${i.manual_vehicle_make} ${i.manual_vehicle_model || ""}` : "No specific vehicle");
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Message Transcript</Label>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-sm leading-relaxed whitespace-pre-wrap min-h-[100px]">
                      {inquiries.find(x => x.id === viewId)?.message}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="p-6 border-t border-white/5 bg-foreground/5 flex justify-end">
            <Button onClick={() => setViewId(null)} className="rounded-xl px-8 shadow-lg shadow-indigo-500/20 bg-indigo-500 hover:bg-indigo-600 text-white">Close View</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-foreground/5 pointer-events-none">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editId ? "Edit Inquiry Details" : "Log New Inquiry"}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-4 p-4 rounded-2xl bg-foreground/[0.03] border border-white/5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-indigo-500">Customer Details</Label>
                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setForm({ ...form, customer_id: "", manual_customer_name: "", manual_customer_phone: "", manual_customer_email: "" })}
                     className="text-[10px] font-bold uppercase text-muted-foreground hover:text-indigo-500 transition-colors"
                   >
                     {form.customer_id || (form.manual_customer_name) ? "Reset" : ""}
                   </button>
                </div>
              </div>

              {!form.manual_customer_name && !form.manual_customer_phone && !form.manual_customer_email ? (
                <div className="space-y-3">
                  <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                    <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-indigo-500"><SelectValue placeholder="Select existing customer" /></SelectTrigger>
                    <SelectContent className="glass-panel rounded-xl">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!form.customer_id && (
                    <p className="text-[10px] text-muted-foreground text-center">or start typing below for manual entry</p>
                  )}
                </div>
              ) : null}

              {(!form.customer_id || form.manual_customer_name) && (
                <div className="space-y-3">
                  <Input 
                    placeholder="Manual Customer Name" 
                    value={form.manual_customer_name || ""} 
                    onChange={(e) => setForm({ ...form, manual_customer_name: e.target.value, customer_id: "" })} 
                    className="rounded-xl h-10 bg-background/50 border-white/10"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input 
                      placeholder="Phone Number" 
                      value={form.manual_customer_phone || ""} 
                      onChange={(e) => setForm({ ...form, manual_customer_phone: e.target.value, customer_id: "" })} 
                      className="rounded-xl h-10 bg-background/50 border-white/10"
                    />
                    <Input 
                      placeholder="Email Address" 
                      value={form.manual_customer_email || ""} 
                      onChange={(e) => setForm({ ...form, manual_customer_email: e.target.value, customer_id: "" })} 
                      className="rounded-xl h-10 bg-background/50 border-white/10"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 p-4 rounded-2xl bg-foreground/[0.03] border border-white/5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-indigo-500">Vehicle Details</Label>
                <button 
                   onClick={() => setForm({ ...form, vehicle_id: "", manual_vehicle_make: "", manual_vehicle_model: "", manual_vehicle_year: "" })}
                   className="text-[10px] font-bold uppercase text-muted-foreground hover:text-indigo-500 transition-colors"
                >
                   {form.vehicle_id || (form.manual_vehicle_make) ? "Reset" : ""}
                </button>
              </div>

              {!form.manual_vehicle_make && !form.manual_vehicle_model && !form.manual_vehicle_year ? (
                <div className="space-y-3">
                  <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                    <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-indigo-500"><SelectValue placeholder="Select existing vehicle" /></SelectTrigger>
                    <SelectContent className="glass-panel rounded-xl">
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="rounded-lg">{v.year} {v.make} {v.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!form.vehicle_id && (
                    <p className="text-[10px] text-muted-foreground text-center">or start typing below for manual entry</p>
                  )}
                </div>
              ) : null}

              {(!form.vehicle_id || form.manual_vehicle_make) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Input 
                      placeholder="Year" 
                      value={form.manual_vehicle_year || ""} 
                      onChange={(e) => setForm({ ...form, manual_vehicle_year: e.target.value, vehicle_id: "" })} 
                      className="rounded-xl h-10 bg-background/50 border-white/10"
                    />
                    <Input 
                      placeholder="Make (e.g. Toyota)" 
                      value={form.manual_vehicle_make || ""} 
                      onChange={(e) => setForm({ ...form, manual_vehicle_make: e.target.value, vehicle_id: "" })} 
                      className="rounded-xl h-10 bg-background/50 border-white/10"
                    />
                    <Input 
                      placeholder="Model" 
                      value={form.manual_vehicle_model || ""} 
                      onChange={(e) => setForm({ ...form, manual_vehicle_model: e.target.value, vehicle_id: "" })} 
                      className="rounded-xl h-10 bg-background/50 border-white/10"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message *</Label>
              <Textarea className="rounded-xl min-h-[100px] bg-background/50 border-white/10 focus-visible:ring-indigo-500" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Type the inquiry description here..." />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-indigo-500"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-panel rounded-xl">
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s} className="rounded-lg">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-6 border-t border-white/5 bg-foreground/5 flex justify-end gap-3">
            <Button variant="outline" onClick={closeDialog} className="rounded-xl border-white/10 hover:bg-white/5">Cancel</Button>
            <Button onClick={() => upsertMutation.mutate()} disabled={!form.message || upsertMutation.isPending} className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              {editId ? "Update Inquiry" : "Save Inquiry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl glass-panel border-white/10 p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">Delete Inquiry</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">This action cannot be undone. Any logged information about this inquiry will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl border-white/10 text-foreground hover:bg-white/5 sm:mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 border-none"
            >Delete Forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
