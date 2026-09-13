import * as React from "react";

import { cn } from "./styles";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  variant?: "transparent" | "muted" | "accent";
  size?: "small" | "medium";
};

export function Button({
  className,
  size = "medium",
  variant = "muted",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-white/10 font-medium text-white transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]",
        size === "small" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
        variant === "transparent" ? "bg-transparent hover:bg-white/10" : null,
        variant === "muted" ? "bg-white/8 hover:bg-white/14" : null,
        variant === "accent" ? "bg-[var(--theme-accent)] text-black hover:brightness-105" : null,
        className,
      )}
      {...props}
    />
  );
}

export function Callout({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-white/10 bg-white/8 p-4", className)} {...props} />;
}

type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  description?: React.ReactNode;
  label?: React.ReactNode;
};

export function Field({ children, className, description, label, ...props }: FieldProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", className)} {...props}>
      {label || description ? (
        <div className="min-w-0 flex-1">
          {label ? <div className="text-sm font-medium text-white">{label}</div> : null}
          {description ? <div className="mt-0.5 text-xs text-white/60">{description}</div> : null}
        </div>
      ) : null}
      <div className="shrink-0">{children}</div>
    </div>
  );
}

type FieldSetProps = Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  description?: React.ReactNode;
  title?: React.ReactNode;
};

export function FieldSet({ children, className, description, title, ...props }: FieldSetProps) {
  return (
    <section className={cn("rounded-xl border border-white/10 bg-white/[0.03] p-4", className)} {...props}>
      {title ? <h2 className="text-sm font-semibold text-white">{title}</h2> : null}
      {description ? <p className="mt-1 text-xs text-white/60">{description}</p> : null}
      <div className={title || description ? "mt-3" : undefined}>{children}</div>
    </section>
  );
}

export function FieldGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("divide-y divide-white/10", className)} {...props} />;
}

type SegmentedControlProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> & {
  onValueChange?: (value: string) => void;
  value?: string;
};

const SegmentedControlContext = React.createContext<{
  value?: string;
  setValue(value: string): void;
} | null>(null);

export function SegmentedControl({
  children,
  className,
  onValueChange,
  value,
  ...props
}: SegmentedControlProps) {
  return (
    <SegmentedControlContext.Provider value={{ value, setValue: (next) => onValueChange?.(next) }}>
      <div className={cn("inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5", className)} {...props}>
        {children}
      </div>
    </SegmentedControlContext.Provider>
  );
}

export function SegmentedControlItem({
  children,
  value,
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = React.useContext(SegmentedControlContext);
  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-2.5 py-1 text-xs text-white/60",
        context?.value === value ? "bg-white/15 text-white" : null,
      )}
      onClick={() => context?.setValue(value)}
    >
      {children}
    </button>
  );
}
