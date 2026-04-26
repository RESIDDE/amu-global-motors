import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { PlusCircle, Pencil, Trash2, Receipt, Download, FileText, Printer, FileOutput, DollarSign, Calendar, Search, Car, Users, QrCode, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, exportToJSON, printTable, downloadTableAsPDF, triggerPrint, downloadAsPNG, downloadAsPDF } from "@/lib/exportHelpers";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";
import { getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { getPrintFooterHTML } from "@/components/PrintFooter";
import { 
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList 
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/SignaturePad";
import { QrSignDialog } from "@/lib/qrHelpers";
import { CurrencyInput } from "@/components/CurrencyInput";

const emptyForm = { 
  customer_id: "", 
  selected_vehicle_ids: [] as string[],
  sale_price: "", 
  sale_date: new Date().toISOString().split("T")[0], 
  payment_type: "cash",
  payment_status: "paid_in_full",
  rep_name: "",
  rep_signature: "",
  buyer_signature: "",
  buyer_signature_date: "",
  notes: "" 
};

export default function Sales() {
  const { role } = useAuth();
  const hasEdit = canEdit(role, "sales");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [page, setPage] = useState(0);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportDates, setExportDates] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [exportMode, setExportMode] = useState<"summary" | "individual">("individual");
  const [isExporting, setIsExporting] = useState(false);
  const PAGE_SIZE = 15;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, sale_vehicles(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('sales_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => queryClient.invalidateQueries({ queryKey: ["sales"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, make, model, year, color");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, email, address");
      if (error) throw error;
      return data;
    },
  });

  const vehicleMap = Object.fromEntries(vehicles.map((v) => [
    v.id, 
    `${v.year} ${v.make} ${v.model} ${v.color ? `(${v.color})` : ""}`.trim()
  ]));
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const customerObjMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const filtered = sales.filter((s) => {
    const q = search.toLowerCase();
    const vName = (vehicleMap[s.vehicle_id] || "").toLowerCase();
    const cName = (customerMap[s.customer_id] || "").toLowerCase();
    return !q || vName.includes(q) || cName.includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      let actualCustomerId = form.customer_id;

      if (isNewCustomer) {
        if (!newCustomer.name) throw new Error("Customer name is required");
        const { data: nc, error: nce } = await supabase
          .from("customers")
          .insert({
            name: newCustomer.name,
            phone: newCustomer.phone || null,
            email: newCustomer.email || null,
            address: newCustomer.address || null
          })
          .select()
          .single();
        if (nce) throw nce;
        actualCustomerId = nc.id;
      }

      const payload = {
        customer_id: actualCustomerId,
        sale_price: parseFloat(form.sale_price),
        sale_date: form.sale_date,
        payment_type: form.payment_type,
        payment_status: form.payment_status,
        rep_name: form.rep_name,
        rep_signature: form.rep_signature,
        buyer_signature: form.buyer_signature || null,
        buyer_signature_date: form.buyer_signature_date || null,
        notes: form.notes || null,
        // For backward compatibility, also keep first vehicle_id if any
        vehicle_id: form.selected_vehicle_ids[0] || null,
      };

      let saleId = editId;
      if (editId) {
        const { error } = await supabase.from("sales").update(payload).eq("id", editId);
        if (error) throw error;
        // Clear existing links
        await supabase.from("sale_vehicles").delete().eq("sale_id", editId);
      } else {
        const { data, error } = await supabase.from("sales").insert(payload).select().single();
        if (error) throw error;
        if (!data) throw new Error("Failed to retrieve new sale ID");
        saleId = data.id;
      }

      if (form.selected_vehicle_ids.length > 0) {
        const links = form.selected_vehicle_ids.map(vid => ({
          sale_id: saleId,
          vehicle_id: vid,
          price: parseFloat(form.sale_price) / form.selected_vehicle_ids.length // Provisional split
        }));
        const { error } = await supabase.from("sale_vehicles").insert(links);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editId ? "Sale updated" : "Sale recorded");
      closeDialog();
    },
    onError: () => toast.error("Failed to save sale"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Sale deleted");
    },
    onError: () => toast.error("Failed to delete sale"),
  });

  const closeDialog = () => { 
    setDialogOpen(false); 
    setEditId(null); 
    setForm(emptyForm); 
    setIsNewCustomer(false);
    setNewCustomer({ name: "", phone: "", email: "", address: "" });
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      customer_id: s.customer_id,
      selected_vehicle_ids: s.sale_vehicles?.map((sv: any) => sv.vehicle_id) || (s.vehicle_id ? [s.vehicle_id] : []),
      sale_price: String(s.sale_price),
      sale_date: s.sale_date,
      payment_type: s.payment_type || "cash",
      payment_status: s.payment_status || "paid_in_full",
      rep_name: s.rep_name || "",
      rep_signature: s.rep_signature || "",
      buyer_signature: s.buyer_signature || "",
      buyer_signature_date: s.buyer_signature_date || "",
      notes: s.notes || "",
    });
    setDialogOpen(true);
  };

  const canSubmit = form.selected_vehicle_ids.length > 0 && form.customer_id && form.sale_price && !upsertMutation.isPending;

  const handleExportCSV = () => {
    const rows = sales.map((s) => ({
      Vehicle: vehicleMap[s.vehicle_id] || s.vehicle_id,
      Customer: customerMap[s.customer_id] || s.customer_id,
      "Sale Price": s.sale_price,
      "Sale Date": s.sale_date,
      Notes: s.notes || "",
    }));
    exportToCSV(rows, "sales_export");
  };

  const handleExportJSON = () => {
    exportToJSON(sales, "sales_export");
  };

  const handlePrint = () => {
    const rows = sales.map((s) => ({
      vehicle: vehicleMap[s.vehicle_id] || s.vehicle_id,
      customer: customerMap[s.customer_id] || s.customer_id,
      sale_price: `₦${Number(s.sale_price).toLocaleString()}`,
      sale_date: new Date(s.sale_date).toLocaleDateString(),
      notes: s.notes || "",
    }));
    printTable("Sales Report — AMU Global Motors", rows, [
      { key: "vehicle", label: "Vehicle" },
      { key: "customer", label: "Customer" },
      { key: "sale_price", label: "Sale Price" },
      { key: "sale_date", label: "Sale Date" },
      { key: "notes", label: "Notes" },
    ]);
  };

  const handleDownloadSummaryPDF = async () => {
    const rows = sales.map((s) => ({
      vehicle: vehicleMap[s.vehicle_id] || s.vehicle_id,
      customer: customerMap[s.customer_id] || s.customer_id,
      sale_price: `₦${Number(s.sale_price).toLocaleString()}`,
      sale_date: new Date(s.sale_date).toLocaleDateString(),
      notes: s.notes || "",
    }));
    await downloadTableAsPDF("Sales Summary — AMU Global Motors", rows, [
      { key: "vehicle", label: "Vehicle" },
      { key: "customer", label: "Customer" },
      { key: "sale_price", label: "Price" },
      { key: "sale_date", label: "Date" },
      { key: "notes", label: "Notes" },
    ]);
  };

  const getReceiptHTML = (sale: any) => {
    const cust = customerObjMap[sale.customer_id];
    const saleItems = sale.sale_vehicles?.length > 0 
      ? sale.sale_vehicles.map((sv: any) => vehicleMap[sv.vehicle_id] || "Unknown Vehicle")
      : [vehicleMap[sale.vehicle_id] || "Unknown Vehicle"];

    return `<html><head><title>Receipt</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; line-height: 1.5; color: #333; }
      .header { text-align: center; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; margin-bottom: 30px; }
      .header h1 { font-size: 24px; margin: 0; color: #1a1a2e; }
      .header p { color: #666; font-size: 13px; margin: 5px 0 0; }
      .section { margin-bottom: 25px; }
      .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
      .row .label { color: #666; }
      .row .value { font-weight: 600; }
      .vehicle-list { list-style: none; padding: 0; margin: 10px 0; }
      .vehicle-item { padding: 8px; background: #f9f9f9; border-radius: 6px; margin-bottom: 5px; font-size: 14px; font-weight: 500; }
      .total { font-size: 22px; text-align: right; margin-top: 20px; padding-top: 15px; border-top: 2px solid #1a1a2e; font-weight: bold; }
      .refund-note { margin-top: 30px; padding: 15px; background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; color: #c53030; font-weight: bold; font-size: 14px; text-align: center; }
      .signature-area { display: flex; justify-content: space-between; margin-top: 40px; }
      .sig-box { width: 45%; border-top: 1px solid #333; padding-top: 10px; font-size: 12px; text-align: center; }
      .signature-img { max-height: 60px; display: block; margin: 0 auto 10px; }
      .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
      @media print { body { padding: 20px; } .refund-note { background: #fee2e2 !important; } }
    </style></head><body>
    ${getPrintWatermarkHTML()}
    ${getPrintHeaderHTML()}
    <div class="header">
      <h1>SALES RECEIPT</h1>
      <p>Receipt No: ${(sale as any).sale_number ? `#${(sale as any).sale_number}` : sale.id.slice(0, 8).toUpperCase()}</p>
    </div>

    <div class="section">
      <div class="section-title">Customer Information</div>
      <div class="row"><span class="label">Name</span><span class="value">${cust?.name || "—"}</span></div>
      ${cust?.phone ? `<div class="row"><span class="label">Phone</span><span class="value">${cust.phone}</span></div>` : ""}
      <div class="row"><span class="label">Date</span><span class="value">${new Date(sale.sale_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Purchased vehicles</div>
      <ul class="vehicle-list">
        ${saleItems.map((v: string) => `<li class="vehicle-item">${v}</li>`).join("")}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">Payment Details</div>
      <div class="row"><span class="label">Payment Type</span><span class="value" style="text-transform: capitalize;">${sale.payment_type || 'Cash'}</span></div>
      <div class="row"><span class="label">Status</span><span class="value" style="text-transform: capitalize;">${(sale.payment_status || 'Paid').replace(/_/g, ' ')}</span></div>
      <div class="total">Total Paid: ₦${Number(sale.sale_price).toLocaleString()}</div>
    </div>

    <div class="refund-note">
       NOTICE: NO REFUND AFTER PAYMENT
    </div>

      ${sale.rep_signature || sale.buyer_signature ? `<div class="signature-area">
        <div class="sig-box">
          ${sale.buyer_signature ? `<img src="${sale.buyer_signature}" class="signature-img" />` : ""}
          <p>Customer Signature</p>
          <p style="font-size:10px; color:#999; margin-top:2px;">${sale.buyer_signature_date ? new Date(sale.buyer_signature_date).toLocaleDateString() : ""}</p>
        </div>
        <div class="sig-box">
          ${sale.rep_signature ? `<img src="${sale.rep_signature}" class="signature-img" />` : ""}
          <p>Seller/Representative: <strong>${sale.rep_name || 'AMU Global Motors'}</strong></p>
        </div>
      </div>` : `
      <div class="signature-area">
        <div class="sig-box"><p>Customer Signature</p></div>
        <div class="sig-box"><p>Representative</p></div>
      </div>`}

    <div class="footer">
      <p>Thank you for choosing AMU Global Motors!</p>
    </div>
    ${getPrintFooterHTML()}
    </body></html>`;
  };

  const printReceipt = (sale: any) => {
    const html = getReceiptHTML(sale);
    triggerPrint(html);
  };

  const handleDownloadPDF = async (sale: any) => {
    const html = getReceiptHTML(sale);
    await downloadAsPDF(html, `receipt_${sale.id.slice(0, 8)}`);
  };

  const handleBulkExport = async () => {
    const start = new Date(exportDates.start);
    const end = new Date(exportDates.end);
    end.setHours(23, 59, 59, 999);

    const toExport = sales.filter(s => {
      const d = new Date(s.sale_date);
      return d >= start && d <= end;
    });

    if (toExport.length === 0) {
      toast.error("No sales found in this date range");
      return;
    }

    setIsExporting(true);
    setExportDialogOpen(false);

    try {
      if (exportMode === "summary") {
        const rows = toExport.map((s) => ({
          sale_no: (s as any).sale_number ? `#${(s as any).sale_number}` : s.id.slice(0, 4),
          vehicle: vehicleMap[s.vehicle_id] || s.vehicle_id,
          customer: customerMap[s.customer_id] || s.customer_id,
          sale_price: `₦${Number(s.sale_price).toLocaleString()}`,
          sale_date: new Date(s.sale_date).toLocaleDateString(),
        }));
        await downloadTableAsPDF(`Sales Summary (${exportDates.start} to ${exportDates.end})`, rows, [
          { key: "sale_no", label: "Sale #" },
          { key: "vehicle", label: "Vehicle" },
          { key: "customer", label: "Customer" },
          { key: "sale_price", label: "Price" },
          { key: "sale_date", label: "Date" },
        ]);
      } else {
        toast.info(`Generating ${toExport.length} documents... Please wait.`);
        // For individual documents, we loop and trigger downloads
        // We do it in small batches to not overwhelm the browser
        for (let i = 0; i < toExport.length; i++) {
          const s = toExport[i];
          const html = getReceiptHTML(s);
          await downloadAsPDF(html, `receipt_${(s as any).sale_number || s.id.slice(0, 4)}`);
          
          // Small delay between documents to help the browser
          if (i < toExport.length - 1) {
             await new Promise(r => setTimeout(r, 800));
          }
        }
        toast.success(`Exported ${toExport.length} documents`);
      }
    } catch (error) {
      console.error("Bulk export failed:", error);
      toast.error("Bulk export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPNG = async (sale: any) => {
    const html = getReceiptHTML(sale);
    await downloadAsPNG(html, `receipt_${sale.id.slice(0, 8)}`);
  };

  return (
    <>
      <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <DollarSign className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-violet-500">Revenue</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            Sales
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
            Track vehicle sales, generate receipts, and manage sales history.
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
              <DropdownMenuItem onClick={handleExportCSV} className="rounded-lg cursor-pointer">
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" /> Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON} className="rounded-lg cursor-pointer">
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" /> Export to JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadSummaryPDF} className="rounded-lg cursor-pointer text-violet-500 font-bold">
                <FileText className="mr-2 h-4 w-4" /> Download PDF Summary (All)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExportDialogOpen(true)} className="rounded-lg cursor-pointer text-emerald-500 font-bold">
                <Download className="mr-2 h-4 w-4" /> Advanced Bulk Export (Date Range)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} className="rounded-lg cursor-pointer text-muted-foreground py-2 border-t border-white/5 mt-1">
                <Printer className="mr-2 h-4 w-4" /> Print / Save PDF (Dialog)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }} size="lg" className="rounded-2xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all bg-violet-500 hover:bg-violet-600 text-white">
            <PlusCircle className="mr-2 h-5 w-5" /> Record Sale
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-transparent pointer-events-none" />
        <div className="relative w-full group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
          <Input 
            placeholder="Search by vehicle or customer name..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-violet-500/50 transition-all font-medium text-sm w-full"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : sales.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-violet-500/10 p-5 rounded-full mb-4">
            <DollarSign className="h-10 w-10 text-violet-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No sales recorded.</h2>
          <p className="text-muted-foreground max-w-sm mb-6">Start tracking your dealership revenue by recording your first sale.</p>
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }} className="rounded-xl shadow-lg shadow-violet-500/20 bg-violet-500 hover:bg-violet-600 text-white">Record Sale</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto w-full">
              <div className="min-w-[800px]">
                <Table className="w-full">
                <TableHeader className="bg-foreground/5 pointer-events-none">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-semibold px-6 py-4">Sale #</TableHead>
                    <TableHead className="font-semibold">Vehicle</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Sale Price</TableHead>
                    <TableHead className="font-semibold">Sale Date</TableHead>
                    <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((s) => (
                    <TableRow key={s.id} className="border-border/10 hover:bg-white/5 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-violet-500 bg-violet-500/5 px-2 py-1 rounded">#{(s as any).sale_number || s.id.slice(0, 4)}</span>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm transition-colors group-hover:text-violet-500">{vehicleMap[s.vehicle_id] || "—"}</span>
                         </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{customerMap[s.customer_id] || "—"}</span>
                         </div>
                      </TableCell>
                      <TableCell className="font-semibold">₦{Number(s.sale_price).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {new Date(s.sale_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/20 text-amber-500" onClick={() => setQrId(s.id)}>
                            <QrCode className="h-4 w-4 mr-1.5" /> Sign Link
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/20 text-sky-500">
                                <Download className="h-4 w-4 mr-1.5" /> Download
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10">
                              <DropdownMenuItem onClick={() => handleDownloadPDF(s)} className="rounded-lg cursor-pointer">
                                <FileText className="mr-2 h-4 w-4 text-violet-500" /> Download PDF (Direct)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPNG(s)} className="rounded-lg cursor-pointer">
                                <Download className="mr-2 h-4 w-4" /> Download as PNG
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/20" onClick={() => printReceipt(s)}>
                            <Receipt className="h-4 w-4 mr-1.5" /> Receipt
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-violet-500/10 hover:text-violet-500" onClick={() => navigate(`/invoices?action=create&customer_id=${s.customer_id}&sale_id=${s.id}&type=sale`)}>
                            <FileOutput className="h-4 w-4 mr-1.5" /> Invoice
                          </Button>
                          {hasEdit && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="h-8 w-8 rounded-lg hover:bg-foreground/20">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive">
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
      </div>
    )}

    {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-foreground/5 pointer-events-none">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editId ? "Edit Sale Details" : "Record New Sale"}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer *</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn("h-7 px-2 text-[10px] uppercase font-bold", isNewCustomer ? "text-amber-500 bg-amber-500/10" : "text-violet-500")}
                  onClick={() => setIsNewCustomer(!isNewCustomer)}
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  {isNewCustomer ? "Select Existing" : "Add New Customer"}
                </Button>
              </div>

              {!isNewCustomer ? (
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      className="w-full justify-between rounded-xl h-11 bg-background/50 border-white/10 font-normal hover:bg-background/80"
                    >
                      {form.customer_id
                        ? customers.find((c) => c.id === form.customer_id)?.name
                        : "Select customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 glass-panel border-white/10">
                    <Command className="bg-transparent">
                      <CommandInput placeholder="Search customers..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setForm({ ...form, customer_id: c.id });
                                setCustomerSearchOpen(false);
                              }}
                              className="rounded-lg cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.customer_id === c.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{c.name}</span>
                                <span className="text-[10px] text-muted-foreground">{c.phone || "No phone"}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl animate-fade-in">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Full Name *</Label>
                    <Input 
                      placeholder="Customer Name" 
                      className="h-9 rounded-lg bg-background/50 border-white/10" 
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Phone Number</Label>
                    <Input 
                      placeholder="080..." 
                      className="h-9 rounded-lg bg-background/50 border-white/10" 
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Email Address</Label>
                    <Input 
                      placeholder="customer@example.com" 
                      className="h-9 rounded-lg bg-background/50 border-white/10" 
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Address</Label>
                    <Input 
                      placeholder="Home or Office address" 
                      className="h-9 rounded-lg bg-background/50 border-white/10" 
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Vehicles *</Label>
              <div className="bg-foreground/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search by make, model, or year..." 
                    className="h-9 pl-9 rounded-xl bg-background/50 border-white/10 text-sm"
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {vehicles
                    .filter((v) => `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(vehicleSearch.toLowerCase()))
                    .map((v) => (
                    <div 
                      key={v.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        form.selected_vehicle_ids.includes(v.id) 
                          ? 'bg-violet-500/10 border-violet-500/20 text-violet-500' 
                          : 'bg-background/40 border-white/5 hover:bg-white/5'
                      }`}
                      onClick={() => {
                        const ids = form.selected_vehicle_ids.includes(v.id)
                          ? form.selected_vehicle_ids.filter(id => id !== v.id)
                          : [...form.selected_vehicle_ids, v.id];
                        setForm({ ...form, selected_vehicle_ids: ids });
                      }}
                    >
                      <Checkbox checked={form.selected_vehicle_ids.includes(v.id)} className="data-[state=checked]:bg-violet-500 pointer-events-none" />
                      <span className="text-[13px] font-medium leading-tight">{v.year} {v.make} {v.model}</span>
                    </div>
                  ))}
                  {vehicles.filter((v) => `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(vehicleSearch.toLowerCase())).length === 0 && (
                     <div className="col-span-1 sm:col-span-2 text-center text-sm text-muted-foreground py-4 italic">No matching vehicles found.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Sale Price *</Label>
                <CurrencyInput className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-violet-500 font-bold" placeholder="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sale Date *</Label>
                <Input className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-violet-500" type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Type</Label>
                 <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v })}>
                   <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10"><SelectValue /></SelectTrigger>
                   <SelectContent className="glass-panel border-white/10 rounded-xl">
                     <SelectItem value="cash">Cash</SelectItem>
                     <SelectItem value="transfer">Bank Transfer</SelectItem>
                     <SelectItem value="pos">POS</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Status</Label>
                 <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                   <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10"><SelectValue /></SelectTrigger>
                   <SelectContent className="glass-panel border-white/10 rounded-xl">
                     <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                     <SelectItem value="deposit">Deposit Only</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
            </div>

            <div className="pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seller / Rep Name</Label>
                     <Input className="rounded-xl h-11 bg-background/50 border-white/10" placeholder="Full name" value={form.rep_name} onChange={(e) => setForm({ ...form, rep_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rep Signature</Label>
                     <div className="rounded-2xl overflow-hidden border border-white/10 bg-background/50">
                        <SignaturePad value={form.rep_signature} onChange={(v) => setForm({ ...form, rep_signature: v })} />
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buyer Signature (In-Person)</Label>
                     <div className="rounded-2xl overflow-hidden border border-white/10 bg-background/50">
                        <SignaturePad value={form.buyer_signature} onChange={(v) => setForm({ ...form, buyer_signature: v })} />
                     </div>
                  </div>
                  {form.buyer_signature && (
                    <div className="space-y-2">
                       <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buyer Signed Date</Label>
                       <Input type="date" className="rounded-xl h-11 bg-background/50 border-white/10" value={form.buyer_signature_date} onChange={(e) => setForm({ ...form, buyer_signature_date: e.target.value })} />
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground italic">Or use the "Sign Link" in the table to send this to the customer.</p>
               </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea className="rounded-xl min-h-[80px] bg-background/50 border-white/10 focus-visible:ring-violet-500" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional remarks regarding the sale..." />
            </div>
          </div>
          <div className="p-6 border-t border-white/5 bg-foreground/5 flex justify-end gap-3">
            <Button variant="outline" onClick={closeDialog} className="rounded-xl border-white/10 hover:bg-white/5">Cancel</Button>
            <Button 
              onClick={() => upsertMutation.mutate()} 
              disabled={!( (form.customer_id || (isNewCustomer && newCustomer.name)) && form.selected_vehicle_ids.length > 0 && form.sale_price && !upsertMutation.isPending )} 
              className="rounded-xl bg-violet-500 hover:bg-violet-600 text-white border-0 shadow-lg shadow-violet-500/20"
            >
              {editId ? "Update Sale" : "Record Sale"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl glass-panel border-white/10 p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">Delete Sale</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">This action cannot be undone and will permanently remove the sale record.</AlertDialogDescription>
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

      <QrSignDialog 
        open={!!qrId} 
        onOpenChange={(open) => !open && setQrId(null)} 
        type="sale" 
        id={qrId} 
      />

      {/* Advanced Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-emerald-500/5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-500" /> Advanced Export
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Export multiple sales based on a specific date range.</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                <Input 
                  type="date" 
                  className="rounded-xl h-11 bg-background/50 border-white/10" 
                  value={exportDates.start}
                  onChange={(e) => setExportDates({ ...exportDates, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</Label>
                <Input 
                  type="date" 
                  className="rounded-xl h-11 bg-background/50 border-white/10" 
                  value={exportDates.end}
                  onChange={(e) => setExportDates({ ...exportDates, end: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
               <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Export Mode</Label>
               <div className="grid grid-cols-2 gap-3">
                  <div 
                    onClick={() => setExportMode("summary")}
                    className={cn(
                      "p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2",
                      exportMode === "summary" ? "bg-violet-500/10 border-violet-500/50" : "bg-background/40 border-white/5 hover:bg-white/5"
                    )}
                  >
                    <FileText className={cn("h-5 w-5", exportMode === "summary" ? "text-violet-500" : "text-muted-foreground")} />
                    <div>
                      <p className="font-bold text-sm">Summary PDF</p>
                      <p className="text-[10px] text-muted-foreground">Single table listing all sales.</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => setExportMode("individual")}
                    className={cn(
                      "p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2",
                      exportMode === "individual" ? "bg-emerald-500/10 border-emerald-500/50" : "bg-background/40 border-white/5 hover:bg-white/5"
                    )}
                  >
                    <Download className={cn("h-5 w-5", exportMode === "individual" ? "text-emerald-500" : "text-muted-foreground")} />
                    <div>
                      <p className="font-bold text-sm">Individual Docs</p>
                      <p className="text-[10px] text-muted-foreground">Separate PDF for every sale.</p>
                    </div>
                  </div>
               </div>
            </div>

            {exportMode === "individual" && (
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-500 leading-relaxed">
                  Exporting individual documents for many sales may take time. Your browser will prompt you to allow multiple downloads.
                </p>
              </div>
            )}
          </div>
          <div className="p-6 border-t border-white/5 bg-foreground/5 flex justify-end gap-3">
             <Button variant="outline" onClick={() => setExportDialogOpen(false)} className="rounded-xl border-white/10">Cancel</Button>
             <Button 
                onClick={handleBulkExport} 
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 px-6"
                disabled={isExporting}
             >
               {isExporting ? "Processing..." : "Export Sales"}
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 text-center">
           <div className="glass-panel p-10 rounded-3xl border-white/10 shadow-2xl max-w-sm space-y-4">
              <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-2xl font-bold">Exporting Sales...</h2>
              <p className="text-muted-foreground">Generating and downloading your documents. Please do not close this window.</p>
           </div>
        </div>
      )}
    </div>
  </>
);
}
