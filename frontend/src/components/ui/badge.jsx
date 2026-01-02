import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-zinc-800 text-zinc-300 border-zinc-700",
    outline: "border bg-transparent",
    emerald: "bg-emerald-950/50 text-emerald-400 border-emerald-500/30",
    ruby: "bg-red-950/50 text-red-400 border-red-500/30",
    gold: "bg-amber-950/50 text-amber-400 border-amber-500/30",
  };

  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});

Badge.displayName = "Badge";

export { Badge };
