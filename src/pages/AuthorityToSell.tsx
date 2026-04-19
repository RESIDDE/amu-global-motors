import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { 
  Printer, FileText, CheckCircle2, History, Search, Calendar as CalendarIcon, 
  ArrowLeft, Trash2, PlusCircle, Users, Car, Pencil, Download, 
  ChevronRight, ChevronLeft, ShieldCheck, FileCheck, Info, Clock, AlertTriangle
} from "lucide-react";
import { downloadAsPNG } from "@/lib/exportHelpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PrintHeader, PrintWatermark, getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { PrintFooter, getPrintFooterHTML } from "@/components/PrintFooter";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";
import { triggerPrint } from "@/lib/exportHelpers";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ATS = {
  id: string;
  created_at: string;
  agreement_date: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_id_type: string;
  vehicle_make: string;
  vehicle_year_model: string;
  vehicle_color: string;
  vehicle_engine_number: string;
  vehicle_chassis: string;
  valid_until: string;
  note: string;
  signature: string;
  rep_name?: string;
  rep_signature?: string;
  rep_signature_date?: string;
  created_by?: string;
};

const EMPTY_FORM = {
  agreementDate: new Date().toISOString().split("T")[0],
  customerName: "",
  customerAddress: "",
  customerPhone: "",
  customerIdType: "",
  vehicleMake: "",
  vehicleYearModel: "",
  vehicleColor: "",
  vehicleEngineNumber: "",
  vehicleChassis: "",
  validUntil: "",
  note: "",
  repName: "",
  repSignatureDate: new Date().toISOString().split("T")[0],
};

export default function AuthorityToSell() {
  const [activeTab, setActiveTab] = useState("create");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [currentStep, setCurrentStep] = useState(1);
  const documentRef = useRef<HTMLDivElement>(null);
  const { user, role } = useAuth();
  const hasEdit = canEdit(role, "authority-to-sell");

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [signature, setSignature] = useState("");
  const [repSignature, setRepSignature] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const queryClient = useQueryClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getATSHTML = (data: typeof formData, sig: string, repSig: string) => {
    return `<html><head><title>Authority to Sell - ${data.customerName}</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; line-height: 1.5; }
      .title { text-align: center; margin: 30px 0; font-size: 20px; font-weight: 800; text-transform: uppercase; text-decoration: underline; letter-spacing: 1px; }
      .section { margin-bottom: 25px; }
      .section-title { font-weight: 800; font-size: 14px; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
      .field { display: flex; border-bottom: 1px solid #f0f0f0; padding: 6px 0; font-size: 14px; }
      .label { font-weight: 700; width: 220px; color: #555; }
      .value { flex: 1; font-weight: 600; }
      .signature-area { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
      .sig-box { border-bottom: 1px solid #333; height: 80px; display: flex; align-items: flex-end; margin-bottom: 10px; }
      .sig-img { max-height: 70px; object-fit: contain; }
      .footer-note { font-size: 12px; color: #777; text-align: center; margin-top: 50px; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    ${getPrintWatermarkHTML()}
    ${getPrintHeaderHTML()}
    <div class="title">Authority to Sell Vehicle</div>
    <div class="field"><span class="label">Date:</span> <span class="value">${data.agreementDate ? new Date(data.agreementDate).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span></div>
    
    <div class="section" style="margin-top: 30px;">
      <div class="section-title">Owner's Information</div>
      <div class="field"><span class="label">Full Name:</span> <span class="value">${data.customerName}</span></div>
      <div class="field"><span class="label">Address:</span> <span class="value">${data.customerAddress}</span></div>
      <div class="field"><span class="label">Contact Number:</span> <span class="value">${data.customerPhone}</span></div>
      <div class="field"><span class="label">Valid ID Type & Number:</span> <span class="value">${data.customerIdType}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Vehicle Information</div>
      <div class="field"><span class="label">Make/Brand:</span> <span class="value">${data.vehicleMake}</span></div>
      <div class="field"><span class="label">Year Model:</span> <span class="value">${data.vehicleYearModel}</span></div>
      <div class="field"><span class="label">Color:</span> <span class="value">${data.vehicleColor}</span></div>
      <div class="field"><span class="label">Engine Number:</span> <span class="value">${data.vehicleEngineNumber}</span></div>
      <div class="field"><span class="label">Chassis Number:</span> <span class="value">${data.vehicleChassis}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Authority Given</div>
      <p style="font-size: 14px; line-height: 2;">
        I, <strong>${data.customerName || "____________________"}</strong>, hereby authorize the above-named person to sell the vehicle described above on my behalf. This includes: Talking to potential buyers, accepting payment, signing necessary sale documents, Releasing the vehicle and its documents.
      </p>
      <div class="field"><span class="label">This authority is valid until:</span> <span class="value">${data.validUntil ? new Date(data.validUntil).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Note:</div>
      <p style="font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 10px;">${data.note || "N/A"}</p>
    </div>

    <div class="signature-area">
      <div>
        <div class="sig-box">${sig ? `<img src="${sig}" class="sig-img" />` : ''}</div>
        <div style="font-size: 12px; font-weight: 700;">Owner's Signature</div>
        <div style="font-size: 12px;">Name: ${data.customerName}</div>
      </div>
      <div>
        <div class="sig-box">${repSig ? `<img src="${repSig}" class="sig-img" />` : ''}</div>
        <div style="font-size: 12px; font-weight: 700;">Representative Signature</div>
        <div style="font-size: 12px;">Name: ${data.repName}</div>
      </div>
    </div>

    ${getPrintFooterHTML()}
    </body></html>`;
  };

  const handlePrint = () => {
    const html = getATSHTML(formData, signature, repSignature);
    triggerPrint(html);
  };

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["ats-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authority_to_sell")
        .select("*")
        .order("agreement_date", { ascending: false });
      if (error) throw error;
      return data as ATS[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase
        .from("authority_to_sell")
        .upsert([payload]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ats-history"] });
      toast.success("Document saved to history");
    },
    onError: (e: any) => {
      console.error("ATS Save Error:", e);
      toast.error(`Failed to save: ${e.message || e.details || JSON.stringify(e)}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("authority_to_sell")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ats-history"] });
      toast.success("Record deleted");
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        item.customer_name?.toLowerCase().includes(q) ||
        item.vehicle_make?.toLowerCase().includes(q) ||
        item.vehicle_chassis?.toLowerCase().includes(q);
      const matchesDate = !dateFilter || item.agreement_date === dateFilter;
      return matchesSearch && matchesDate;
    });
  }, [history, search, dateFilter]);

  const stats = useMemo(() => {
    const total = history.length;
    const thisMonth = history.filter(item => {
      const d = new Date(item.agreement_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const expiringSoon = history.filter(item => {
      if (!item.valid_until) return false;
      const d = new Date(item.valid_until);
      const now = new Date();
      const diff = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
      return diff > 0 && diff <= 30;
    }).length;
    return { total, thisMonth, expiringSoon };
  }, [history]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!signature) {
      toast.warning("Please capture the owner's signature before saving.");
      return;
    }
    if (!repSignature) {
      toast.warning("Please capture the representative's signature before saving.");
      return;
    }
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      agreement_date: formData.agreementDate || new Date().toISOString().split("T")[0],
      customer_name: formData.customerName,
      customer_address: formData.customerAddress,
      customer_phone: formData.customerPhone,
      customer_id_type: formData.customerIdType,
      vehicle_make: formData.vehicleMake,
      vehicle_year_model: formData.vehicleYearModel,
      vehicle_color: formData.vehicleColor,
      vehicle_engine_number: formData.vehicleEngineNumber,
      vehicle_chassis: formData.vehicleChassis,
      valid_until: formData.validUntil || null,
      note: formData.note,
      signature,
      rep_name: formData.repName,
      rep_signature: repSignature,
      rep_signature_date: formData.repSignatureDate,
      created_by: user?.id,
    };
    
    try {
      await saveMutation.mutateAsync(payload);
      setMode("preview");
    } catch (e) {
      // Error handled by mutation
    }
  };

  const viewHistoryItem = (item: ATS) => {
    setFormData({
      agreementDate: item.agreement_date || new Date().toISOString().split("T")[0],
      customerName: item.customer_name || "",
      customerAddress: item.customer_address || "",
      customerPhone: item.customer_phone || "",
      customerIdType: item.customer_id_type || "",
      vehicleMake: item.vehicle_make || "",
      vehicleYearModel: item.vehicle_year_model || "",
      vehicleColor: item.vehicle_color || "",
      vehicleEngineNumber: item.vehicle_engine_number || "",
      vehicleChassis: item.vehicle_chassis || "",
      validUntil: item.valid_until || "",
      note: item.note || "",
      repName: item.rep_name || "",
      repSignatureDate: item.rep_signature_date || new Date().toISOString().split("T")[0],
    });
    setSignature(item.signature);
    setRepSignature(item.rep_signature || "");
    setMode("preview");
  };

  const handleEdit = (item: ATS) => {
    setFormData({
      agreementDate: item.agreement_date || new Date().toISOString().split("T")[0],
      customerName: item.customer_name || "",
      customerAddress: item.customer_address || "",
      customerPhone: item.customer_phone || "",
      customerIdType: item.customer_id_type || "",
      vehicleMake: item.vehicle_make || "",
      vehicleYearModel: item.vehicle_year_model || "",
      vehicleColor: item.vehicle_color || "",
      vehicleEngineNumber: item.vehicle_engine_number || "",
      vehicleChassis: item.vehicle_chassis || "",
      validUntil: item.valid_until || "",
      note: item.note || "",
      repName: item.rep_name || "",
      repSignatureDate: item.rep_signature_date || new Date().toISOString().split("T")[0],
    });
    setSignature(item.signature);
    setRepSignature(item.rep_signature || "");
    setEditingId(item.id);
    setMode("edit");
    setCurrentStep(1);
    setActiveTab("create");
  };

  const clearForm = () => {
    setFormData(EMPTY_FORM);
    setSignature("");
    setRepSignature("");
    setEditingId(null);
    setCurrentStep(1);
  };

  // ── Helper Component ──────────────────────────────────────────────────────
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 py-2 sm:py-1 border-b border-gray-200">
      <span className="font-bold text-[13px] sm:text-sm text-gray-800 shrink-0">{label}:</span>
      <span className="flex-1 text-[13px] sm:text-sm text-gray-900 font-medium break-words leading-relaxed">
        {value || <span className="text-transparent select-none">{"_".repeat(15)}</span>}
      </span>
    </div>
  );

  const DocumentPreview = () => (
    <div className="w-full bg-white text-black p-6 sm:p-10 shadow-2xl rounded-2xl border border-border/5 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 print:hidden">
        <ShieldCheck className="w-40 h-40" />
      </div>
      <PrintWatermark />
      <PrintHeader />
      <div className="text-center my-6">
        <h1 className="text-xl font-black text-black uppercase tracking-widest underline underline-offset-4">
          Authority to Sell Vehicle
        </h1>
      </div>
      <div className="flex items-baseline gap-2 mb-6 border-b border-gray-300 pb-1">
        <span className="font-bold text-sm">Date:</span>
        <span className="text-sm font-medium flex-1">
          {formData.agreementDate ? new Date(formData.agreementDate).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : ""}
        </span>
      </div>

      <section className="mb-6">
        <h2 className="font-black text-sm uppercase tracking-wide mb-1 flex items-center gap-2"><Users className="w-3 h-3" /> Owner's Information</h2>
        <div className="space-y-1">
          <Field label="Full Name" value={formData.customerName} />
          <Field label="Address" value={formData.customerAddress} />
          <Field label="Contact Number" value={formData.customerPhone} />
          <Field label="Valid ID Type & Number" value={formData.customerIdType} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-black text-sm uppercase tracking-wide mb-1 flex items-center gap-2"><Car className="w-3 h-3" /> Vehicle Information</h2>
        <div className="space-y-1">
          <Field label="Make/Brand" value={formData.vehicleMake} />
          <Field label="Year Model" value={formData.vehicleYearModel} />
          <Field label="Color" value={formData.vehicleColor} />
          <Field label="Engine Number" value={formData.vehicleEngineNumber} />
          <Field label="Chassis Number" value={formData.vehicleChassis} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-black text-sm uppercase tracking-wide mb-3 flex items-center gap-2"><FileCheck className="w-3 h-3" /> Authority Given</h2>
        <p className="text-[13px] leading-[2] text-gray-800">
          I, <span className="inline-block min-w-[150px] border-b border-gray-800 text-center font-bold px-2">{formData.customerName || "____________________"}</span>, 
          hereby authorize the above-named person to sell the vehicle described above on my behalf. This includes: 
          Talking to potential buyers, accepting payment, signing necessary sale documents, Releasing the vehicle and its documents.
        </p>
        <div className="flex items-baseline gap-2 mt-3 border-b border-gray-300 pb-1">
          <span className="font-bold text-xs whitespace-nowrap">Valid until:</span>
          <span className="text-[13px] font-medium flex-1">
            {formData.validUntil ? new Date(formData.validUntil).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : ""}
          </span>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-black text-sm uppercase tracking-wide mb-2">Note:</h2>
        <p className="text-[13px] text-gray-800 italic border-b border-gray-300 pb-2 min-h-[30px]">
          {formData.note || "No additional notes provided."}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-8">
        <div>
          <p className="text-[11px] font-bold text-gray-600 mb-1">Owner's Signature:</p>
          <div className="h-16 border-b border-gray-800 mb-1 flex items-end">
            {signature && <img src={signature} alt="Owner" className="max-h-14 object-contain" />}
          </div>
          <p className="text-[11px] font-medium truncate">{formData.customerName}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-gray-600 mb-1">Representative Signature:</p>
          <div className="h-16 border-b border-gray-800 mb-1 flex items-end">
            {repSignature && <img src={repSignature} alt="Rep" className="max-h-14 object-contain" />}
          </div>
          <p className="text-[11px] font-medium truncate">{formData.repName}</p>
        </div>
      </section>
      <PrintFooter />
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  //  PREVIEW MODE
  // ══════════════════════════════════════════════════════════════
  if (mode === "preview") {
    return (
      <div className="animate-fade-up max-w-5xl mx-auto pb-12 px-4 print:p-0 print:m-0">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Button variant="ghost" onClick={() => setMode("edit")} className="rounded-xl gap-2 hover:bg-background/80">
            <ArrowLeft className="w-4 h-4" /> Back to Editor
          </Button>
          <div className="flex gap-3">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-xl gap-2 bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20 font-semibold px-6">
                  <Download className="w-4 h-4" /> Export Options
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
                <DropdownMenuItem onClick={handlePrint} className="rounded-lg cursor-pointer">
                  <Printer className="mr-2 h-4 w-4 text-sky-500" /> Print Document (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => downloadAsPNG(getATSHTML(formData, signature, repSignature), `ats_${formData.customerName.replace(/\s+/g, '_')}`)}
                  className="rounded-lg cursor-pointer"
                >
                  <Download className="mr-2 h-4 w-4 text-sky-500" /> Download as Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="max-w-4xl mx-auto" ref={documentRef}>
          <DocumentPreview />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN UI
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto pb-10 px-4 sm:px-6 animate-fade-up">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2 opacity-70">
            <div className="p-1.5 bg-sky-500/10 rounded-lg"><ShieldCheck className="w-4 h-4 text-sky-500" /></div>
            <span className="text-xs font-bold uppercase tracking-widest text-sky-500">Legal Management</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-black text-foreground tracking-tight">Authority to Sell</h1>
          <p className="text-muted-foreground mt-2 text-base max-w-lg">
            Create professional legal authorization documents for vehicle sales in minutes.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-card/40 border border-white/10 p-1 rounded-2xl w-full sm:w-fit grid grid-cols-2 sm:flex">
          <TabsTrigger value="create" className="rounded-xl px-2 sm:px-8 py-2.5 font-bold data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-sky-500/20 transition-all text-xs sm:text-sm">
            <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> {editingId ? "Edit" : "New"} Agreement
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-2 sm:px-8 py-2.5 font-bold data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-sky-500/20 transition-all text-xs sm:text-sm">
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Past Agreements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Column */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="bento-card border-white/10 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-white/5 bg-foreground/5">
                   <div className="flex justify-between items-center mb-6">
                      <div className="space-y-1">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                           {currentStep === 1 && <><Car className="w-5 h-5 text-sky-500" /> Vehicle Identification</>}
                           {currentStep === 2 && <><Users className="w-5 h-5 text-sky-500" /> Owner Details</>}
                           {currentStep === 3 && <><FileCheck className="w-5 h-5 text-sky-500" /> Execution & Signatures</>}
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Step {currentStep} of 3</p>
                      </div>
                      <div className="w-24">
                        <Progress value={(currentStep / 3) * 100} className="h-1.5 bg-sky-500/10" />
                      </div>
                   </div>

                   <div className="flex gap-2">
                      {[1, 2, 3].map(s => (
                        <div 
                          key={s} 
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-all duration-500",
                            currentStep >= s ? "bg-sky-500" : "bg-white/5"
                          )} 
                        />
                      ))}
                   </div>
                </div>

                <CardContent className="p-8">
                   {/* Step 1: Vehicle */}
                   {currentStep === 1 && (
                     <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Make / Brand</Label>
                            <Input name="vehicleMake" value={formData.vehicleMake} onChange={handleChange} placeholder="e.g. Mercedes-Benz" className="h-12 bg-background/50 border-white/10 rounded-xl px-4" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Model & Year</Label>
                            <Input name="vehicleYearModel" value={formData.vehicleYearModel} onChange={handleChange} placeholder="e.g. G63 AMG 2023" className="h-12 bg-background/50 border-white/10 rounded-xl px-4" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Exterior Color</Label>
                            <Input name="vehicleColor" value={formData.vehicleColor} onChange={handleChange} placeholder="e.g. Obsidian Black" className="h-12 bg-background/50 border-white/10 rounded-xl px-4" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Engine Number</Label>
                            <Input name="vehicleEngineNumber" value={formData.vehicleEngineNumber} onChange={handleChange} placeholder="Enter Engine No." className="h-12 bg-background/50 border-white/10 rounded-xl px-4" />
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Chassis / VIN Number</Label>
                            <Input name="vehicleChassis" value={formData.vehicleChassis} onChange={handleChange} placeholder="Enter Chassis No." className="h-12 bg-background/50 border-white/10 rounded-xl px-4 font-mono" />
                          </div>
                        </div>
                     </div>
                   )}

                   {/* Step 2: Owner */}
                   {currentStep === 2 && (
                     <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Owner's Full Name</Label>
                            <Input name="customerName" value={formData.customerName} onChange={handleChange} placeholder="Full Legal Name" className="h-12 bg-background/50 border-white/10 rounded-xl px-4" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Contact Phone</Label>
                            <Input name="customerPhone" value={formData.customerPhone} onChange={handleChange} placeholder="e.g. 080..." className="h-12 bg-background/50 border-white/10 rounded-xl px-4" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Residential Address</Label>
                            <Input name="customerAddress" value={formData.customerAddress} onChange={handleChange} placeholder="Current Address" className="h-12 bg-background/50 border-white/10 rounded-xl px-4" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Identity Document (Type & ID)</Label>
                            <Input name="customerIdType" value={formData.customerIdType} onChange={handleChange} placeholder="e.g. NIN: 123456789" className="h-12 bg-background/50 border-white/10 rounded-xl px-4" />
                          </div>
                        </div>
                     </div>
                   )}

                   {/* Step 3: Sign */}
                   {currentStep === 3 && (
                     <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-white/5">
                           <div className="space-y-2">
                             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Agreement Date</Label>
                             <Input name="agreementDate" type="date" value={formData.agreementDate} onChange={handleChange} className="h-12 bg-background/50 border-white/10 rounded-xl" />
                           </div>
                           <div className="space-y-2">
                             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Valid Until</Label>
                             <Input name="validUntil" type="date" value={formData.validUntil} onChange={handleChange} className="h-12 bg-background/50 border-white/10 rounded-xl" />
                           </div>
                        </div>

                        <div className="space-y-8">
                           {/* Owner Sign */}
                           <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs font-bold uppercase tracking-wider text-sky-500">Owner Signature Capture</Label>
                                {signature && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> READY</span>}
                              </div>
                              <div className="bg-card/40 p-3 rounded-2xl border border-white/5">
                                <SignaturePad value={signature} onChange={setSignature} />
                              </div>
                           </div>

                           {/* Rep Sign */}
                           <div className="space-y-4 pt-4 border-t border-white/5">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs font-bold uppercase tracking-wider text-sky-500">Representative Signature</Label>
                                {repSignature && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> READY</span>}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                 <div className="bg-card/40 p-3 rounded-2xl border border-white/5">
                                    <SignaturePad value={repSignature} onChange={setRepSignature} />
                                 </div>
                                 <div className="space-y-4">
                                    <div className="space-y-2">
                                       <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rep. Name</Label>
                                       <Input name="repName" value={formData.repName} onChange={handleChange} className="bg-background/50 border-white/10 h-10 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                       <Label className="text-[10px] uppercase font-bold text-muted-foreground">Sign Date</Label>
                                       <Input name="repSignatureDate" type="date" value={formData.repSignatureDate} onChange={handleChange} className="bg-background/50 border-white/10 h-10 rounded-xl" />
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="space-y-2">
                           <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Additional Terms / Notes</Label>
                           <Textarea name="note" value={formData.note} onChange={handleChange} placeholder="Any specific conditions or instructions..." className="bg-background/50 border-white/10 rounded-xl min-h-[100px]" />
                        </div>
                     </div>
                   )}
                </CardContent>

                <div className="p-8 border-t border-white/5 bg-foreground/5 flex justify-between items-center">
                    <Button 
                      variant="ghost" 
                      onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : clearForm()} 
                      className="rounded-xl h-12 px-6 gap-2"
                    >
                      {currentStep > 1 ? <><ChevronLeft className="w-4 h-4" /> Back</> : "Clear Form"}
                    </Button>
                    
                    {currentStep < 3 ? (
                      <Button 
                        onClick={() => setCurrentStep(currentStep + 1)} 
                        className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl h-12 px-8 gap-2 font-bold shadow-lg shadow-sky-500/20"
                      >
                        Continue <ChevronRight className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleSave} 
                        disabled={!formData.customerName || !signature || !repSignature || saveMutation.isPending}
                        className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl h-12 px-10 font-bold shadow-lg shadow-sky-500/20"
                      >
                        {saveMutation.isPending ? "Generating..." : "Save & View Document"}
                      </Button>
                    )}
                </div>
              </Card>Card
            </div>

            {/* Preview Column (Hidden on Mobile) */}
            <div className="lg:col-span-5 sticky top-28 hidden lg:block">
               <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-sky-500/20 to-violet-500/20 rounded-3xl blur opacity-75 transition duration-1000 group-hover:duration-200" />
                  <div className="relative transform scale-[0.8] origin-top bg-white rounded-3xl overflow-hidden shadow-2xl">
                     <div className="absolute inset-0 bg-gray-50 flex items-center justify-center -z-1 opacity-50">
                        <span className="text-6xl font-black text-gray-200 -rotate-45 select-none">DRAFT PREVIEW</span>
                     </div>
                     <DocumentPreview />
                  </div>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-sky-500 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl flex items-center gap-2">
                     <Clock className="w-3 h-3" /> Real-time Preview 
                  </div>
               </div>
               
               <div className="mt-8 glass-panel p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-sky-500 mb-1">
                     <Info className="w-4 h-4" />
                     <h4 className="text-xs font-bold uppercase tracking-widest">Document Tips</h4>
                  </div>
                  <ul className="space-y-2">
                     <li className="flex gap-2 text-[11px] text-muted-foreground leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500/50 mt-1 shrink-0" />
                        Ensure the customer's full residential address is captured for legal validity.
                     </li>
                     <li className="flex gap-2 text-[11px] text-muted-foreground leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500/50 mt-1 shrink-0" />
                        Capture clear signatures to avoid disputes during vehicle release.
                     </li>
                  </ul>
               </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bento-card p-6 flex flex-col justify-between">
                  <div className="p-2 bg-sky-500/10 rounded-xl w-fit"><FileText className="w-5 h-5 text-sky-500" /></div>
                  <div className="mt-4">
                     <h3 className="text-3xl font-black">{stats.total}</h3>
                     <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">Total Agreements</p>
                  </div>
               </div>
               <div className="bento-card p-6 flex flex-col justify-between">
                  <div className="p-2 bg-emerald-500/10 rounded-xl w-fit"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
                  <div className="mt-4">
                     <h3 className="text-3xl font-black">{stats.thisMonth}</h3>
                     <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">Created This Month</p>
                  </div>
               </div>
               <div className="bento-card p-6 flex flex-col justify-between group overflow-hidden relative">
                  <div className="p-2 bg-amber-500/10 rounded-xl w-fit"><Clock className="w-5 h-5 text-amber-500" /></div>
                  <div className="mt-4">
                     <h3 className="text-3xl font-black">{stats.expiringSoon}</h3>
                     <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1 flex items-center gap-1.5">
                       Expiring Soon 
                       {stats.expiringSoon > 0 && <AlertTriangle className="w-3 h-3 text-amber-500 animate-pulse" />}
                     </p>
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                     <AlertTriangle className="w-24 h-24" />
                  </div>
               </div>
            </div>

            {/* History Table */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-sky-500 transition-colors" />
                  <Input
                    placeholder="Search agreements..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-12 h-14 rounded-2xl bg-background/50 border-white/10 focus-visible:ring-sky-500/50 text-base"
                  />
                </div>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-14 rounded-2xl bg-background/50 border-white/10 w-full md:w-56"
                />
              </div>

              <div className="bento-card overflow-hidden">
                <div className="overflow-x-auto">
                   <Table>
                    <TableHeader className="bg-foreground/5">
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="font-bold uppercase tracking-widest text-[10px] py-6 px-6">Owner</TableHead>
                        <TableHead className="font-bold uppercase tracking-widest text-[10px]">Vehicle</TableHead>
                        <TableHead className="font-bold uppercase tracking-widest text-[10px]">Agreement Date</TableHead>
                        <TableHead className="text-right font-bold uppercase tracking-widest text-[10px] px-6">Manage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-medium italic">
                            No matching agreements found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredHistory.map((item) => (
                          <TableRow key={item.id} className="border-border/10 hover:bg-white/5 group transition-colors">
                            <TableCell className="px-6 py-5">
                               <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500">
                                     <Users className="w-4 h-4" />
                                  </div>
                                  <div>
                                     <p className="font-bold text-foreground leading-none mb-1">{item.customer_name}</p>
                                     <p className="text-[10px] text-muted-foreground font-medium">{item.customer_phone}</p>
                                  </div>
                               </div>
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center gap-3">
                                  <Car className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold text-sm">{item.vehicle_make} {item.vehicle_year_model}</span>
                               </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                               {new Date(item.agreement_date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell className="text-right px-6">
                               <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => viewHistoryItem(item)} className="h-9 w-9 rounded-xl hover:bg-sky-500/20 hover:text-sky-500">
                                     <Printer className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} className="h-9 w-9 rounded-xl hover:bg-sky-500/20 hover:text-sky-500">
                                     <Pencil className="w-4 h-4" />
                                  </Button>
                                  {hasEdit && (
                                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)} className="h-9 w-9 rounded-xl hover:bg-destructive/20 hover:text-destructive">
                                       <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                               </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                   </Table>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
