import { useState } from "react";
import { toast } from "sonner";
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
import { SignaturePad } from "@/components/SignaturePad";
import { QrSignDialog } from "@/lib/qrHelpers";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Pencil, Trash2, PlusCircle, CheckCircle, XCircle, ClipboardCheck, Car, QrCode, Search } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";

type Inspection = {
  id: string;
  vehicle_id: string;
  inspector_name: string;
  condition_at_pickup: string;
  pickup_date: string;
  signature_data: string | null;
  returned_in_good_condition: boolean;
  return_condition_notes: string | null;
  return_date: string | null;
  created_at: string;
  updated_at: string;
  vehicles?: { make: string; model: string; year: number } | null;
};

const emptyForm = {
  vehicle_id: "",
  inspector_name: "",
  condition_at_pickup: "",
  pickup_date: new Date().toISOString().slice(0, 16),
  signature_data: "",
  returned_in_good_condition: false,
  return_condition_notes: "",
  return_date: "",
};

export default function Inspections() {
  const { role } = useAuth();
  const hasEdit = canEdit(role, "inspections");

  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 9;

  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("*, vehicles(make, model, year)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Inspection[];
    },
  });

  const filtered = inspections.filter((i) => {
    const q = search.toLowerCase();
    const vName = i.vehicles ? `${i.vehicles.make} ${i.vehicles.model}`.toLowerCase() : "";
    const inspector = i.inspector_name.toLowerCase();
    return !q || vName.includes(q) || inspector.includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, make, model, year").order("make");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: any = {
        vehicle_id: form.vehicle_id,
        inspector_name: form.inspector_name,
        condition_at_pickup: form.condition_at_pickup,
        pickup_date: form.pickup_date || new Date().toISOString(),
        signature_data: form.signature_data || null,
        returned_in_good_condition: form.returned_in_good_condition,
        return_condition_notes: form.returned_in_good_condition ? null : (form.return_condition_notes || null),
        return_date: form.return_date || null,
      };
      if (editId) {
        const { error } = await supabase.from("inspections").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inspections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      toast.success(editId ? "Inspection updated" : "Inspection added");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      toast.success("Inspection deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => { setOpen(false); setForm(emptyForm); setEditId(null); };

  const openEdit = (i: Inspection) => {
    setForm({
      vehicle_id: i.vehicle_id,
      inspector_name: i.inspector_name,
      condition_at_pickup: i.condition_at_pickup,
      pickup_date: i.pickup_date ? i.pickup_date.slice(0, 16) : "",
      signature_data: i.signature_data || "",
      returned_in_good_condition: i.returned_in_good_condition,
      return_condition_notes: i.return_condition_notes || "",
      return_date: i.return_date ? i.return_date.slice(0, 16) : "",
    });
    setEditId(i.id);
    setOpen(true);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <ClipboardCheck className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-rose-500">Quality Control</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            Inspections
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
            Maintain compliance by logging vehicle handovers and returns.
          </p>
        </div>
        <div className="shrink-0">
          <Button onClick={() => setOpen(true)} size="lg" className="rounded-2xl shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all bg-rose-500 hover:bg-rose-600 text-white">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Log
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
        <div className="relative w-full group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-rose-500 transition-colors" />
          <Input 
            placeholder="Search by vehicle or inspector name..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-rose-500/50 transition-all font-medium text-sm w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => <div key={n} className="h-32 rounded-3xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : inspections.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
             <div className="bg-rose-500/10 p-5 rounded-full mb-4">
               <ClipboardCheck className="h-10 w-10 text-rose-500" />
             </div>
             <h2 className="text-xl font-bold mb-2">No inspections recorded yet.</h2>
             <p className="text-muted-foreground max-w-sm mb-6">You will see pickup and return reports here once created.</p>
             <Button onClick={() => setOpen(true)} className="rounded-xl shadow-lg shadow-rose-500/20 bg-rose-500 hover:bg-rose-600 text-white">Record Inspection</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map((i) => (
              <div key={i.id} className="bento-card p-6 flex flex-col justify-between group">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-foreground/5 p-3 rounded-2xl group-hover:bg-rose-500/10 transition-colors shrink-0">
                      <Car className="h-5 w-5 text-foreground/70 group-hover:text-rose-500 transition-colors" />
                    </div>
                    {i.signature_data && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        Signed
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-lg text-foreground group-hover:text-rose-500 transition-colors truncate">
                    {i.vehicles ? `${i.vehicles.year} ${i.vehicles.make} ${i.vehicles.model}` : "Unknown vehicle"}
                  </h3>
                  
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Inspector: {i.inspector_name}</p>
                    <p className="text-sm text-foreground/60">{i.pickup_date ? format(new Date(i.pickup_date), "dd MMM yyyy") : "-"}</p>
                  </div>
                  
                  <div className="mt-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1.5 rounded-xl border ${
                          i.returned_in_good_condition ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}>
                       {i.returned_in_good_condition ? <><CheckCircle className="h-3.5 w-3.5" /> Normal</> : <><XCircle className="h-3.5 w-3.5" /> Issues Found</>}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-white/5 justify-end">
                  {hasEdit && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/10 hover:text-foreground text-muted-foreground transition-all" onClick={() => openEdit(i)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-all" onClick={() => setQrId(i.id)}>
                        <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR Sign
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" onClick={() => { if(window.confirm('Delete?')) deleteMut.mutate(i.id) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
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
      <QrSignDialog open={!!qrId} onOpenChange={() => setQrId(null)} type="inspection" id={qrId} />

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-foreground/5 pointer-events-none">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editId ? "Edit Inspection Details" : "Record New Inspection"}</DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vehicle *</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-rose-500"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent className="glass-panel rounded-xl">
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="rounded-lg">{v.year} {v.make} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inspector Name *</Label>
                 <Input className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-rose-500" value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} required />
               </div>
               <div className="space-y-2">
                 <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pickup Date *</Label>
                 <Input type="datetime-local" className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-rose-500" value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condition at Pickup *</Label>
              <Textarea className="rounded-xl min-h-[80px] bg-background/50 border-white/10 focus-visible:ring-rose-500" value={form.condition_at_pickup} onChange={(e) => setForm({ ...form, condition_at_pickup: e.target.value })} required placeholder="Enter visual or mechanical condition..." />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Digital Signature</Label>
              <div className="rounded-xl overflow-hidden border border-white/10">
                 <SignaturePad value={form.signature_data} onChange={(v) => setForm({ ...form, signature_data: v })} />
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-background/50 border border-white/10 p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setForm({ ...form, returned_in_good_condition: !form.returned_in_good_condition })}>
              <Checkbox id="returned_ok" checked={form.returned_in_good_condition} onCheckedChange={(v) => setForm({ ...form, returned_in_good_condition: v === true })} className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
              <Label htmlFor="returned_ok" className="text-sm font-semibold cursor-pointer text-emerald-500">Returned in Good Condition</Label>
            </div>

            {!form.returned_in_good_condition && (
              <div className="space-y-4 p-4 border border-destructive/20 bg-destructive/5 rounded-xl">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-destructive">Return Condition Issues</Label>
                  <Textarea className="rounded-xl min-h-[80px] bg-background/80 border-destructive/20 focus-visible:ring-destructive" value={form.return_condition_notes} onChange={(e) => setForm({ ...form, return_condition_notes: e.target.value })} placeholder="Describe what is wrong..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-destructive">Return Date</Label>
                  <Input type="datetime-local" className="rounded-xl h-11 bg-background/80 border-destructive/20 focus-visible:ring-destructive" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} />
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-white/10 hover:bg-white/5">Cancel</Button>
              <Button type="submit" disabled={upsert.isPending} className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20">{editId ? "Update Log" : "Save Log"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
