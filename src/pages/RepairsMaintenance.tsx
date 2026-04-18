import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  ChevronRight, ArrowRight, Receipt, ClipboardCheck, Wrench, PlusCircle, Clock, DollarSign, PieChart as PieChartIcon, Search, Car, Pencil, QrCode, FileOutput, Trash2, History as HistoryIcon 
} from "lucide-react";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area
} from "recharts";
import VehicleMakeModelSelector from "@/components/VehicleMakeModelSelector";
import { getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { getPrintFooterHTML } from "@/components/PrintFooter";
import { SignaturePad } from "@/components/SignaturePad";
import { QrSignDialog } from "@/lib/qrHelpers";
import { CurrencyInput } from "@/components/CurrencyInput";

type Repair = {
  id: string;
  vehicle_id: string | null;
  customer_id: string | null;
  manual_make: string | null;
  manual_model: string | null;
  manual_year: string | null;
  job_card_no: string | null;
  expected_delivery_date: string | null;
  service_supervisor: string | null;
  technician_assigned: string | null;
  registration_no: string | null;
  vin_chassis: string | null;
  mileage: string | null;
  fuel_level: string | null;
  condition_check: string[] | null;
  inspection_notes: string | null;
  customer_complaint: string | null;
  company: string | null;
  replacement_parts: string | null;
  damaged_parts: string | null;
  to_be_resprayed: boolean;
  painting_bodywork: { items: string[]; details: string } | null;
  mechanical_service: { items: string[]; details: string } | null;
  parts_to_replace: string | null;
  parts_total: number | null;
  labour_total: number | null;
  other_charges: number | null;
  vat: number | null;
  date_out: string | null;
  checked_by: string | null;
  repair_cost: number | null;
  deposit_amount: number | null;
  payment_status: string | null;
  payment_type: string | null;
  brought_in_by: string | null;
  handed_to: string | null;
  signature_data: string | null;
  rep_name: string | null;
  rep_signature: string | null;
  rep_signature_date: string | null;
  respray_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicles?: { make: string; model: string; year: number; color?: string; vin?: string } | null;
};

const emptyForm = {
  job_card_no: "",
  vehicle_id: "",
  customer_id: "",
  make: "",
  model: "",
  year: "",
  color: "",
  vin: "",
  registration_no: "",
  mileage: "",
  fuel_level: "1/4",
  expected_delivery_date: "",
  service_supervisor: "",
  technician_assigned: "",
  condition_check: [] as string[],
  inspection_notes: "",
  customer_complaint: "",
  painting_bodywork: { items: [] as string[], details: "" },
  mechanical_service: { items: [] as string[], details: "" },
  parts_to_replace: "",
  parts_total: "",
  labour_total: "",
  other_charges: "",
  vat: "",
  repair_cost: "",
  deposit_amount: "",
  payment_status: "deposit",
  payment_type: "cash",
  brought_in_by: "",
  handed_to: "",
  signature_data: "",
  rep_name: "",
  rep_signature: "",
  rep_signature_date: new Date().toISOString().split("T")[0],
  respray_notes: "",
  notes: "",
};

const getVehicleLabel = (r: Repair) => {
  if (!r) return "Unknown vehicle";
  if (r.vehicles) return `${r.vehicles.year} ${r.vehicles.make} ${r.vehicles.model}`;
  if (r.manual_make) return `${r.manual_year || ""} ${r.manual_make} ${r.manual_model || ""}`.trim();
  return "Unknown vehicle";
};

export default function RepairsMaintenance() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [historyCustomerName, setHistoryCustomerName] = useState("");
  const [historyVehicleLabel, setHistoryVehicleLabel] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // 1. All Queries at the top
  const { data: repairs = [], isLoading } = useQuery({
    queryKey: ["repairs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, vehicles(make, model, year, color, vin)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[] as Repair[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, make, model, year").order("make");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, email, address").order("name");
      if (error) throw error;
      return data;
    },
  });

  // 2. Data Calculations
  const stats = useMemo(() => {
    const total = repairs.length;
    const active = repairs.filter(r => r.payment_status !== 'paid_in_full').length;
    const revenue = repairs.reduce((acc, r) => acc + (Number(r.repair_cost) || 0), 0);
    const collected = repairs.reduce((acc, r) => {
      if (r.payment_status === 'paid_in_full') return acc + (Number(r.repair_cost) || 0);
      return acc + (Number(r.deposit_amount) || 0);
    }, 0);
    return {
      total,
      active,
      revenue,
      pending: revenue - collected
    };
  }, [repairs]);

  const monthlyHistory = useMemo(() => {
    const months: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthRepairs = repairs.filter(r => {
        const rd = new Date(r.created_at);
        return rd.getMonth() === m && rd.getFullYear() === y;
      });
      const rev = monthRepairs.reduce((acc, r) => acc + (Number(r.repair_cost) || 0), 0);
      months.push({ name: label, Revenue: rev, Count: monthRepairs.length });
    }
    return months;
  }, [repairs]);

  const statusSplit = useMemo(() => {
    const paid = repairs.filter(r => r.payment_status === 'paid_in_full').length;
    const deposit = repairs.filter(r => r.payment_status === 'deposit').length;
    return [
      { name: 'Paid in Full', value: paid },
      { name: 'Deposit Only', value: deposit }
    ].filter(x => x.value > 0);
  }, [repairs]);

  const filteredRepairs = useMemo(() => {
    return repairs.filter(r => {
      // Payment Status Filter
      if (statusFilter !== "all" && r.payment_status !== statusFilter) {
        return false;
      }
      
      // Date/Time Filter
      if (dateFilter !== "all") {
        const repairDate = new Date(r.created_at);
        const now = new Date();
        if (dateFilter === "this_month") {
          if (repairDate.getMonth() !== now.getMonth() || repairDate.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === "last_month") {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          if (repairDate.getMonth() !== lastMonth.getMonth() || repairDate.getFullYear() !== lastMonth.getFullYear()) return false;
        } else if (dateFilter === "last_3_months") {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          if (repairDate < threeMonthsAgo) return false;
        } else if (dateFilter === "this_year") {
          if (repairDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // Text Search
      if (!search) return true;
      const q = search.toLowerCase();
      const vLabel = getVehicleLabel(r).toLowerCase();
      const custName = customers.find(c => c.id === r.customer_id)?.name.toLowerCase() || "";
      const company = r.company?.toLowerCase() || "";
      return vLabel.includes(q) || custName.includes(q) || company.includes(q);
    });
  }, [repairs, search, statusFilter, dateFilter, customers]);

  const totalPages = useMemo(() => Math.ceil(filteredRepairs.length / PAGE_SIZE), [filteredRepairs]);
  const pagedRepairs = useMemo(() => filteredRepairs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filteredRepairs, page]);


  const customerHistory = useMemo(() => {
    if (!historyCustomerId) return [];
    return repairs.filter(r => r.customer_id === historyCustomerId).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [repairs, historyCustomerId]);

  const openHistory = (r: Repair) => {
    if (!r.customer_id) {
      toast.error("No customer information for this repair");
      return;
    }
    const cust = customers.find(c => c.id === r.customer_id);
    setHistoryCustomerId(r.customer_id);
    setHistoryCustomerName(cust?.name || "Customer");
    setHistoryVehicleLabel(getVehicleLabel(r));
    setHistoryOpen(true);
  };

  const upsert = useMutation({
    mutationFn: async () => {
      let finalVehicleId = form.vehicle_id;

      if (!finalVehicleId && form.make) {
        const { data: newV, error: vErr } = await supabase.from("vehicles").insert({
          make: form.make,
          model: form.model,
          year: Number(form.year) || new Date().getFullYear(),
          color: form.color || null,
          vin: form.vin || null,
          status: "Customer Car",
          price: 0,
          condition: "Customer Vehicle",
          num_keys: 1
        }).select().single();
        if (vErr) throw vErr;
        finalVehicleId = newV.id;
      }

      const payload: any = {
        vehicle_id: finalVehicleId || null,
        manual_make: form.make,
        manual_model: form.model,
        manual_year: form.year,
        registration_no: form.registration_no,
        vin_chassis: form.vin,
        mileage: form.mileage,
        fuel_level: form.fuel_level,
        expected_delivery_date: form.expected_delivery_date || null,
        service_supervisor: form.service_supervisor,
        technician_assigned: form.technician_assigned,
        condition_check: form.condition_check,
        inspection_notes: form.inspection_notes,
        customer_complaint: form.customer_complaint,
        painting_bodywork: form.painting_bodywork,
        mechanical_service: form.mechanical_service,
        parts_to_replace: form.parts_to_replace,
        parts_total: Number(form.parts_total) || 0,
        labour_total: Number(form.labour_total) || 0,
        other_charges: Number(form.other_charges) || 0,
        vat: Number(form.vat) || 0,
        repair_cost: Number(form.repair_cost) || 0,
        deposit_amount: Number(form.deposit_amount) || 0,
        payment_status: form.payment_status,
        payment_type: form.payment_type,
        rep_name: form.rep_name,
        rep_signature: form.rep_signature,
        rep_signature_date: form.rep_signature_date,
        notes: form.notes,
      };
      if (editId) {
        const { error } = await supabase.from("repairs").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("repairs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repairs"] });
      toast.success(editId ? "Repair updated" : "Repair added");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("repairs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repairs"] });
      toast.success("Repair deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => { setOpen(false); setForm(emptyForm); setEditId(null); };

  const openEdit = (r: Repair) => {
    setEditId(r.id);
    setForm({
      job_card_no: r.job_card_no || "",
      vehicle_id: r.vehicle_id || "",
      customer_id: r.customer_id || "",
      make: r.manual_make || (r.vehicles?.make || ""),
      model: r.manual_model || (r.vehicles?.model || ""),
      year: r.manual_year || (r.vehicles?.year?.toString() || ""),
      color: r.vehicles?.color || "",
      vin: r.vin_chassis || (r.vehicles?.vin || ""),
      registration_no: r.registration_no || "",
      mileage: r.mileage || "",
      fuel_level: r.fuel_level || "1/4",
      expected_delivery_date: r.expected_delivery_date || "",
      service_supervisor: r.service_supervisor || "",
      technician_assigned: r.technician_assigned || "",
      condition_check: r.condition_check || [],
      inspection_notes: r.inspection_notes || "",
      customer_complaint: r.customer_complaint || "",
      painting_bodywork: r.painting_bodywork || { items: [], details: "" },
      mechanical_service: r.mechanical_service || { items: [], details: "" },
      parts_to_replace: r.parts_to_replace || "",
      parts_total: r.parts_total?.toString() || "0",
      labour_total: r.labour_total?.toString() || "0",
      other_charges: r.other_charges?.toString() || "0",
      vat: r.vat?.toString() || "0",
      repair_cost: r.repair_cost?.toString() || "0",
      deposit_amount: r.deposit_amount?.toString() || "0",
      payment_status: r.payment_status || "deposit",
      payment_type: r.payment_type || "cash",
      brought_in_by: r.brought_in_by || "",
      handed_to: r.handed_to || "",
      signature_data: r.signature_data || "",
      rep_name: r.rep_name || "",
      rep_signature: r.rep_signature || "",
      rep_signature_date: r.rep_signature_date || new Date().toISOString().split("T")[0],
      respray_notes: r.respray_notes || "",
      notes: r.notes || "",
    });
    setOpen(true);
  };

  const handleVehicleSelect = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (v) {
      setForm({ ...form, vehicle_id: vehicleId, make: v.make, model: v.model, year: v.year.toString() });
    }
  };

  const paymentStatusLabel = (s: string | null) => s === "paid_in_full" ? "Paid in Full" : "Deposit";
  const paymentTypeLabel = (t: string | null) => t === "transfer" ? "Transfer" : t === "pos" ? "POS" : "Cash";


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50">
          <p className="font-semibold text-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium flex justify-between gap-4" style={{ color: entry.color || entry.fill }}>
              <span>{entry.name}:</span> <span>{entry.name.includes('Revenue') ? `₦${entry.value.toLocaleString()}` : entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const printBill = (r: Repair) => {
    const cust = customers.find(c => c.id === r.customer_id);
    const balance = (Number(r.repair_cost) || 0) - (Number(r.deposit_amount) || 0);
    const html = `<html><head><title>Repair Bill</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; color: #333; }
      .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 15px; }
      .row.total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; margin-top: 12px; padding-top: 16px; }
      .label { color: #555; width: 40%; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
      .value { font-weight: 600; width: 60%; text-align: right; }
      .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    ${getPrintWatermarkHTML()}
    ${getPrintHeaderHTML()}
    <h2 style="text-align: center; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; font-size: 24px; color: #1D3557;">Repair Bill</h2>
    
    <div class="row"><span class="label">Date</span><span class="value">${new Date(r.created_at).toLocaleDateString()}</span></div>
    <div class="row"><span class="label">Customer</span><span class="value">${cust?.name || "—"}</span></div>
    <div class="row"><span class="label">Vehicle</span><span class="value">${getVehicleLabel(r)}</span></div>
    
    <div class="row" style="margin-top: 20px;"><span class="label">Total Repair Cost</span><span class="value">₦${Number(r.repair_cost || 0).toLocaleString()}</span></div>
    <div class="row"><span class="label">Deposit Paid</span><span class="value text-emerald-600">₦${Number(r.deposit_amount || 0).toLocaleString()}</span></div>
    <div class="row total"><span class="label">Balance Due</span><span class="value" style="color: ${balance > 0 ? '#d32f2f' : '#2e7d32'}">₦${balance.toLocaleString()}</span></div>
    
    <div style="margin-top: 40px; background: #fafafa; padding: 20px; border-radius: 8px; border: 1px solid #eee;">
      <h3 style="font-size: 13px; margin-bottom: 12px; border-bottom: 2px solid #ddd; padding-bottom: 8px; text-transform: uppercase; color: #1D3557;">Service Notes</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">
        <strong>Replaced Parts:</strong><br/> ${r.replacement_parts || "None specified"}<br/><br/>
        <strong>Damaged Parts / Issues:</strong><br/> ${r.damaged_parts || "None specified"}
      </p>
    </div>

    <div class="footer">Thank you for your business!<br/><strong>Beetee Autos Team</strong></div>
    ${getPrintFooterHTML()}
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  const printJobCard = (r: Repair) => {
    const cust = customers.find(c => c.id === r.customer_id);
    const balance = (Number(r.repair_cost) || 0) - (Number(r.deposit_amount) || 0);

    const renderCheckboxes = (items: string[], allOptions: string[]) => {
      return allOptions.map(opt => `
        <span style="display:inline-flex; align-items:center; margin-right: 15px; font-size: 11px;">
          <span style="width:12px; height:12px; border:1.5px solid #333; display:inline-block; margin-right:5px; text-align:center; line-height:10px; font-weight:bold;">
            ${items?.includes(opt) ? '✓' : ''}
          </span>
          ${opt}
        </span>
      `).join('');
    };

    const html = `<html><head><title>Job Card - ${r.job_card_no || r.id}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
      body { font-family: 'Inter', sans-serif; padding: 20px; max-width: 850px; margin: 0 auto; color: #1a1a1a; line-height: 1.3; }
      .job-header { text-align: center; font-weight: 800; font-size: 24px; text-transform: uppercase; margin: 20px 0; letter-spacing: 2px; }
      .section { border: 1.5px solid #000; margin-bottom: 12px; border-radius: 4px; overflow: hidden; }
      .section-title { background: #f0f0f0; padding: 6px 12px; font-size: 12px; font-weight: 800; border-bottom: 1.5px solid #000; text-transform: uppercase; display: flex; justify-content: space-between; }
      .section-content { padding: 10px 12px; font-size: 11px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .grid-3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 10px; }
      .field { margin: 4px 0; border-bottom: 1px dashed #ccc; padding-bottom: 2px; min-height: 18px; }
      .field-label { font-weight: 600; color: #555; margin-right: 5px; min-width: 120px; display: inline-block; }
      .checkbox-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
      .footer-note { font-size: 10px; text-align: center; margin-top: 20px; font-weight: 600; font-style: italic; }
      .sig-line { border-bottom: 1.5px solid #000; min-width: 150px; display: inline-block; margin: 0 5px; height: 30px; }
      @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
    </style></head><body>
    ${getPrintWatermarkHTML()}
    ${getPrintHeaderHTML()}
    
    <div class="job-header">JOB CARD</div>

    <div class="grid-2" style="margin-bottom: 15px;">
      <div style="font-size: 11px;">
        <div class="field"><span class="field-label">Job Card No:</span> <span style="font-weight:800; font-size: 13px;">${r.job_card_no || '—'}</span></div>
        <div class="field"><span class="field-label">Date In:</span> ${new Date(r.created_at).toLocaleDateString()}</div>
        <div class="field"><span class="field-label">Expected Delivery:</span> ${r.expected_delivery_date ? new Date(r.expected_delivery_date).toLocaleDateString() : '—'}</div>
      </div>
      <div style="font-size: 11px;">
        <div class="field"><span class="field-label">Service Supervisor:</span> ${r.service_supervisor || '—'}</div>
        <div class="field"><span class="field-label">Technician Assigned:</span> ${r.technician_assigned || '—'}</div>
      </div>
    </div>

    <!-- 1. CUSTOMER INFORMATION -->
    <div class="section">
      <div class="section-title">1. CUSTOMER INFORMATION</div>
      <div class="section-content grid-2">
        <div>
          <div class="field"><span class="field-label">Customer Name:</span> ${cust?.name || '—'}</div>
          <div class="field"><span class="field-label">Phone Number:</span> ${cust?.phone || '—'}</div>
        </div>
        <div>
          <div class="field"><span class="field-label">Email:</span> ${cust?.email || '—'}</div>
          <div class="field"><span class="field-label">Address:</span> ${cust?.address || '—'}</div>
        </div>
      </div>
    </div>

    <!-- 2. VEHICLE DETAILS -->
    <div class="section">
      <div class="section-title">2. VEHICLE DETAILS</div>
      <div class="section-content">
        <div class="grid-3">
          <div class="field"><span class="field-label">Make & Model:</span> ${getVehicleLabel(r)}</div>
          <div class="field"><span class="field-label">Year:</span> ${r.manual_year || r.vehicles?.year || '—'}</div>
          <div class="field"><span class="field-label">Colour:</span> ${r.vehicles?.color || '—'}</div>
        </div>
        <div class="grid-3">
          <div class="field"><span class="field-label">Registration No.:</span> ${r.registration_no || '—'}</div>
          <div class="field"><span class="field-label">VIN/Chassis No.:</span> ${r.vin_chassis || '—'}</div>
          <div class="field"><span class="field-label">Mileage (KM):</span> ${r.mileage || '—'}</div>
        </div>
        <div class="field" style="margin-top: 5px;">
          <span class="field-label">Fuel Level:</span>
          ${renderCheckboxes([r.fuel_level || ''], ['Empty', '1/4', '1/2', '3/4', 'Full'])}
        </div>
      </div>
    </div>

    <!-- 3. CUSTOMER COMPLAINT -->
    <div class="section">
      <div class="section-title">3. CUSTOMER COMPLAINT / REQUEST</div>
      <div class="section-content" style="min-height: 40px;">
        ${r.customer_complaint || '—'}
      </div>
    </div>

    <!-- 4. VEHICLE CONDITION -->
    <div class="section">
      <div class="section-title">4. VEHICLE CONDITION CHECK (ON ARRIVAL)</div>
      <div class="section-content">
        <div class="checkbox-grid">
          ${renderCheckboxes(r.condition_check || [], ['Scratches', 'Broken Lights', 'Interior Damage', 'Engine Noise', 'Warning Lights', 'Electrical Fault', 'AC Fault'])}
        </div>
        <div style="margin-top: 10px; padding-top: 5px; border-top: 1px dashed #ccc;">
          <strong>Inspection Notes:</strong> ${r.inspection_notes || 'No damaged parts noted.'}
        </div>
      </div>
    </div>

    <!-- 5. SERVICE DETAILS -->
    <div class="section">
      <div class="section-title">5. SERVICE / REPAIR DETAILS</div>
      <div class="section-content">
        <div style="margin-bottom: 10px;">
          <strong style="font-size: 10px;">A. PAINTING & BODY WORK</strong><br/>
          <div class="checkbox-grid">
            ${renderCheckboxes(r.painting_bodywork?.items || [], ['Full Body Respray', 'Panel Beating', 'Dent Removal', 'Scratch Removal', 'Color Change', 'Polishing & Buffing'])}
          </div>
          <div style="font-size: 10px; margin-top: 4px; font-style: italic;">Details: ${r.painting_bodywork?.details || '—'}</div>
        </div>
        <div>
          <strong style="font-size: 10px;">B. MECHANICAL & GENERAL SERVICE</strong><br/>
          <div class="checkbox-grid">
            ${renderCheckboxes(r.mechanical_service?.items || [], ['Engine Service', 'Oil Change', 'Brake Service', 'Suspension', 'Electricals', 'AC Service', 'Diagnostics', 'Wheel Balancing and Alignment'])}
          </div>
          <div style="font-size: 10px; margin-top: 4px; font-style: italic;">Details: ${r.mechanical_service?.details || '—'}</div>
        </div>
      </div>
    </div>

    <!-- 6 & 7. PARTS & COST -->
    <div class="grid-2">
      <div class="section">
        <div class="section-title">6. PARTS TO BE REPLACE</div>
        <div class="section-content text-xs" style="min-height: 80px;">${r.parts_to_replace || '—'}</div>
      </div>
      <div class="section">
        <div class="section-title">7. COST SUMMARY</div>
        <div class="section-content">
          <div class="row" style="display:flex; justify-content:space-between; margin:2px 0;"><span>Parts Total:</span> <strong>₦${Number(r.parts_total || 0).toLocaleString()}</strong></div>
          <div class="row" style="display:flex; justify-content:space-between; margin:2px 0;"><span>Labour Total:</span> <strong>₦${Number(r.labour_total || 0).toLocaleString()}</strong></div>
          <div class="row" style="display:flex; justify-content:space-between; margin:2px 0;"><span>Other Charges:</span> <strong>₦${Number(r.other_charges || 0).toLocaleString()}</strong></div>
          <div class="row" style="display:flex; justify-content:space-between; margin:2px 0;"><span>VAT:</span> <strong>₦${Number(r.vat || 0).toLocaleString()}</strong></div>
          <div style="border-top:1.5px solid #000; margin-top:5px; padding-top:5px; display:flex; justify-content:space-between; font-size: 14px;">
            <strong>GRAND TOTAL:</strong> <strong style="color:#d32f2f;">₦${Number(r.repair_cost || 0).toLocaleString()}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- 9. T&C -->
    <div style="font-size: 9px; margin-bottom: 20px;">
      <strong>9. TERMS & CONDITIONS:</strong> Estimates may change after full inspection. Additional repairs require customer approval. Vehicles left beyond 3 days after completion may incur storage fees.
    </div>

    <!-- 10. AUTHORIZATION -->
    <div class="section">
      <div class="section-title">10. AUTHORIZATION</div>
      <div class="section-content" style="padding-bottom: 30px;">
        <p>I authorize the above work to be carried out.</p>
        <div class="grid-2" style="margin-top: 20px;">
          <div>Customer Signature: ${r.signature_data ? `<img src="${r.signature_data}" style="max-height: 40px; vertical-align: middle;"/>` : `<div class="sig-line"></div>`} Date: <span class="sig-line"></span></div>
          <div>Supervisor Signature: ${r.rep_signature ? `<img src="${r.rep_signature}" style="max-height: 40px; vertical-align: middle;"/>` : `<div class="sig-line"></div>`} Date: <span class="sig-line"></span></div>
        </div>
      </div>
    </div>

    <!-- 11 & 12. DELIVERY / CONFIRMATION -->
    <div class="grid-2">
      <div class="section">
        <div class="section-title">11. FINAL DELIVERY</div>
        <div class="section-content">
          <div class="field">Date Out: <span class="sig-line" style="min-width: 100px;"></span></div>
          <div class="field">Vehicle Checked By: <span class="sig-line" style="min-width: 100px;"></span></div>
          <div class="field">Customer Signature: <span class="sig-line" style="min-width: 100px;"></span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">12. CUSTOMER CONFIRMATION</div>
        <div class="section-content">
          <p style="font-size: 9px; font-weight: bold;">I confirm vehicle received in good condition.</p>
          <div class="field" style="margin-top: 20px;">Signature/Date: <span class="sig-line" style="width: 100%;"></span></div>
        </div>
      </div>
    </div>

    <div class="footer-note">Thank you for choosing Bee Tee Autoshop. We appreciate your business!</div>
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-7xl mx-auto px-4 md:px-0">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Wrench className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-amber-500">Service Department</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            Repairs & Maintenance
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
             Manage service logs, parts replacements, and track vehicle repair history across your fleet.
          </p>
        </div>
        <div className="shrink-0">
          <Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} size="lg" className="rounded-2xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all bg-amber-500 hover:bg-amber-600 text-white">
            <PlusCircle className="mr-2 h-5 w-5" /> Record Repair
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {!isLoading && repairs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 md:gap-6 animate-fade-up">
           {/* KPI Columns */}
           <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bento-card p-5 flex flex-col justify-between">
                 <div className="p-2.5 bg-foreground/5 w-fit rounded-xl"><Wrench className="h-5 w-5 text-amber-500" /></div>
                 <div className="mt-4">
                    <h3 className="text-2xl font-bold">{stats.total}</h3>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Total Jobs</p>
                 </div>
              </div>
              <div className="bento-card p-5 flex flex-col justify-between">
                 <div className="p-2.5 bg-foreground/5 w-fit rounded-xl"><Clock className="h-5 w-5 text-sky-500" /></div>
                 <div className="mt-4">
                    <h3 className="text-2xl font-bold">{stats.active}</h3>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Active Work</p>
                 </div>
              </div>
              <div className="bento-card p-5 flex flex-col justify-between col-span-2">
                 <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-foreground/5 w-fit rounded-xl"><DollarSign className="h-5 w-5 text-emerald-500" /></div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">Revenue</span>
                 </div>
                 <div className="mt-4">
                    <h3 className="text-2xl font-bold">₦{stats.revenue.toLocaleString()}</h3>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Lifetime Service Rev.</p>
                 </div>
              </div>

              {/* Revenue Chart */}
              <div className="col-span-2 md:col-span-4 bento-card p-6 min-h-[280px]">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                       <h3 className="font-bold">Service Growth</h3>
                       <p className="text-xs text-muted-foreground">Monthly revenue from repairs</p>
                    </div>
                 </div>
                 <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={monthlyHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                             <linearGradient id="colRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground)/0.05)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} tickFormatter={(v) => `₦${v/1000}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="Revenue" stroke="hsl(38 92% 50%)" fill="url(#colRev)" strokeWidth={3} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* Side Charts */}
           <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bento-card p-5 h-full flex flex-col items-center">
                 <h3 className="font-bold self-start text-sm flex items-center gap-2 mb-4"><PieChartIcon className="h-4 w-4" /> Payment Split</h3>
                 <div className="w-full h-[200px] relative">
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-xs font-bold text-muted-foreground">Pending</span>
                       <span className="text-lg font-bold">₦{stats.pending.toLocaleString()}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie data={statusSplit} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                             {statusSplit.map((_, i) => <Cell key={i} fill={i === 0 ? "hsl(142 76% 36%)" : "hsl(38 92% 50%)"} stroke="none" />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="grid grid-cols-2 gap-4 w-full mt-4">
                    {statusSplit.map((s, i) => (
                       <div key={i} className="flex flex-col items-center p-2 rounded-xl bg-foreground/5">
                          <span className="text-[10px] text-muted-foreground font-bold">{s.name}</span>
                          <span className="font-bold">{s.value}</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Search and List Section */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative group flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-amber-500 transition-colors" />
          <Input 
             placeholder="Search vehicles, customers, or companies under repair..." 
             className="pl-12 h-14 rounded-2xl bg-card border-white/10 focus-visible:ring-amber-500 text-lg shadow-xl"
             value={search}
             onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
          />
        </div>
        <div className="flex gap-2 sm:gap-4 shrink-0 overflow-x-auto pb-2 md:pb-0">
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-14 rounded-2xl bg-card border-white/10 focus-visible:ring-amber-500 text-base shadow-xl whitespace-nowrap">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent className="glass-panel w-[160px] rounded-xl">
              <SelectItem value="all" className="rounded-lg">All Time</SelectItem>
              <SelectItem value="this_month" className="rounded-lg">This Month</SelectItem>
              <SelectItem value="last_month" className="rounded-lg">Last Month</SelectItem>
              <SelectItem value="last_3_months" className="rounded-lg">Last 3 Months</SelectItem>
              <SelectItem value="this_year" className="rounded-lg">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] h-14 rounded-2xl bg-card border-white/10 focus-visible:ring-amber-500 text-base shadow-xl whitespace-nowrap">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="glass-panel w-[180px] rounded-xl">
              <SelectItem value="all" className="rounded-lg">All Statuses</SelectItem>
              <SelectItem value="paid_in_full" className="rounded-lg">Paid in Full</SelectItem>
              <SelectItem value="deposit" className="rounded-lg">Pending / Deposit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-40 rounded-3xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : filteredRepairs.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-amber-500/10 p-5 rounded-full mb-4">
            <Search className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No results found.</h2>
          <p className="text-muted-foreground max-w-sm mb-6">We couldn't find any repairs matching your current search or filter criteria. Try adjusting them.</p>
          <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); setDateFilter("all"); }} className="rounded-xl border-white/10">Clear Search & Filters</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pagedRepairs.map((r) => (
              <div key={r.id} className="bento-card p-6 flex flex-col justify-between group">
                <div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="bg-foreground/5 p-3 rounded-2xl group-hover:bg-amber-500/10 transition-colors shrink-0">
                      <Car className="h-5 w-5 text-foreground/70 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors" title={getVehicleLabel(r)}>{getVehicleLabel(r)}</h3>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        {r.company && <span className="text-xs text-muted-foreground">Company: {r.company}</span>}
                        {r.brought_in_by && <span className="text-xs text-muted-foreground">By: {r.brought_in_by}</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                           {r.repair_cost != null && <span className="text-sm font-semibold text-foreground bg-foreground/5 px-2 py-1 rounded-md">₦{Number(r.repair_cost).toLocaleString()}</span>}
                           <span className={`inline-flex text-[11px] font-bold uppercase px-2 py-1.5 rounded-lg border ${r.payment_status === "paid_in_full" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}`}>
                             {paymentStatusLabel(r.payment_status)}
                           </span>
                           <span className="text-[11px] font-medium text-muted-foreground bg-foreground/5 px-2 py-1.5 rounded-lg uppercase tracking-wider">{paymentTypeLabel(r.payment_type)}</span>
                           {r.to_be_resprayed && <span className="text-[11px] font-bold uppercase px-2 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">Re-spray</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/5 justify-end">
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 text-muted-foreground transition-all" onClick={() => printBill(r)}>
                    <Receipt className="h-3.5 w-3.5 mr-1.5" /> Bill
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-sky-500/10 hover:text-sky-500 text-muted-foreground transition-all" onClick={() => printJobCard(r)}>
                    <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> Job Card
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/10 hover:text-foreground text-muted-foreground transition-all" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground transition-all" onClick={() => setQrId(r.id)}>
                    <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR Sign
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-500 text-muted-foreground transition-all" onClick={() => openHistory(r)}>
                    <HistoryIcon className="h-3.5 w-3.5 mr-1.5" /> History
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-sky-500/10 hover:text-sky-500 text-muted-foreground transition-all" title="Generate Invoice"
                    onClick={() => {
                      if (!r.customer_id) { toast.error("Assign a customer to this repair before invoicing"); return; }
                      navigate(`/invoices?action=create&customer_id=${r.customer_id}&repair_id=${r.id}&type=repair`);
                    }}
                  ><FileOutput className="h-3.5 w-3.5 mr-1.5" /> Invoice</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" onClick={() => { if(window.confirm("Are you sure?")) deleteMut.mutate(r.id) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
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

      {/* QR Dialog */}
      <QrSignDialog open={!!qrId} onOpenChange={() => setQrId(null)} type="repair" id={qrId} />

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-foreground/5 pointer-events-none sticky top-0 z-50 backdrop-blur-md">
             <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Job Card" : "New Job Card Intake"}</DialogTitle></DialogHeader>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="p-0">
            <div className="p-6 space-y-10">
              
              {/* SECTION 1: GENERAL INFO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">1</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">General Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Job Card No.</Label>
                    <Input className="rounded-xl h-11 bg-background/50 border-white/10" value={form.job_card_no} onChange={(e) => setForm({ ...form, job_card_no: e.target.value })} placeholder="e.g. JC-2024-001" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Expected Delivery</Label>
                    <Input type="date" className="rounded-xl h-11 bg-background/50 border-white/10" value={form.expected_delivery_date} onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Service Supervisor</Label>
                    <Input className="rounded-xl h-11 bg-background/50 border-white/10" value={form.service_supervisor} onChange={(e) => setForm({ ...form, service_supervisor: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Technician Assigned</Label>
                    <Input className="rounded-xl h-11 bg-background/50 border-white/10" value={form.technician_assigned} onChange={(e) => setForm({ ...form, technician_assigned: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CUSTOMER / VEHICLE */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">2</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Customer & Vehicle Details</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Select Customer</Label>
                    <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                      <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10"><SelectValue placeholder="Select customer..." /></SelectTrigger>
                      <SelectContent className="glass-panel rounded-xl">
                        {customers.map((c) => <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-foreground/5 p-5 rounded-2xl space-y-4">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Vehicle Selection</Label>
                    <VehicleMakeModelSelector
                      make={form.make}
                      model={form.model}
                      year={form.year}
                      onMakeChange={(v) => setForm({ ...form, make: v, vehicle_id: "" })}
                      onModelChange={(v) => setForm({ ...form, model: v, vehicle_id: "" })}
                      onYearChange={(v) => setForm({ ...form, year: v, vehicle_id: "" })}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Color</Label>
                        <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Color" className="h-9 text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Reg No.</Label>
                        <Input value={form.registration_no} onChange={(e) => setForm({ ...form, registration_no: e.target.value })} placeholder="ABC-123" className="h-9 text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">VIN/Chassis</Label>
                        <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} placeholder="VIN" className="h-9 text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Mileage (KM)</Label>
                        <Input value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} placeholder="0.00" className="h-9 text-xs rounded-lg" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Fuel Level</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Empty', '1/4', '1/2', '3/4', 'Full'].map((lvl) => (
                        <Button 
                          key={lvl} 
                          type="button"
                          variant="ghost" 
                          size="sm"
                          className={`rounded-full px-4 border text-[10px] uppercase font-bold transition-all ${form.fuel_level === lvl ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'border-white/10 opacity-70 hover:opacity-100'}`}
                          onClick={() => setForm({ ...form, fuel_level: lvl })}
                        >
                          {lvl}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3 & 4: COMPLAINT & CONDITION */}
              <div className="space-y-6 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">3</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Vehicle Entry Inspection</h3>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-extrabold uppercase mb-2 block">Customer Complaint / Request</Label>
                  <Textarea value={form.customer_complaint} onChange={(e) => setForm({ ...form, customer_complaint: e.target.value })} className="rounded-xl min-h-[80px]" placeholder="Explain nature of fault or service requested..." />
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-extrabold uppercase block">Condition Check (Arrival)</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Scratches', 'Broken Lights', 'Interior Damage', 'Engine Noise', 'Warning Lights', 'Electrical Fault', 'AC Fault'].map((c) => (
                      <div key={c} className="flex items-center space-x-2 bg-foreground/5 p-2 rounded-lg border border-white/5">
                        <Checkbox 
                          id={`cond-${c}`} 
                          checked={form.condition_check?.includes(c)} 
                          onCheckedChange={(checked) => {
                            const newCheck = checked 
                              ? [...(form.condition_check || []), c] 
                              : (form.condition_check || []).filter(x => x !== c);
                            setForm({ ...form, condition_check: newCheck });
                          }}
                        />
                        <Label htmlFor={`cond-${c}`} className="text-[11px] font-medium leading-none cursor-pointer">{c}</Label>
                      </div>
                    ))}
                  </div>
                  <Textarea value={form.inspection_notes} onChange={(e) => setForm({ ...form, inspection_notes: e.target.value })} className="rounded-xl min-h-[60px] mt-2 text-xs" placeholder="Additional inspection notes..." />
                </div>
              </div>

              {/* SECTION 5: SERVICE DETAILS */}
              <div className="space-y-8 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">4</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Service & Repair Requirements</h3>
                </div>

                {/* Painting */}
                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase text-amber-500 tracking-tighter shadow-sm flex items-center gap-2">
                    A. Painting & Body Work
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Full Body Respray', 'Panel Beating', 'Dent Removal', 'Scratch Removal', 'Color Change', 'Polishing & Buffing'].map((p) => (
                      <div key={p} className="flex items-center space-x-2 bg-foreground/5 p-2 rounded-lg border border-white/5">
                        <Checkbox 
                          id={`paint-${p}`} 
                          checked={form.painting_bodywork?.items.includes(p)} 
                          onCheckedChange={(checked) => {
                            const items = checked 
                              ? [...(form.painting_bodywork?.items || []), p] 
                              : (form.painting_bodywork?.items || []).filter(x => x !== p);
                            setForm({ ...form, painting_bodywork: { ...form.painting_bodywork, items, details: form.painting_bodywork?.details || "" } });
                          }}
                        />
                        <Label htmlFor={`paint-${p}`} className="text-[10px] font-bold opacity-70 leading-none cursor-pointer">{p}</Label>
                      </div>
                    ))}
                  </div>
                  <Textarea value={form.painting_bodywork?.details} onChange={(e) => setForm({ ...form, painting_bodywork: { ...form.painting_bodywork, details: e.target.value, items: form.painting_bodywork?.items || [] } })} className="rounded-xl min-h-[60px] text-xs" placeholder="Painting details..." />
                </div>

                {/* Mechanical */}
                <div className="space-y-4 pt-4">
                  <Label className="text-xs font-black uppercase text-amber-500 tracking-tighter shadow-sm flex items-center gap-2">
                    B. Mechanical & General Service
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Engine Service', 'Oil Change', 'Brake Service', 'Suspension', 'Electricals', 'AC Service', 'Diagnostics', 'Wheel Balancing and Alignment'].map((m) => (
                      <div key={m} className="flex items-center space-x-2 bg-foreground/5 p-2 rounded-lg border border-white/5">
                        <Checkbox 
                          id={`mech-${m}`} 
                          checked={form.mechanical_service?.items.includes(m)} 
                          onCheckedChange={(checked) => {
                            const items = checked 
                              ? [...(form.mechanical_service?.items || []), m] 
                              : (form.mechanical_service?.items || []).filter(x => x !== m);
                            setForm({ ...form, mechanical_service: { ...form.mechanical_service, items, details: form.mechanical_service?.details || "" } });
                          }}
                        />
                        <Label htmlFor={`mech-${m}`} className="text-[10px] font-bold opacity-70 leading-none cursor-pointer">{m}</Label>
                      </div>
                    ))}
                  </div>
                  <Textarea value={form.mechanical_service?.details} onChange={(e) => setForm({ ...form, mechanical_service: { ...form.mechanical_service, details: e.target.value, items: form.mechanical_service?.items || [] } })} className="rounded-xl min-h-[60px] text-xs" placeholder="Mechanical details..." />
                </div>
              </div>

              {/* SECTION 6: COSTS */}
              <div className="space-y-6 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">5</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Cost Summary</h3>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-extrabold uppercase">Parts to Be Replace</Label>
                  <Textarea value={form.parts_to_replace} onChange={(e) => setForm({ ...form, parts_to_replace: e.target.value })} className="rounded-xl min-h-[80px]" placeholder="List required parts..." />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-foreground/5 p-5 rounded-2xl border border-white/5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Parts Total</Label>
                    <CurrencyInput value={form.parts_total} onChange={(e) => setForm({ ...form, parts_total: e.target.value })} placeholder="0" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Labour Total</Label>
                    <CurrencyInput value={form.labour_total} onChange={(e) => setForm({ ...form, labour_total: e.target.value })} placeholder="0" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Other</Label>
                    <CurrencyInput value={form.other_charges} onChange={(e) => setForm({ ...form, other_charges: e.target.value })} placeholder="0" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase opacity-60">VAT</Label>
                    <CurrencyInput value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} placeholder="0" className="h-9 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-extrabold uppercase">Final Quote (Grand Total)</Label>
                    <CurrencyInput className="rounded-xl h-11 bg-amber-500/10 border-amber-500/20 text-amber-500 font-black text-lg" placeholder="0" value={form.repair_cost} onChange={(e) => setForm({ ...form, repair_cost: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-extrabold uppercase">Deposit Paid</Label>
                    <CurrencyInput className="rounded-xl h-11 bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-black text-lg" placeholder="0" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* SIG AREA */}
              <div className="space-y-6 pt-4 border-t border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Customer Signature</Label>
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      <SignaturePad value={form.signature_data} onChange={(v) => setForm({ ...form, signature_data: v })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Supervisor Signature</Label>
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      <SignaturePad value={form.rep_signature} onChange={(v) => setForm({ ...form, rep_signature: v })} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 flex justify-end gap-3 border-t border-white/5 sticky bottom-0 bg-background/95 backdrop-blur-3xl z-50">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-white/10 hover:bg-white/5 h-11 px-8">Cancel</Button>
              <Button type="submit" disabled={upsert.isPending} className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 h-11 px-8 min-w-[160px]">
                {editId ? "Update Job Card" : "Finalize Intake"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-foreground/5 flex items-center justify-between">
             <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                   <HistoryIcon className="h-5 w-5 text-amber-500" />
                   Repair History: {historyCustomerName}
                </DialogTitle>
             </DialogHeader>
          </div>
          <div className="p-6 space-y-6">
             {customerHistory.length === 0 ? (
                <div className="text-center py-10 opacity-50">No history found for this customer.</div>
             ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-[19px] before:w-0.5 before:bg-gradient-to-b before:from-amber-500/50 before:to-transparent before:pointer-events-none">
                   {customerHistory.map((h, i) => (
                      <div key={h.id} className="relative pl-12">
                         {/* Timeline Marker */}
                         <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-background flex items-center justify-center z-10 ${i === 0 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                            {i === 0 ? <Wrench className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-current" />}
                         </div>

                         <div className="bento-card p-5 group hover:border-amber-500/30 transition-all">
                            <div className="flex justify-between items-start mb-3">
                               <div>
                                  <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">{new Date(h.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                                  <h4 className="font-bold text-lg">{h.manual_make || h.vehicles?.make} {h.manual_model || h.vehicles?.model}</h4>
                               </div>
                               <div className="text-right">
                                  <p className="text-lg font-bold">₦{Number(h.repair_cost).toLocaleString()}</p>
                                  <span className={`text-[10px] items-center px-2 py-0.5 rounded-full font-bold uppercase ${h.payment_status === 'paid_in_full' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                     {h.payment_status === 'paid_in_full' ? 'Paid' : 'Pending'}
                                  </span>
                               </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mt-4 border-t border-white/5 pt-4">
                               {h.replacement_parts && (
                                  <div>
                                     <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Parts Replaced</p>
                                     <p className="line-clamp-2 text-foreground/80">{h.replacement_parts}</p>
                                  </div>
                               )}
                               {h.damaged_parts && (
                                  <div>
                                     <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Damaged Issues</p>
                                     <p className="line-clamp-2 text-foreground/80">{h.damaged_parts}</p>
                                  </div>
                               )}
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/5">
                               <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg hover:bg-sky-500/10 hover:text-sky-500 transition-colors text-muted-foreground" onClick={() => printJobCard(h)}>
                                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> Print Job Card
                               </Button>
                               <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg group" onClick={() => { setHistoryOpen(false); openEdit(h); }}>
                                  View Details <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                               </Button>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
          <DialogFooter className="p-6 border-t border-white/5 bg-foreground/5">
             <Button variant="outline" onClick={() => setHistoryOpen(false)} className="rounded-xl border-white/10">Close History</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
