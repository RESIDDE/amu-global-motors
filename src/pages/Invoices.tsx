import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { getPrintFooterHTML } from "@/components/PrintFooter";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, FileText, Printer, Trash2, Receipt, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";

export default function Invoices() {
  const { role } = useAuth();
  const hasEdit = canEdit(role, "invoices");

  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12; // 3x4 grid

  const [form, setForm] = useState({
    customer_id: "",
    sale_id: "",
    invoice_type: "sale" as string,
    notes: "",
    due_date: "",
    selectedRepairs: [] as string[],
  });

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create") {
      const customerId = searchParams.get("customer_id") || "";
      const saleId = searchParams.get("sale_id") || "";
      const repairId = searchParams.get("repair_id") || "";
      const type = searchParams.get("type") || "sale";
      setForm({
        customer_id: customerId,
        sale_id: saleId,
        invoice_type: type,
        notes: "",
        due_date: "",
        selectedRepairs: repairId ? [repairId] : [],
      });
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: invoiceRepairLinks = [] } = useQuery({
    queryKey: ["invoice-repair-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoice_repairs").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, email, address");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, vehicles:vehicle_id(make, model, year)");
      if (error) throw error;
      return data;
    },
  });

  const { data: repairs = [] } = useQuery({
    queryKey: ["repairs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("repairs").select("*, vehicles(make, model, year)");
      if (error) throw error;
      return data;
    },
  });

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const invNum = inv.invoice_number.toLowerCase();
    const custName = (customerMap[inv.customer_id]?.name || "").toLowerCase();
    return !q || invNum.includes(q) || custName.includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const createInvoice = useMutation({
    mutationFn: async () => {
      const sale = sales.find((s) => s.id === form.sale_id);
      const selectedRepairData = repairs.filter((r) => form.selectedRepairs.includes(r.id));
      const saleTotal = sale ? Number(sale.sale_price) : 0;
      const repairTotal = selectedRepairData.reduce((s, r) => s + Number(r.repair_cost || 0), 0);
      const subtotal = saleTotal + repairTotal;
      const total = subtotal;

      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const { data: inv, error } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        customer_id: form.customer_id,
        sale_id: form.sale_id || null,
        invoice_type: form.invoice_type,
        subtotal, tax: 0, total,
        notes: form.notes || null,
        due_date: form.due_date || null,
      }).select().single();
      if (error) throw error;

      if (form.selectedRepairs.length > 0) {
        const links = form.selectedRepairs.map((rid) => ({ invoice_id: inv.id, repair_id: rid }));
        const { error: linkErr } = await supabase.from("invoice_repairs").insert(links);
        if (linkErr) throw linkErr;
      }

      return inv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-repair-links"] });
      toast.success("Invoice created");
      setDialogOpen(false);
      setForm({ customer_id: "", sale_id: "", invoice_type: "sale", notes: "", due_date: "", selectedRepairs: [] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: () => toast.error("Failed to delete invoice"),
  });

  const getRepairLabel = (r: any) => {
    if (r.vehicles) return `${r.vehicles.year} ${r.vehicles.make} ${r.vehicles.model}`;
    if (r.manual_make) return `${r.manual_year || ""} ${r.manual_make} ${r.manual_model || ""}`.trim();
    return "Repair";
  };

  const printInvoice = (inv: any) => {
    const cust = customerMap[inv.customer_id];
    const sale = sales.find((s) => s.id === inv.sale_id);

    const linkedRepairIds = invoiceRepairLinks
      .filter((l) => l.invoice_id === inv.id)
      .map((l) => l.repair_id);
    const linkedRepairs = repairs.filter((r) => linkedRepairIds.includes(r.id));

    const vehicleInfo = sale
      ? `${(sale as any).vehicles?.year || ""} ${(sale as any).vehicles?.make || ""} ${(sale as any).vehicles?.model || ""}`.trim()
      : "";

    const html = `<html><head><title>Invoice ${inv.invoice_number}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a2e; padding-bottom: 20px; margin-bottom: 30px; }
      .company h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 4px; }
      .company p { font-size: 11px; color: #666; }
      .invoice-info { text-align: right; }
      .invoice-info h2 { font-size: 28px; color: #1a1a2e; letter-spacing: 2px; }
      .invoice-info p { font-size: 12px; color: #666; margin-top: 4px; }
      .details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
      .details h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
      .details p { font-size: 13px; line-height: 1.6; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background: #1a1a2e; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
      .totals { text-align: right; margin-top: 10px; }
      .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 6px 0; font-size: 13px; }
      .totals .total-row { font-size: 18px; font-weight: 700; border-top: 2px solid #1a1a2e; padding-top: 10px; margin-top: 6px; }
      .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #999; }
      .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
      .status-draft { background: #fff3e0; color: #e65100; }
      .status-paid { background: #e8f5e9; color: #2e7d32; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    ${getPrintWatermarkHTML()}
    ${getPrintHeaderHTML()}
    <div class="header">
      <div class="company"></div>
      <div class="invoice-info"><h2>INVOICE</h2><p>${inv.invoice_number}</p><p>Date: ${new Date(inv.created_at).toLocaleDateString()}</p>
      ${inv.due_date ? `<p>Due: ${new Date(inv.due_date).toLocaleDateString()}</p>` : ""}
      <p><span class="status ${inv.status === "paid" ? "status-paid" : "status-draft"}">${inv.status.toUpperCase()}</span></p></div>
    </div>
    <div class="details">
      <div><h3>Bill To</h3><p><strong>${cust?.name || "—"}</strong></p>${cust?.phone ? `<p>${cust.phone}</p>` : ""}${cust?.email ? `<p>${cust.email}</p>` : ""}${cust?.address ? `<p>${cust.address}</p>` : ""}</div>
      <div><h3>Invoice Details</h3><p>Type: ${inv.invoice_type === "sale" ? "Vehicle Sale" : inv.invoice_type === "repair" ? "Repair" : "Sale + Repairs"}</p>${vehicleInfo ? `<p>Vehicle: ${vehicleInfo}</p>` : ""}${inv.notes ? `<p>Notes: ${inv.notes}</p>` : ""}</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Details</th><th style="text-align:right">Amount (₦)</th></tr></thead>
      <tbody>
      ${sale ? `<tr><td>1</td><td>Vehicle Sale</td><td>${vehicleInfo}</td><td style="text-align:right">₦${Number(sale.sale_price).toLocaleString()}</td></tr>` : ""}
      ${linkedRepairs.map((r, i) => `<tr><td>${(sale ? 2 : 1) + i}</td><td>Repair Service</td><td>${getRepairLabel(r)} — ${r.damaged_parts || r.replacement_parts || "General repair"}</td><td style="text-align:right">₦${Number(r.repair_cost || 0).toLocaleString()}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Subtotal:</span><span>₦${Number(inv.subtotal).toLocaleString()}</span></div>
      <div class="row total-row"><span>Total Due:</span><span>₦${Number(inv.total).toLocaleString()}</span></div>
    </div>
    <div class="footer"><p>Thank you for your business!</p><p>Beetee Autos — Professional Auto Sales & Services</p></div>
    ${getPrintFooterHTML()}
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  const customerSales = form.customer_id ? sales.filter((s) => s.customer_id === form.customer_id) : [];
  const customerRepairs = form.customer_id ? repairs.filter((r) => (r as any).customer_id === form.customer_id) : [];

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Receipt className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-cyan-500">Finance</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            Invoices
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
            Generate and manage professional invoices for sales and repairs.
          </p>
        </div>
        <div className="shrink-0">
          <Button onClick={() => setDialogOpen(true)} size="lg" className="rounded-2xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all bg-cyan-500 hover:bg-cyan-600 text-white">
            <PlusCircle className="mr-2 h-5 w-5" /> Create Invoice
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />
        <div className="relative w-full group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
          <Input 
            placeholder="Search by invoice number or customer name..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-cyan-500/50 transition-all font-medium text-sm w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {[1, 2, 3].map((n) => <div key={n} className="h-32 rounded-3xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
             <div className="bg-cyan-500/10 p-5 rounded-full mb-4">
               <FileText className="h-10 w-10 text-cyan-500" />
             </div>
             <h2 className="text-xl font-bold mb-2">No invoices created yet.</h2>
             <p className="text-muted-foreground max-w-sm mb-6">Create your first professional invoice for a customer sale or repair.</p>
             <Button onClick={() => setDialogOpen(true)} className="rounded-xl shadow-lg shadow-cyan-500/20 bg-cyan-500 hover:bg-cyan-600 text-white">Create Invoice</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map((inv) => {
              const linkedCount = invoiceRepairLinks.filter((l) => l.invoice_id === inv.id).length;
              return (
                <div key={inv.id} className="bento-card p-6 flex flex-col justify-between group">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="bg-foreground/5 p-3 rounded-2xl group-hover:bg-cyan-500/10 transition-colors shrink-0">
                        <FileText className="h-5 w-5 text-foreground/70 group-hover:text-cyan-500 transition-colors" />
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                          inv.status === "paid" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}>
                        {inv.status}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-lg text-foreground group-hover:text-cyan-500 transition-colors truncate">
                      {inv.invoice_number}
                    </h3>
                    
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-muted-foreground truncate">{customerMap[inv.customer_id]?.name || "Unknown Customer"}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground/60 capitalize bg-foreground/5 px-2 py-1 rounded-lg">{inv.invoice_type}</span>
                        {linkedCount > 0 && <span className="text-xs text-foreground/60 bg-foreground/5 px-2 py-1 rounded-lg">{linkedCount} repair(s)</span>}
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                        ₦{Number(inv.total).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6 pt-4 border-t border-white/5 justify-end">
                    <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-500 text-muted-foreground transition-all" onClick={() => printInvoice(inv)}>
                      <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                    </Button>
                    {hasEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" onClick={() => setDeleteId(inv.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="glass-panel p-6 rounded-3xl border border-white/5">
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl glass-panel border-white/10 p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">This action cannot be undone. Financial records will be lost.</AlertDialogDescription>
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

      {/* Create Invoice Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); setForm({ customer_id: "", sale_id: "", invoice_type: "sale", notes: "", due_date: "", selectedRepairs: [] }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-foreground/5 pointer-events-none">
            <DialogHeader><DialogTitle className="text-xl font-bold">Generate New Invoice</DialogTitle></DialogHeader>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v, sale_id: "", selectedRepairs: [] })}>
                <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-cyan-500"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent className="glass-panel rounded-xl">{customers.map((c) => <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice Type</Label>
              <Select value={form.invoice_type} onValueChange={(v) => setForm({ ...form, invoice_type: v })}>
                <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-cyan-500"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-panel rounded-xl">
                  <SelectItem value="sale" className="rounded-lg">Vehicle Sale</SelectItem>
                  <SelectItem value="repair" className="rounded-lg">Repair Only</SelectItem>
                  <SelectItem value="combined" className="rounded-lg">Sale + Repairs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(form.invoice_type === "sale" || form.invoice_type === "combined") && customerSales.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-cyan-500">Link Sale</Label>
                <Select value={form.sale_id} onValueChange={(v) => setForm({ ...form, sale_id: v })}>
                  <SelectTrigger className="rounded-xl h-11 bg-cyan-500/10 border-cyan-500/20 text-cyan-500"><SelectValue placeholder="Select relevant sale" /></SelectTrigger>
                  <SelectContent className="glass-panel rounded-xl border-cyan-500/20">
                    {customerSales.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="rounded-lg text-cyan-500 focus:bg-cyan-500/20">
                        {(s as any).vehicles ? `${(s as any).vehicles.year} ${(s as any).vehicles.make} ${(s as any).vehicles.model}` : ""} — ₦{Number(s.sale_price).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(form.invoice_type === "repair" || form.invoice_type === "combined") && customerRepairs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-cyan-500">Link Repairs</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                  {customerRepairs.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-2 hover:bg-cyan-500/10 rounded-lg transition-colors cursor-pointer" onClick={() => {
                        const checked = !form.selectedRepairs.includes(r.id);
                        setForm({
                            ...form,
                            selectedRepairs: checked
                              ? [...form.selectedRepairs, r.id]
                              : form.selectedRepairs.filter((id) => id !== r.id),
                        });
                    }}>
                      <Checkbox
                        checked={form.selectedRepairs.includes(r.id)}
                        className="data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 pointer-events-none"
                      />
                      <span className="text-sm font-medium text-cyan-500/90">
                        {getRepairLabel(r)} — ₦{Number(r.repair_cost || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date</Label>
              <Input type="date" className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-cyan-500" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea className="rounded-xl min-h-[80px] bg-background/50 border-white/10 focus-visible:ring-cyan-500" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional invoice notes..." />
            </div>
          </div>
          <div className="p-6 border-t border-white/5 bg-foreground/5 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-white/10 hover:bg-white/5">Cancel</Button>
            <Button onClick={() => createInvoice.mutate()} disabled={!form.customer_id || createInvoice.isPending} className="rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20">
              {createInvoice.isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
