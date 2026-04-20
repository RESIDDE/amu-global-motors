import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  Calendar, Users, FileText, CheckCircle2, XCircle, Clock, 
  ExternalLink, Search, Download, Trash2, Mail, Phone,
  ChevronRight, BadgeCheck, MessageSquare, AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statuses = ["Pending", "Approved", "Rejected", "Completed"];

export default function Meetings() {
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("meetings").select("*").order("booking_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await (supabase as any).from("meetings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Record deleted");
      setSelectedId(null);
    },
  });

  const filtered = meetings.filter(m => {
    const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || 
                          m.intent.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedMeeting = meetings.find(m => m.id === selectedId);

  const getProposalDownloadUrl = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from('proposals').createSignedUrl(path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      toast.error("Failed to generate download link");
    }
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-amber-500">Scheduling Hub</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight">Meetings & Proposals</h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
            Manage professional bookings and incoming business proposals from one central dashboard.
          </p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl" onClick={() => window.open('/book', '_blank')}>
              <ExternalLink className="mr-2 h-4 w-4" /> Open Public Form
           </Button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="glass-panel p-4 rounded-3xl border border-white/5 bg-white/[0.02]">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Total</p>
            <p className="text-2xl font-black">{meetings.length}</p>
         </div>
         <div className="glass-panel p-4 rounded-3xl border border-white/5 bg-amber-500/5">
            <p className="text-[10px] uppercase font-bold text-amber-500 tracking-widest mb-1">Pending</p>
            <p className="text-2xl font-black">{meetings.filter(m => m.status === 'Pending').length}</p>
         </div>
         <div className="glass-panel p-4 rounded-3xl border border-white/5 bg-emerald-500/5">
            <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest mb-1">Approved</p>
            <p className="text-2xl font-black">{meetings.filter(m => m.status === 'Approved').length}</p>
         </div>
         <div className="glass-panel p-4 rounded-3xl border border-white/5 bg-blue-500/5">
            <p className="text-[10px] uppercase font-bold text-blue-500 tracking-widest mb-1">Completed</p>
            <p className="text-2xl font-black">{meetings.filter(m => m.status === 'Completed').length}</p>
         </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-amber-500 transition-colors" />
          <Input 
            placeholder="Search applicants, intents..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-10 h-11 rounded-xl bg-background/50 border-white/10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl border-white/10 bg-background/50">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent className="glass-panel border-white/10">
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 w-full rounded-2xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-16 flex flex-col items-center justify-center text-center rounded-[2.5rem] border border-white/5 bg-background/30">
          <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No meeting requests found.</p>
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          <Table>
            <TableHeader className="bg-foreground/5">
              <TableRow className="border-white/5">
                <TableHead className="px-6 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Applicant</TableHead>
                <TableHead className="py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Meeting Intent</TableHead>
                <TableHead className="py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Requested Date</TableHead>
                <TableHead className="py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Proposal</TableHead>
                <TableHead className="py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                <TableHead className="text-right px-6 py-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id} className="border-white/5 group hover:bg-white/[0.02] transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-xs font-black">
                         {m.full_name.charAt(0)}
                       </div>
                       <div>
                         <p className="font-bold text-sm leading-none mb-1 group-hover:text-amber-500 transition-colors">{m.full_name}</p>
                         <p className="text-[10px] text-muted-foreground font-medium uppercase truncate max-w-[120px]">{m.contact_info.split('|')[0].replace('Phone:', '').trim()}</p>
                       </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                     <p className="text-sm font-medium">{m.intent}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                       <span className="text-sm font-bold">{format(new Date(m.booking_date), "MMM dd, yyyy")}</span>
                       <span className="text-[10px] text-muted-foreground font-semibold">{format(new Date(m.booking_date), "p")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.proposal_url ? (
                      <Button variant="ghost" size="sm" onClick={() => getProposalDownloadUrl(m.proposal_url)} className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 px-2 rounded-lg font-bold text-xs">
                        <Download className="h-3.5 w-3.5 mr-1.5" /> PDF/DOCX
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                      m.status === 'Pending' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                      m.status === 'Approved' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                      m.status === 'Rejected' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                      "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    )}>
                      {m.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedId(m.id)} className="rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10">
                       <ChevronRight className="h-5 w-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detailed Modal */}
      <Dialog open={!!selectedId} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent className="max-w-xl rounded-[2.5rem] glass-panel border-white/10 p-0 overflow-hidden shadow-2xl bg-background/95 backdrop-blur-2xl">
          {selectedMeeting && (
            <>
              <div className="p-8 border-b border-white/5 bg-amber-500/5 relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   <Calendar className="h-24 w-24" />
                </div>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight">{selectedMeeting.full_name}</DialogTitle>
                  <p className="text-sm font-bold text-amber-500 uppercase tracking-widest">{selectedMeeting.status} Request</p>
                </DialogHeader>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Contact Information</Label>
                      <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-2 text-sm font-bold"><Phone className="h-3.5 w-3.5 text-amber-500" /> {selectedMeeting.contact_info.split('|')[0].replace('Phone:', '').trim()}</div>
                         <div className="flex items-center gap-2 text-sm font-bold"><Mail className="h-3.5 w-3.5 text-amber-500" /> {selectedMeeting.contact_info.split('|')[1].replace('Email:', '').trim()}</div>
                      </div>
                   </div>
                   <div className="space-y-1 text-right">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Preferred Date</Label>
                      <p className="text-sm font-bold break-all">{format(new Date(selectedMeeting.booking_date), "PPP p")}</p>
                   </div>
                </div>

                <div className="space-y-2">
                   <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Proposal / Intent Statement</Label>
                   <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-sm leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                      {selectedMeeting.intent}
                   </div>
                </div>

                {selectedMeeting.proposal_url && (
                  <Button variant="outline" className="w-full rounded-2xl h-14 border-white/10 hover:bg-white/5 gap-3 font-bold" onClick={() => getProposalDownloadUrl(selectedMeeting.proposal_url)}>
                    <Download className="h-5 w-5 text-amber-500" /> Download Proposal Attachment
                  </Button>
                )}

                <div className="space-y-4 pt-4">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block text-center">Manage Status</Label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {statuses.map(s => (
                      <Button 
                        key={s} 
                        variant={selectedMeeting.status === s ? "default" : "outline"}
                        onClick={() => updateStatusMutation.mutate({ id: selectedMeeting.id, status: s })}
                        className={cn(
                          "rounded-xl h-12 px-6 font-bold transition-all",
                          selectedMeeting.status === s ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20" : "border-white/10"
                        )}
                        disabled={updateStatusMutation.isPending}
                      >
                         {s === 'Approved' && <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" />}
                         {s === 'Rejected' && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                         {s === 'Completed' && <BadgeCheck className="h-4 w-4 mr-2 text-blue-400" />}
                         {s === 'Pending' && <Clock className="h-4 w-4 mr-2" />}
                         {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-foreground/5 flex justify-between gap-4">
                <Button variant="ghost" className="rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-500" onClick={() => deleteMutation.mutate(selectedMeeting.id)}>
                   <Trash2 className="h-4 w-4 mr-2" /> Delete Record
                </Button>
                <Button onClick={() => setSelectedId(null)} className="rounded-xl px-10 bg-white/5 hover:bg-white/10 border border-white/10">Close Detail</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
