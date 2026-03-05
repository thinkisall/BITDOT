import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { HTMLAttributes, ButtonHTMLAttributes } from "react";

export function Pagination({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav className={cn("flex items-center justify-center", className)} {...props} />;
}

export function PaginationContent({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex items-center gap-1", className)} {...props} />;
}

export function PaginationItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("", className)} {...props} />;
}

interface PaginationLinkProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
}

export function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  return (
    <button
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
        isActive
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border/60 bg-card/60 text-foreground/80 hover:bg-secondary/50",
        className
      )}
      {...props}
    />
  );
}

export function PaginationPrevious({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-lg border border-border/60 bg-card/60 px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary/50",
        className
      )}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
      이전
    </button>
  );
}

export function PaginationNext({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-lg border border-border/60 bg-card/60 px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary/50",
        className
      )}
      {...props}
    >
      다음
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

export function PaginationEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("inline-flex h-9 w-9 items-center justify-center", className)} {...props}>
      <MoreHorizontal className="h-4 w-4" />
    </span>
  );
}
