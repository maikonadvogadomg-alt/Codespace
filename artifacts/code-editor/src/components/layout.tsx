import React from "react";
import { Link, useLocation } from "wouter";
import { FolderGit2, Settings, Terminal, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout({ children, hideBottomNav }: { children: React.ReactNode; hideBottomNav?: boolean }) {
  const [location] = useLocation();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
        {/* Mobile top bar — only on non-project pages */}
        {!hideBottomNav && (
          <header className="h-11 shrink-0 flex items-center px-4 border-b border-border bg-sidebar z-20">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mr-3">
              <Code2 className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-foreground">CodeLens</span>
          </header>
        )}

        {/* Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>

        {/* Mobile bottom nav — hidden inside project explorer */}
        {!hideBottomNav && (
          <nav className="shrink-0 h-14 border-t border-border bg-sidebar flex items-center justify-around px-2 z-20">
            <MobileNavItem
              href="/"
              icon={<FolderGit2 className="w-5 h-5" />}
              label="Projetos"
              active={location === "/" || location.startsWith("/projects")}
            />
            <MobileNavItem
              href="/settings"
              icon={<Settings className="w-5 h-5" />}
              label="Config"
              active={location === "/settings"}
            />
          </nav>
        )}
      </div>
    );
  }

  // Desktop layout — unchanged
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
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
            title="Projetos"
          />
          <NavItem
            href="/settings"
            icon={<Settings className="w-5 h-5" />}
            active={location === "/settings"}
            title="Configurações"
            className="mt-auto"
          />
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {children}
      </main>

      <footer className="absolute bottom-0 left-14 right-0 h-6 border-t border-border bg-card flex items-center px-3 text-[11px] text-muted-foreground z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3" /> CodeLens Ready
          </span>
        </div>
      </footer>
    </div>
  );
}

function MobileNavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 px-5 py-1 rounded-lg transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function NavItem({
  href,
  icon,
  active,
  title,
  className,
}: {
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  title: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50",
        active && "text-foreground bg-accent",
        className
      )}
      title={title}
    >
      {active && (
        <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
      )}
      {icon}
    </Link>
  );
}
