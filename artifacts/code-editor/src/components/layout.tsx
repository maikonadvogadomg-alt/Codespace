import React from "react";
import { Link, useLocation } from "wouter";
import { 
  FolderGit2, 
  Settings, 
  Terminal,
  Code2
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-14 flex flex-col items-center py-4 border-r border-border bg-sidebar shrink-0 z-10">
        <div className="mb-8">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Code2 className="w-5 h-5" />
          </div>
        </div>

        <nav className="flex flex-col gap-4 flex-1 w-full px-2">
          <NavItem 
            href="/" 
            icon={<FolderGit2 className="w-5 h-5" />} 
            active={location === "/" || location.startsWith("/projects")}
            title="Projects"
          />
          {/* Future expansion: Search, Git, Extensions etc */}
          <NavItem 
            href="/settings" 
            icon={<Settings className="w-5 h-5" />} 
            active={location === "/settings"}
            title="Settings"
            className="mt-auto"
          />
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {children}
      </main>
      
      {/* Bottom Status Bar */}
      <footer className="absolute bottom-0 left-14 right-0 h-6 border-t border-border bg-card flex items-center px-3 text-[11px] text-muted-foreground z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><Terminal className="w-3 h-3"/> CodeLens Ready</span>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ 
  href, 
  icon, 
  active, 
  title,
  className 
}: { 
  href: string; 
  icon: React.ReactNode; 
  active?: boolean;
  title: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(
      "relative flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50",
      active && "text-foreground bg-accent",
      className
    )} title={title}>
      {active && (
        <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
      )}
      {icon}
    </Link>
  );
}
