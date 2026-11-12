"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard,
  ListChecks,
  Send,
  ClipboardList,
  CheckCheck,
  Building2,
  Repeat,
  BarChart3,
  Workflow,
  Users,
  CircleHelp,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Avatar, BrandMark } from "@/components/ui";
import type { Role } from "@/lib/types";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";

type Item = { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; badge?: number };


export function Sidebar({
  name,
  role,
  avatar,
  reviewCount,
  reworkCount,
  initialCollapsed,
}: {
  name: string;
  role: Role;
  avatar: string | null;
  reviewCount: number;
  reworkCount: number;
  initialCollapsed: boolean;
}) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Remember the choice for next time (cookie, so the page renders the right way first time)
  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  // Keyboard shortcut: press [ to open or close the menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      setCollapsed((c) => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const all: Role[] = ["admin", "manager", "employee"];
  const mgr: Role[] = ["admin", "manager"];
  const groups: { label: string; items: Item[] }[] = [
    {
      label: "Daily work",
      items: [
        { href: "/overview", label: "Dashboard", icon: LayoutDashboard, roles: mgr },
        { href: "/my-work", label: "My tasks", icon: ListChecks, roles: all, badge: reworkCount },
        { href: "/allocate", label: "Assign task", icon: Send, roles: mgr },
        { href: "/reviews", label: "To review", icon: CheckCheck, roles: all, badge: reviewCount },
        { href: "/tasks", label: "All tasks", icon: ClipboardList, roles: mgr },
      ],
    },
    {
      label: "Setup",
      items: [
        { href: "/clients", label: "Clients", icon: Building2, roles: all },
        { href: "/templates", label: "Recurring tasks", icon: Repeat, roles: mgr },
        { href: "/reports", label: "Reports", icon: BarChart3, roles: mgr },
        { href: "/automation", label: "Automation plan", icon: Workflow, roles: all },
        { href: "/team", label: "Team", icon: Users, roles: ["admin"] },
        { href: "/help", label: "Help", icon: CircleHelp, roles: all },
      ],
    },
  ];

  const roleLabel = role === "admin" ? "Admin" : role === "manager" ? "Team manager" : "Team member";

  function Nav({ mini }: { mini: boolean }) {
    return (
      <nav className={clsx("flex flex-1 flex-col gap-4 pb-4", mini ? "items-center px-2" : "overflow-y-auto px-3")} aria-label="Main">
        {groups.map((g, gi) => {
          const items = g.items.filter((i) => i.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={g.label} className={clsx(mini && "flex w-full flex-col items-center")}>
              {mini ? (gi > 0 ? <span className="mb-3 block h-px w-6 bg-rule" aria-hidden="true" /> : null) : <p className="mb-1 px-2.5 text-xs font-medium text-fog">{g.label}</p>}
              <ul className={clsx("flex flex-col gap-px", mini && "items-center")}>
                {items.map((item) => {
                  const active = path === item.href || path.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="group/item relative">
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? "page" : undefined}
                        aria-label={mini ? item.label : undefined}
                        className={clsx(
                          "relative flex h-9 items-center rounded-md text-[0.8125rem] transition-[background-color,transform] duration-100 active:scale-[0.97]",
                          mini ? "w-10 justify-center" : "gap-2.5 px-2.5",
                          active ? "bg-paper font-medium text-ink shadow-[var(--shadow-1)]" : "text-graphite hover:bg-rule-soft hover:text-ink",
                        )}
                      >
                        <Icon size={mini ? 18 : 16} strokeWidth={active ? 2 : 1.75} className="shrink-0" />
                        {mini ? (
                          item.badge ? <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-coral ring-2 ring-canvas" aria-hidden="true" /> : null
                        ) : (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge ? (
                              <span className="num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral px-1 text-[0.6875rem] font-semibold text-paper">{item.badge}</span>
                            ) : null}
                          </>
                        )}
                      </Link>
                      {mini ? (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-paper opacity-0 shadow-[var(--shadow-3)] transition-opacity duration-100 group-hover/item:opacity-100 group-focus-within/item:opacity-100"
                        >
                          {item.label}
                          {item.badge ? ` (${item.badge})` : ""}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    );
  }

  function Footer({ mini }: { mini: boolean }) {
    return (
      <div className={clsx("flex border-t border-rule py-3", mini ? "flex-col items-center gap-2 px-2" : "items-center gap-2.5 px-4")}>
        <span title={mini ? `${name}, ${roleLabel}` : undefined}>
          <Avatar name={name} url={avatar} size={28} />
        </span>
        {!mini ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium">{name}</p>
            <p className="text-xs text-graphite">{roleLabel}</p>
          </div>
        ) : null}
        <form action="/auth/signout" method="post">
          <button className="btn btn-ghost btn-icon" aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <aside
        className={clsx(
          "material sticky top-0 z-20 hidden h-dvh shrink-0 flex-col border-r border-rule transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[68px]" : "w-[272px]",
        )}
      >
        <div className={clsx("flex items-center py-4", collapsed ? "flex-col gap-3 px-2" : "justify-between pr-2 pl-5")}>
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="GATP Solutions home">
            <BrandMark size={collapsed ? 30 : 26} />
            {!collapsed ? (
              <span className="leading-tight">
                <span className="block text-[0.875rem] font-semibold tracking-[-0.01em]">GATP Solutions</span>
                <span className="block text-xs text-graphite">Accounting work</span>
              </span>
            ) : null}
          </Link>
          <button
            className="btn btn-ghost btn-icon text-graphite"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Open menu" : "Close menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Open menu  [" : "Close menu  ["}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <Nav mini={collapsed} />
        <Footer mini={collapsed} />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="material-light sticky top-0 z-30 flex h-12 items-center justify-between border-b border-rule px-3 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={22} />
          <span className="text-[0.875rem] font-semibold">GATP Solutions</span>
        </Link>
        <button className="btn btn-ghost btn-icon" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
          <Menu size={18} />
        </button>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="scrim-enter absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <div className="drawer-enter absolute inset-y-0 left-0 flex w-[280px] flex-col bg-canvas shadow-[var(--shadow-3)]">
            <div className="flex items-center justify-between py-4 pr-2 pl-5">
              <span className="flex items-center gap-2.5">
                <BrandMark size={26} />
                <span className="text-[0.875rem] font-semibold">GATP Solutions</span>
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <Nav mini={false} />
            <Footer mini={false} />
          </div>
        </div>
      ) : null}
    </>
  );
}
