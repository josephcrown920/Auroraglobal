import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wand2,
  Images,
  Film,
  Bookmark,
  Library,
  Workflow,
  Settings,
  BookOpen,
  Sparkles,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Studio",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Playground", url: "/playground", icon: Wand2 },
    ],
  },
  {
    label: "Library",
    items: [
      { title: "Gallery", url: "/gallery", icon: Images },
      { title: "Videos", url: "/videos", icon: Film },
      { title: "References", url: "/references", icon: Library },
      { title: "Prompts", url: "/prompts", icon: Bookmark },
    ],
  },
  {
    label: "Automation",
    items: [
      { title: "Workflows", url: "/workflows", icon: Workflow },
      { title: "Docs", url: "/docs", icon: BookOpen },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon" className="glass-strong">
      <SidebarHeader className="border-b border-sidebar-border/50">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">AI Studio</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Creative OS
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50">
        <div className="px-2 py-1 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          v1 · Lovable AI Gateway
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
