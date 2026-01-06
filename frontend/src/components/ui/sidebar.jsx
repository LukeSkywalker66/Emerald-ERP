/**
 * Sidebar Components - Shadcn/UI adaptados para Emerald
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

const SidebarContext = React.createContext({});

export function Sidebar({ className, children, ...props }) {
  return (
    <SidebarContext.Provider value={{}}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-zinc-950 text-zinc-50',
          className
        )}
        {...props}
      >
        {children}
      </aside>
    </SidebarContext.Provider>
  );
}

export function SidebarHeader({ className, ...props }) {
  return (
    <div
      className={cn('flex shrink-0 items-center', className)}
      {...props}
    />
  );
}

export function SidebarContent({ className, ...props }) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto', className)}
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }) {
  return (
    <div
      className={cn('shrink-0', className)}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }) {
  return (
    <div
      className={cn('space-y-1', className)}
      {...props}
    />
  );
}

export function SidebarGroupLabel({ className, ...props }) {
  return (
    <div
      className={cn('text-xs font-semibold', className)}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }) {
  return (
    <ul
      className={cn('space-y-1', className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({ className, ...props }) {
  return (
    <li
      className={cn('', className)}
      {...props}
    />
  );
}

export const SidebarMenuButton = React.forwardRef(
  ({ className, isActive, asChild = false, tooltip, children, ...props }, ref) => {
    const buttonContent = asChild ? (
      children
    ) : (
      <button
        ref={ref}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-zinc-800 hover:text-zinc-100',
          isActive && 'bg-emerald-500/10 text-emerald-300',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );

    if (tooltip) {
      return (
        <div className="group relative">
          {buttonContent}
          <div className="pointer-events-none absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 whitespace-nowrap z-50">
            {tooltip}
          </div>
        </div>
      );
    }

    return buttonContent;
  }
);

SidebarMenuButton.displayName = 'SidebarMenuButton';
