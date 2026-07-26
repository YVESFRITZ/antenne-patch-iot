"use client";

import { navItems } from "@/lib/navItems";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  alertCount: number;
}

export default function MobileNav({ activeTab, onTabChange, alertCount }: MobileNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-overlay bg-surface-raised/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                isActive ? "text-accent" : "text-ink-muted active:text-ink"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {item.id === "alerts" && alertCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-offline px-1 text-[9px] font-bold text-white">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{item.short}</span>
              {isActive && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
