import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { Printer, FileText, CheckCircle2, History, Search, Calendar as CalendarIcon, ArrowLeft, Trash2, PlusCircle, Users, Car, Pencil, Download } from "lucide-react";
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePreview = async () => {
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
      // Error handled by mutation's onError
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
    setActiveTab("create");
  };

  const clearForm = () => {
    setFormData(EMPTY_FORM);
    setSignature("");
    setRepSignature("");
    setEditingId(null);
  };

  // ── Helper ────────────────────────────────────────────────────────────────
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 py-2 sm:py-1 border-b border-gray-200">
      <span className="font-bold text-[13px] sm:text-sm text-gray-800 shrink-0">{label}:</span>
      <span className="flex-1 text-[13px] sm:text-sm text-gray-900 font-medium break-words leading-relaxed">
        {value || <span className="text-transparent select-none">{"_".repeat(20)}</span>}
      </span>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  //  PREVIEW / PRINT MODE
  // ══════════════════════════════════════════════════════════════
  if (mode === "preview") {
    return (
      <div className="animate-fade-up max-w-4xl mx-auto pb-12 px-2 sm:px-4 print:p-0 print:m-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="outline" onClick={() => setMode("edit")} className="rounded-xl gap-2 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Editor
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-xl gap-2 bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20 font-semibold px-6">
                <Download className="w-4 h-4" /> Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
              <DropdownMenuItem onClick={handlePrint} className="rounded-lg cursor-pointer">
                <Printer className="mr-2 h-4 w-4 text-sky-500" /> Print / PDF
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => downloadAsPNG(getATSHTML(formData, signature, repSignature), `ats_${formData.customerName.replace(/\s+/g, '_')}`)}
                className="rounded-lg cursor-pointer"
              >
                <Download className="mr-2 h-4 w-4 text-sky-500" /> Download PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Printable Document Container with Scaling for small screens */}
        <div className="w-full overflow-hidden flex justify-center">
          <div
            ref={documentRef}
            className="bg-white text-black rounded-xl sm:rounded-3xl shadow-2xl border border-gray-100 print:shadow-none print:border-none print:rounded-none overflow-hidden h-auto sm:min-h-[1056px] p-6 sm:p-14 w-full max-w-full sm:w-auto"
          >
          <PrintWatermark />
          <PrintHeader />

          {/* Title */}
          <div className="text-center my-6">
            <h1 className="text-xl font-black text-black uppercase tracking-widest underline underline-offset-4">
              Authority to Sell Vehicle
            </h1>
          </div>

          {/* Date */}
          <div className="flex items-baseline gap-2 mb-8 border-b border-gray-300 pb-1">
            <span className="font-bold text-sm">Date:</span>
            <span className="text-sm font-medium flex-1">
              {formData.agreementDate
                ? new Date(formData.agreementDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : ""}
            </span>
          </div>

          {/* Owner's Information */}
          <section className="mb-8">
            <h2 className="font-black text-sm uppercase tracking-wide mb-1">Owner's Information</h2>
            <div className="space-y-1">
              <Field label="Full Name" value={formData.customerName} />
              <Field label="Address" value={formData.customerAddress} />
              <Field label="Contact Number" value={formData.customerPhone} />
              <Field label="Valid ID Type & Number" value={formData.customerIdType} />
            </div>
          </section>

          {/* Vehicle Information */}
          <section className="mb-8">
            <h2 className="font-black text-sm uppercase tracking-wide mb-1">Vehicle Information</h2>
            <div className="space-y-1">
              <Field label="Make/Brand" value={formData.vehicleMake} />
              <Field label="Year Model" value={formData.vehicleYearModel} />
              <Field label="Color" value={formData.vehicleColor} />
              <Field label="Engine Number" value={formData.vehicleEngineNumber} />
              <Field label="Chassis Number" value={formData.vehicleChassis} />
            </div>
          </section>

          {/* Authority Given */}
          <section className="mb-8">
            <h2 className="font-black text-sm uppercase tracking-wide mb-3">Authority Given</h2>
            <p className="text-sm leading-[2.2] text-gray-800">
              I,{" "}
              <span className="inline-block min-w-[220px] border-b border-gray-800 text-center font-bold">
                {formData.customerName || ""}
              </span>
              , hereby authorize the above-named person to sell the vehicle described above on my behalf. This includes:
              <br />
              Talking to potential buyers, accepting payment, signing necessary sale documents, Releasing the vehicle and its documents.
            </p>
            <div className="flex items-baseline gap-2 mt-3 border-b border-gray-300 pb-1">
              <span className="font-bold text-sm whitespace-nowrap">This authority is valid until:</span>
              <span className="text-sm font-medium flex-1">
                {formData.validUntil
                  ? new Date(formData.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : ""}
              </span>
            </div>
            <div className="border-b border-gray-400 mt-4" />
          </section>

          {/* Note */}
          <section className="mb-6">
            <h2 className="font-black text-sm uppercase tracking-wide mb-2">Note:</h2>
            <p className="text-sm text-gray-800 leading-relaxed min-h-[40px] border-b border-gray-300 pb-2">
              {formData.note}
            </p>
          </section>


          {/* Signatures */}
          <section>
            <h2 className="font-black text-sm uppercase tracking-wide mb-6">Signatures</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              {/* Owner */}
              <div>
                <p className="text-xs font-bold text-gray-600 mb-1">Owner's Signature:</p>
                <div className="h-20 border-b border-gray-800 mb-2 flex items-end">
                  {signature && (
                    <img src={signature} alt="Owner Signature" className="max-h-16 object-contain" />
                  )}
                </div>
                <div className="flex items-baseline gap-2 border-b border-gray-400 pb-1 mb-2">
                  <span className="text-xs font-bold">Name:</span>
                  <span className="text-xs font-medium flex-1">{formData.customerName}</span>
                </div>
                <div className="flex items-baseline gap-2 border-b border-gray-400 pb-1">
                  <span className="text-xs font-bold">Date:</span>
                  <span className="text-xs font-medium flex-1">
                    {formData.agreementDate
                      ? new Date(formData.agreementDate).toLocaleDateString("en-GB")
                      : ""}
                  </span>
                </div>
              </div>

              {/* BEE TEE Rep */}
              <div>
                <p className="text-xs font-bold text-gray-600 mb-1">BEE TEE Representatives Signature:</p>
                <div className="h-20 border-b border-gray-800 mb-2 flex items-end">
                  {repSignature && (
                    <img src={repSignature} alt="Rep Signature" className="max-h-16 object-contain" />
                  )}
                </div>
                <div className="flex items-baseline gap-2 border-b border-gray-400 pb-1 mb-2">
                  <span className="text-xs font-bold">Name:</span>
                  <span className="text-xs font-medium flex-1">{formData.repName}</span>
                </div>
                <div className="flex items-baseline gap-2 border-b border-gray-400 pb-1">
                  <span className="text-xs font-bold">Date:</span>
                  <span className="text-xs font-medium flex-1">
                    {formData.repSignatureDate
                      ? new Date(formData.repSignatureDate).toLocaleDateString("en-GB")
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          </section>
          <PrintFooter />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  FORM / MANAGEMENT MODE
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto animate-fade-up pb-10 px-4 sm:px-0">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2 opacity-70">
            <FileText className="w-4 h-4 text-sky-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-sky-500">Legal Documents</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-black text-foreground tracking-tight">Authority to Sell</h1>
          <p className="text-muted-foreground mt-2 text-base max-w-lg">
            Create, manage, and search Bee Tee Automobile authorization agreements.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card/40 border border-white/5 p-1 rounded-2xl">
          <TabsTrigger value="create" className="rounded-xl px-6 font-semibold data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all">
            <PlusCircle className="w-4 h-4 mr-2" /> Create Document
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-6 font-semibold data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all">
            <History className="w-4 h-4 mr-2" /> Agreement History
          </TabsTrigger>
        </TabsList>

        {/* ── CREATE TAB ────────────────────────────────────────────── */}
        <TabsContent value="create">
          <div className="space-y-6">
            <Card className="bento-card overflow-hidden">
              <CardHeader className="bg-sky-500/5 border-b border-white/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-500" /> Document Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10">

                {/* Agreement Date */}
                <div className="space-y-2 max-w-xs">
                  <Label className="text-muted-foreground text-xs font-semibold px-1">AGREEMENT DATE</Label>
                  <Input name="agreementDate" type="date" value={formData.agreementDate} onChange={handleChange} className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                </div>

                <div className="h-px bg-white/5" />

                {/* Owner's Information */}
                <div className="space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 flex items-center gap-3">
                    <Users className="w-4 h-4" /> Owner's Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">FULL NAME</Label>
                      <Input name="customerName" value={formData.customerName} onChange={handleChange} placeholder="e.g. John Adeyemi" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">ADDRESS</Label>
                      <Input name="customerAddress" value={formData.customerAddress} onChange={handleChange} placeholder="Full residential address..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">CONTACT NUMBER</Label>
                      <Input name="customerPhone" value={formData.customerPhone} onChange={handleChange} placeholder="0807..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">VALID ID TYPE & NUMBER</Label>
                      <Input name="customerIdType" value={formData.customerIdType} onChange={handleChange} placeholder="NIN / Intl. Passport / Driver's License..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Vehicle Information */}
                <div className="space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 flex items-center gap-3">
                    <Car className="w-4 h-4" /> Vehicle Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">MAKE / BRAND</Label>
                      <Input name="vehicleMake" value={formData.vehicleMake} onChange={handleChange} placeholder="e.g. Toyota" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">YEAR MODEL</Label>
                      <Input name="vehicleYearModel" value={formData.vehicleYearModel} onChange={handleChange} placeholder="e.g. Camry 2021" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">COLOR</Label>
                      <Input name="vehicleColor" value={formData.vehicleColor} onChange={handleChange} placeholder="e.g. Pearl White" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">ENGINE NUMBER</Label>
                      <Input name="vehicleEngineNumber" value={formData.vehicleEngineNumber} onChange={handleChange} placeholder="Engine No." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">CHASSIS NUMBER</Label>
                      <Input name="vehicleChassis" value={formData.vehicleChassis} onChange={handleChange} placeholder="Chassis / VIN No." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">AUTHORITY VALID UNTIL</Label>
                      <Input name="validUntil" type="date" value={formData.validUntil} onChange={handleChange} className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Note */}
                <div className="space-y-3">
                  <Label className="text-muted-foreground text-xs font-semibold px-1">NOTE (OPTIONAL)</Label>
                  <Textarea
                    name="note"
                    value={formData.note}
                    onChange={handleChange}
                    placeholder="Any additional terms or conditions..."
                    className="bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl min-h-[80px]"
                  />
                </div>

                <div className="h-px bg-white/5" />
                
                {/* Signatures */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* Owner Signature */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <Pencil className="w-4 h-4" /> Owner's Signature
                      </span>
                      {signature && (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> CAPTURED
                        </span>
                      )}
                    </h3>
                    <div className="bg-card/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <SignaturePad value={signature} onChange={setSignature} />
                      <p className="text-[10px] text-muted-foreground text-center mt-3 uppercase font-bold tracking-tighter opacity-50">
                        Have the owner draw their signature above.
                      </p>
                    </div>
                  </div>

                  {/* Representative Signature */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <Pencil className="w-4 h-4" /> Rep. Signature
                      </span>
                      {repSignature && (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> CAPTURED
                        </span>
                      )}
                    </h3>
                    <div className="bg-card/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <SignaturePad value={repSignature} onChange={setRepSignature} />
                      <div className="grid grid-cols-1 gap-3 mt-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-bold uppercase px-1">Rep. Name</Label>
                          <Input name="repName" value={formData.repName} onChange={handleChange} placeholder="Full Name" className="h-9 text-sm bg-background/50 border-white/10 rounded-lg" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-bold uppercase px-1">Sign Date</Label>
                          <Input name="repSignatureDate" type="date" value={formData.repSignatureDate} onChange={handleChange} className="h-9 text-sm bg-background/50 border-white/10 rounded-lg" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button variant="outline" size="lg" className="rounded-2xl px-10 h-14 border-white/10 hover:bg-white/5 transition-all" onClick={clearForm}>
                Clear Form
              </Button>
              <Button
                size="lg"
                className="rounded-2xl px-12 h-14 bg-sky-500 hover:bg-sky-600 text-white shadow-xl shadow-sky-500/25 font-bold transition-all disabled:opacity-50"
                disabled={!formData.customerName || !formData.vehicleMake || !signature || !repSignature || saveMutation.isPending}
                onClick={handlePreview}
              >
                {saveMutation.isPending ? "Saving..." : "Save & Preview Document"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── HISTORY TAB ──────────────────────────────────────────── */}
        <TabsContent value="history">
          <div className="space-y-6">
            {/* Filters */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row gap-4 items-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent pointer-events-none" />
              <div className="relative w-full group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-sky-500 transition-colors" />
                <Input
                  placeholder="Search by owner name, vehicle make, or chassis number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-background/50 border-white/10 focus-visible:ring-sky-500/50 font-medium text-base w-full shadow-inner"
                />
              </div>
              <div className="relative group flex-shrink-0 w-full md:w-52">
                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-11 h-14 rounded-2xl bg-background/50 border-white/10 focus-visible:ring-sky-500/50 text-sm shadow-inner"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bento-card overflow-hidden">
              <div className="overflow-x-auto w-full">
                <div className="min-w-[800px]">
                  <Table>
                  <TableHeader className="bg-foreground/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="font-bold uppercase tracking-widest text-[10px] py-6 px-6">Date</TableHead>
                      <TableHead className="font-bold uppercase tracking-widest text-[10px]">Owner</TableHead>
                      <TableHead className="font-bold uppercase tracking-widest text-[10px]">Vehicle</TableHead>
                      <TableHead className="font-bold uppercase tracking-widest text-[10px]">Chassis No.</TableHead>
                      <TableHead className="text-right font-bold uppercase tracking-widest text-[10px] px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground animate-pulse font-medium">
                          Loading agreements...
                        </TableCell>
                      </TableRow>
                    ) : filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-medium">
                          No agreements found. Create your first document above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((item) => (
                        <TableRow key={item.id} className="border-white/5 hover:bg-white/5 transition-all group">
                          <TableCell className="py-5 px-6 font-medium">
                            {new Date(item.agreement_date).toLocaleDateString("en-GB")}
                          </TableCell>
                          <TableCell className="font-bold text-foreground/90">{item.customer_name}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-sm">
                              {item.vehicle_make} — {item.vehicle_year_model}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {item.vehicle_chassis || "—"}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 rounded-xl hover:bg-sky-500/10 hover:text-sky-500 font-bold px-4"
                                  >
                                    <Download className="w-4 h-4 mr-2" /> Download
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
                                  <DropdownMenuItem onClick={() => viewHistoryItem(item)} className="rounded-lg cursor-pointer">
                                    <Printer className="mr-2 h-4 w-4 text-sky-500" /> View & Print (PDF)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => downloadAsPNG(getATSHTML({
                                      agreementDate: item.agreement_date,
                                      customerName: item.customer_name,
                                      customerAddress: item.customer_address,
                                      customerPhone: item.customer_phone,
                                      customerIdType: item.customer_id_type,
                                      vehicleMake: item.vehicle_make,
                                      vehicleYearModel: item.vehicle_year_model,
                                      vehicleColor: item.vehicle_color,
                                      vehicleEngineNumber: item.vehicle_engine_number,
                                      vehicleChassis: item.vehicle_chassis,
                                      validUntil: item.valid_until,
                                      note: item.note,
                                      repName: item.rep_name,
                                      repSignatureDate: item.rep_signature_date
                                    }, item.signature, item.rep_signature), `ats_${item.customer_name.replace(/\s+/g, '_')}`)}
                                    className="rounded-lg cursor-pointer"
                                  >
                                    <Download className="mr-2 h-4 w-4 text-sky-500" /> Download PNG
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              {hasEdit && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(item)}
                                    className="h-10 rounded-xl hover:bg-sky-500/10 hover:text-sky-500 font-bold px-4"
                                  >
                                    <Pencil className="w-4 h-4 mr-2" /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteMutation.mutate(item.id)}
                                    className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
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
