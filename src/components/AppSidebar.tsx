import {
  LayoutDashboard, Car, Users, MessageSquare, ClipboardCheck,
  Wrench, FileText, Settings, FileSignature, Crown,
} from "lucide-react";
import { NairaIcon } from "@/components/NairaIcon";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { getAccessiblePages, type AppRole, type PageKey } from "@/lib/permissions";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import logo from "@/assets/logo_old_backup.png";

type NavItem = {
  title: string;
  url: string;
  pageKey: PageKey | "settings"; // settings is always visible to super_admin
  icon: React.ComponentType<{ className?: string }>;
};

const ALL_NAV_ITEMS: NavItem[] = [
  { title: "Dashboard",    url: "/dashboard",         pageKey: "dashboard",        icon: LayoutDashboard },
  { title: "Vehicles",     url: "/vehicles",          pageKey: "vehicles",         icon: Car },
  { title: "Customers",    url: "/customers",         pageKey: "customers",        icon: Users },
  { title: "Sales",        url: "/sales",             pageKey: "sales",            icon: (props) => <NairaIcon {...props} /> },
  { title: "Invoices",     url: "/invoices",          pageKey: "invoices",         icon: FileText },
  { title: "Inquiries",    url: "/inquiries",         pageKey: "inquiries",        icon: MessageSquare },
  { title: "Inspections",  url: "/inspections",       pageKey: "inspections",      icon: ClipboardCheck },
  { title: "Repairs",      url: "/repairs",           pageKey: "repairs",          icon: Wrench },
  { title: "Auth. Form",   url: "/authority-to-sell", pageKey: "authority-to-sell", icon: FileSignature },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useAuth();

  const accessible = getAccessiblePages(role as AppRole | null);
  const isSuperAdmin = role === "super_admin";

  // Filter nav items to only show accessible pages
  const visibleItems = ALL_NAV_ITEMS.filter((item) =>
    accessible.includes(item.pageKey as PageKey)
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Beetee Autos logo" className="h-8 w-8 rounded-full object-cover" />
          {!collapsed && (
            <h1 className="text-lg font-bold text-sidebar-primary uppercase tracking-widest">
              BEETEE AUTOMOBILE
            </h1>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <div className="py-1">
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground w-full"
                      activeClassName="bg-primary/10 text-primary font-semibold shadow-sm"
                    >
                      {(() => { const Icon = item.icon; return <Icon className="h-5 w-5" />; })()}
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </div>
                </SidebarMenuItem>
              ))}

              {/* Settings — only for super_admin */}
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <div className="py-1">
                    <NavLink
                      to="/settings"
                      className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-amber-500/10 text-amber-500/70 hover:text-amber-500 w-full"
                      activeClassName="bg-amber-500/10 text-amber-500 font-semibold"
                    >
                      <Crown className="h-5 w-5" />
                      {!collapsed && <span>Settings</span>}
                    </NavLink>
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
