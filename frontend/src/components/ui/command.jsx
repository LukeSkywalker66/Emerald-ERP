/**
 * Componentes Command - Shadcn/UI
 * Usados para búsqueda, filtros y selección con estilo coherente
 */

import React from 'react';
import { cn } from '@/lib/utils';

const Command = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-md bg-zinc-950 text-zinc-50',
      className
    )}
    {...props}
  />
));
Command.displayName = 'Command';

const CommandInput = React.forwardRef(({ className, ...props }, ref) => (
  <div className="flex items-center border-b border-zinc-800 px-3" cmdk-input-wrapper="">
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = 'CommandInput';

const CommandList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)}
    {...props}
  />
));
CommandList.displayName = 'CommandList';

const CommandItem = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-zinc-800 aria-selected:text-zinc-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-zinc-800/50 transition-colors',
      className
    )}
    {...props}
  />
));
CommandItem.displayName = 'CommandItem';

const CommandSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('-mx-1 h-px bg-zinc-800', className)}
    {...props}
  />
));
CommandSeparator.displayName = 'CommandSeparator';

const CommandEmpty = React.forwardRef((props, ref) => (
  <div
    ref={ref}
    className="py-6 text-center text-sm text-zinc-500"
    {...props}
  />
));
CommandEmpty.displayName = 'CommandEmpty';

export {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandSeparator,
  CommandEmpty,
};
