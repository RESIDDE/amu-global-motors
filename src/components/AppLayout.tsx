import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo_old_backup.png";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully.");
    navigate("/auth");
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Admin";

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background transition-colors duration-300">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-background sm:rounded-l-[2rem] sm:border-l sm:border-y sm:my-2 sm:mr-2 shadow-2xl relative overflow-hidden transition-all duration-300">
          <header className="sticky top-0 z-30 h-16 flex items-center border-b border-border/40 bg-background/40 backdrop-blur-xl px-4 sm:px-6 gap-2 print:hidden">
            <SidebarTrigger className="mr-2 -ml-2 rounded-full hover:bg-primary/10 transition-colors" />
            <img src={logo} alt="Beetee Autos logo" className="h-8 w-8 rounded-full object-cover shadow-sm border border-border/50" />
            <span className="text-lg font-heading font-semibold tracking-tight text-foreground truncate flex-1 uppercase tracking-widest">
              BEETEE AUTOMOBILE
            </span>

            {/* User info + Logout */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
              <div className="hidden sm:flex items-center gap-2 bg-foreground/5 border border-foreground/10 px-3 py-1.5 rounded-full">
                <User className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{displayName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-all gap-1.5 text-muted-foreground text-xs font-semibold"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 overflow-auto animate-fade-up">
            <div className="mx-auto max-w-7xl h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
