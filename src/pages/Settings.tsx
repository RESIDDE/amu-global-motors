import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Shield, ShieldAlert, ShieldCheck, User, Users, Settings2,
  ToggleLeft, Eye, Pencil, RotateCcw, Crown, Lock, Activity,
  UserPlus, ArrowRightLeft, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  ALL_PAGES, getPermissions, savePermissions, resetPermissions,
  DEFAULT_PERMISSIONS, type AppRole, type PageKey,
} from "@/lib/permissions";
import { logAction, describeLog } from "@/lib/logger";

type Tab = "team" | "permissions" | "audit";

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  super_admin: { label: "Super Admin", color: "text-amber-400",   icon: <Crown className="w-3.5 h-3.5" /> },
  admin:       { label: "Admin",       color: "text-emerald-500", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  sales:       { label: "Sales",       color: "text-blue-400",    icon: <User className="w-3.5 h-3.5" /> },
  mechanic:    { label: "Mechanic",    color: "text-violet-400",  icon: <Settings2 className="w-3.5 h-3.5" /> },
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500/10 text-emerald-500",
  UPDATE: "bg-blue-500/10 text-blue-500",
  DELETE: "bg-rose-500/10 text-rose-500",
  LOGIN:  "bg-amber-500/10 text-amber-500",
  SIGNUP: "bg-amber-500/10 text-amber-500",
  INVITE: "bg-violet-500/10 text-violet-500",
  ROLE_CHANGE: "bg-sky-500/10 text-sky-500",
  EXPORT: "bg-indigo-500/10 text-indigo-500",
};

// A secondary, isolated Supabase client for creating new users.
// This prevents the signUp call from overwriting the super-admin's own session.
const anonClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default function Settings() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("team");
  const [permissions, setPermissions] = useState(() => getPermissions());
  const [permDirty, setPermDirty] = useState(false);

  // ── Invite User State ──────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", displayName: "", password: "", role: "mechanic" });
  const [inviting, setInviting] = useState(false);

  // ── Transfer Super Admin State ─────────────────────────────────────────────
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferDowngradeTo, setTransferDowngradeTo] = useState("admin");
  const [transferring, setTransferring] = useState(false);

  if (role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4 animate-fade-up">
        <Lock className="w-12 h-12 text-muted-foreground/30" />
        <h2 className="text-xl font-bold">Super Admin Only</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          The Settings panel is restricted to Super Admins. Contact your super admin to manage roles and access.
        </p>
      </div>
    );
  }

  // ── Team Query ─────────────────────────────────────────────────────────────
  const { data: usersData = [], isLoading } = useQuery({
    queryKey: ["users-roles"],
    queryFn: async () => {
      const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] = await Promise.all([
        (supabase as any).from("user_roles").select("*"),
        (supabase as any).from("profiles").select("*"),
      ]);
      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;
      return roles.map((r: any) => ({
        ...r,
        profile: profiles.find((p: any) => p.user_id === r.user_id) || null,
      }));
    },
  });

  // ── Audit Logs Query ───────────────────────────────────────────────────────
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_logs")
        .select("*, profiles:user_id(display_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: role === "super_admin" && tab === "audit",
  });

  // ── Update Role Mutation ───────────────────────────────────────────────────
  const updateRole = useMutation({
    mutationFn: async ({ id, newRole, targetName }: { id: string; newRole: string; targetName?: string }) => {
      const { error } = await (supabase as any)
        .from("user_roles").update({ role: newRole }).eq("id", id);
      if (error) throw error;
      await logAction("ROLE_CHANGE", "user_roles", id, { new_role: newRole, target_name: targetName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-roles"] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Claim Super Admin ──────────────────────────────────────────────────────
  const claimSuperAdmin = async () => {
    if (!user) return toast.error("Not logged in");
    const { error } = await (supabase as any)
      .from("user_roles")
      .upsert({ user_id: user.id, role: "super_admin" }, { onConflict: "user_id" });
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Super Admin claimed! Reloading...");
      setTimeout(() => window.location.reload(), 900);
    }
  };

  // ── Invite New User ────────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.password || !inviteForm.displayName) {
      toast.error("Please fill in all fields");
      return;
    }
    if (inviteForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setInviting(true);
    try {
      // Use the isolated client so super admin's session is untouched
      const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
        email: inviteForm.email,
        password: inviteForm.password,
        options: { data: { display_name: inviteForm.displayName } },
      });
      if (signUpError) throw signUpError;

      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error("User creation failed — no ID returned.");

      // Create profile
      await (supabase as any).from("profiles").upsert({
        user_id: newUserId,
        display_name: inviteForm.displayName,
      }, { onConflict: "user_id" });

      // Assign role
      await (supabase as any).from("user_roles").upsert({
        user_id: newUserId,
        role: inviteForm.role,
      }, { onConflict: "user_id" });

      await logAction("INVITE", "users", newUserId, {
        invited_email: inviteForm.email,
        assigned_role: inviteForm.role,
        invited_name: inviteForm.displayName,
      });

      queryClient.invalidateQueries({ queryKey: ["users-roles"] });
      toast.success(`✅ Account created for ${inviteForm.displayName}! They can now log in with the credentials you set.`);
      setInviteOpen(false);
      setInviteForm({ email: "", displayName: "", password: "", role: "mechanic" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setInviting(false);
    }
  };

  // ── Transfer Super Admin ───────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!transferTarget) return toast.error("Please select a user to transfer to");
    if (!user) return;
    setTransferring(true);
    try {
      const targetUser = usersData.find((u: any) => u.user_id === transferTarget);
      const myEntry = usersData.find((u: any) => u.user_id === user.id);

      if (!targetUser || !myEntry) throw new Error("Could not find user records");

      // Elevate target to super_admin
      await (supabase as any).from("user_roles").update({ role: "super_admin" }).eq("id", targetUser.id);
      // Downgrade self
      await (supabase as any).from("user_roles").update({ role: transferDowngradeTo }).eq("id", myEntry.id);

      await logAction("ROLE_CHANGE", "user_roles", targetUser.id, {
        action: "super_admin_transfer",
        transferred_to: targetUser.profile?.display_name,
        previous_admin_downgraded_to: transferDowngradeTo,
      });

      toast.success(`Super Admin transferred to ${targetUser.profile?.display_name || "user"}. Reloading...`);
      setTransferOpen(false);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  // ── Permissions helpers ────────────────────────────────────────────────────
  const togglePerm = (r: Exclude<AppRole, "super_admin">, page: PageKey) => {
    setPermissions((prev) => {
      const currentView = prev[r]?.view ?? [];
      const currentEdit = prev[r]?.edit ?? [];
      const hasView = currentView.includes(page);
      const hasEdit = currentEdit.includes(page);
      let nextView = [...currentView];
      let nextEdit = [...currentEdit];
      if (!hasView && !hasEdit) { nextView.push(page); }
      else if (hasView && !hasEdit) { nextEdit.push(page); }
      else { nextView = nextView.filter((p) => p !== page); nextEdit = nextEdit.filter((p) => p !== page); }
      return { ...prev, [r]: { view: nextView, edit: nextEdit } };
    });
    setPermDirty(true);
  };

  const savePerms = () => { savePermissions(permissions); setPermDirty(false); toast.success("Permissions saved"); };
  const resetPerms = () => { resetPermissions(); setPermissions({ ...DEFAULT_PERMISSIONS }); setPermDirty(false); toast.success("Permissions reset to defaults"); };

  const configurableRoles: Exclude<AppRole, "super_admin">[] = ["admin", "sales", "mechanic"];
  const otherUsers = usersData.filter((u: any) => u.user_id !== user?.id);

  return (
    <div className="space-y-8 animate-fade-up max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium uppercase tracking-wider text-amber-400">Super Admin</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/70 tracking-tight">
            Admin Controls
          </h1>
          <p className="text-base text-muted-foreground mt-2 max-w-xl">
            Manage your team's roles, configure page access, invite users, and monitor system activity.
          </p>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {/* Transfer Super Admin */}
          <Button
            variant="outline"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-2 rounded-xl"
            onClick={() => { setTransferTarget(""); setTransferOpen(true); }}
          >
            <ArrowRightLeft className="w-4 h-4" /> Transfer Role
          </Button>
          {/* First-time claim fallback */}
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25 font-bold gap-2 rounded-xl"
            onClick={claimSuperAdmin}
          >
            <Crown className="w-4 h-4" /> Claim Super Admin
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-foreground/5 rounded-2xl gap-1 max-w-md overflow-x-auto">
        {([["team", "Team", <Users className="w-4 h-4 shrink-0" />], ["permissions", "Permissions", <Shield className="w-4 h-4 shrink-0" />], ["audit", "Audit Logs", <Activity className="w-4 h-4 shrink-0" />]] as const).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
              tab === key ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── TEAM TAB ── */}
      {tab === "team" && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" /> Team Directory
            </h2>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 rounded-xl gap-2"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="w-4 h-4" /> Invite User
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />)}</div>
          ) : usersData.length === 0 ? (
            <div className="text-center p-8 border border-white/5 bg-white/5 rounded-2xl">
              <p className="text-muted-foreground">No users found yet. Invite users using the button above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {usersData.map((u: any) => {
                const profile = u.profile;
                const isSelf = u.user_id === user?.id;
                const rc = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.mechanic;
                return (
                  <div key={u.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${isSelf ? "bg-amber-500/5 border-amber-500/20" : "bg-background/40 border-white/5 hover:border-white/10"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${isSelf ? "bg-amber-500 text-white" : "bg-foreground/10 text-foreground"}`}>
                        {profile?.display_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <h3 className="font-bold flex items-center gap-2 flex-wrap">
                          {profile?.display_name || "Unknown User"}
                          {isSelf && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 tracking-wider uppercase">You</span>}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/5 flex items-center gap-1 ${rc.color}`}>
                            {rc.icon}{rc.label}
                          </span>
                        </h3>
                        <p className="text-sm text-muted-foreground">{profile?.phone || "No phone on record"}</p>
                      </div>
                    </div>

                    <Select
                      value={u.role}
                      onValueChange={(val) => {
                        if (isSelf && val !== "super_admin") {
                          if (!window.confirm("⚠️ Warning: Removing your own Super Admin role will lock you out of this page. Proceed?")) return;
                        }
                        updateRole.mutate({ id: u.id, newRole: val, targetName: profile?.display_name });
                      }}
                      disabled={updateRole.isPending}
                    >
                      <SelectTrigger className="w-[160px] rounded-xl bg-background/50 border-white/10 h-10 font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass-panel font-medium rounded-xl">
                        <SelectItem value="super_admin" className="rounded-lg font-bold text-amber-400">⭐ Super Admin</SelectItem>
                        <SelectItem value="admin" className="rounded-lg font-bold text-emerald-500">Admin</SelectItem>
                        <SelectItem value="sales" className="rounded-lg text-blue-400">Sales</SelectItem>
                        <SelectItem value="mechanic" className="rounded-lg text-violet-400">Mechanic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PERMISSIONS TAB ── */}
      {tab === "permissions" && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-400" /> Permissions Matrix
            </h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={resetPerms}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
              <Button size="sm" disabled={!permDirty} className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white gap-1.5" onClick={savePerms}>
                Save Changes{permDirty ? " *" : ""}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Click to cycle through: <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-foreground/5 text-muted-foreground"><ToggleLeft className="w-3.5 h-3.5" /> None</span> → <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-500"><Eye className="w-3.5 h-3.5" /> View/Add</span> → <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500"><Pencil className="w-3.5 h-3.5" /> View/Add/Edit</span>. <span className="text-amber-400 font-semibold ml-1">Super Admin</span> always has full access.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr>
                  <th className="text-left pb-4 text-sm font-semibold text-muted-foreground pr-6 w-44">Page</th>
                  {configurableRoles.map((r) => {
                    const rc = ROLE_CONFIG[r];
                    return (
                      <th key={r} className="pb-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-sm font-bold ${rc.color}`}>
                          {rc.icon}{rc.label}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ALL_PAGES.map((page) => (
                  <tr key={page.key} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 pr-6 text-sm font-medium text-foreground">{page.label}</td>
                    {configurableRoles.map((r) => {
                      const hasView = (permissions[r]?.view ?? []).includes(page.key);
                      const hasEdit = (permissions[r]?.edit ?? []).includes(page.key);
                      let btnClass = "bg-foreground/5 text-muted-foreground/30 hover:bg-foreground/10";
                      let title = "Grant View access";
                      let icon = <ToggleLeft className="w-5 h-5" />;
                      if (hasView && !hasEdit) { btnClass = "bg-blue-500/20 text-blue-500 hover:bg-blue-500/30"; title = "Grant Edit access"; icon = <Eye className="w-5 h-5" />; }
                      else if (hasView && hasEdit) { btnClass = "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"; title = "Revoke all access"; icon = <Pencil className="w-4 h-4" />; }
                      return (
                        <td key={r} className="py-3.5 text-center">
                          <button onClick={() => togglePerm(r, page.key)} className={`inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all ${btnClass}`} title={title}>
                            {icon}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-6 border-t border-white/5 pt-4">
            Permissions are saved locally and apply immediately on next page navigation.
            {permDirty && <span className="ml-2 text-amber-400 font-semibold">⚠ Unsaved changes</span>}
          </p>
        </div>
      )}

      {/* ── AUDIT TAB ── */}
      {tab === "audit" && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-[80px] pointer-events-none" />
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-400" /> System Audit Logs
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Full activity trail for all users — showing latest 200 events, most recent first.
          </p>

          {isLoadingLogs ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center gap-3">
              <Activity className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-muted-foreground">No activity recorded yet.</p>
              <p className="text-xs text-muted-foreground/60">Make sure the <code className="bg-white/5 px-1 py-0.5 rounded">audit_logs</code> table exists in Supabase.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => {
                const userName = log.profiles?.display_name || log.details?._user_name || null;
                const actionColor = ACTION_COLORS[log.action] || "bg-foreground/10 text-foreground";
                const description = describeLog(log);
                return (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-background/40 border border-white/5 hover:border-white/10 transition-all">
                    {/* Avatar / initial */}
                    <div className="shrink-0 h-9 w-9 rounded-full bg-foreground/10 flex items-center justify-center font-bold text-sm">
                      {userName ? userName.charAt(0).toUpperCase() : "?"}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{userName || <span className="italic text-muted-foreground/50">System</span>}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${actionColor}`}>
                          {log.action}
                        </span>
                        {log.entity_type && (
                          <span className="text-[10px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-md font-mono uppercase">
                            {log.entity_type}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{description}</p>
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-muted-foreground/60">
                        {new Date(log.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground/40">
                        {new Date(log.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── INVITE USER DIALOG ── */}
      <Dialog open={inviteOpen} onOpenChange={(v) => !inviting && setInviteOpen(v)}>
        <DialogContent className="max-w-md rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-foreground/5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-400" /> Invite New User
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Create the account and set the password. Share the credentials with the new team member afterward.
              </p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name</Label>
              <Input
                placeholder="e.g. John Doe"
                className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-amber-500"
                value={inviteForm.displayName}
                onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-amber-500"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Set Password</Label>
              <Input
                type="password"
                placeholder="Min. 6 characters"
                className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-amber-500"
                value={inviteForm.password}
                onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">You're setting this password. Share it securely with the user.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assign Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-amber-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel rounded-xl">
                  <SelectItem value="admin" className="rounded-lg text-emerald-500 font-bold">Admin</SelectItem>
                  <SelectItem value="sales" className="rounded-lg text-blue-400">Sales</SelectItem>
                  <SelectItem value="mechanic" className="rounded-lg text-violet-400">Mechanic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting} className="rounded-xl border-white/10">
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20">
              {inviting ? "Creating Account..." : "Create & Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TRANSFER SUPER ADMIN DIALOG ── */}
      <Dialog open={transferOpen} onOpenChange={(v) => !transferring && setTransferOpen(v)}>
        <DialogContent className="max-w-md rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-6 border-b border-white/5 bg-amber-500/5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-400">
                <ArrowRightLeft className="h-5 w-5" /> Transfer Super Admin Role
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                This will promote the selected user to Super Admin and demote you to the selected role.
              </p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-500/80">
                This action will immediately revoke your Super Admin access. Make sure you trust the user you're promoting.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transfer Super Admin To</Label>
              <Select value={transferTarget} onValueChange={setTransferTarget}>
                <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-amber-500">
                  <SelectValue placeholder="Select a team member..." />
                </SelectTrigger>
                <SelectContent className="glass-panel rounded-xl">
                  {otherUsers.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id} className="rounded-lg">
                      {u.profile?.display_name || "Unknown User"} — <span className="opacity-60">{ROLE_CONFIG[u.role]?.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Downgrade My Role To</Label>
              <Select value={transferDowngradeTo} onValueChange={setTransferDowngradeTo}>
                <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-amber-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel rounded-xl">
                  <SelectItem value="admin" className="rounded-lg text-emerald-500 font-bold">Admin</SelectItem>
                  <SelectItem value="sales" className="rounded-lg text-blue-400">Sales</SelectItem>
                  <SelectItem value="mechanic" className="rounded-lg text-violet-400">Mechanic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferring} className="rounded-xl border-white/10">
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferring || !transferTarget}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20"
            >
              {transferring ? "Transferring..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
