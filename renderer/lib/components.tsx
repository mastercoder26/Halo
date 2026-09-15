import * as React from "react";

import { cn } from "./styles";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  variant?: "transparent" | "muted" | "accent" | "filled" | "destructive";
  size?: "small" | "medium";
};

export function Button({ className, size = "medium", variant = "muted", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "halo-button inline-flex items-center justify-center rounded-control font-medium transition-colors",
        size === "small" ? "halo-button--small" : "halo-button--medium",
        `halo-button--${variant}`,
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("halo-badge", className)} {...props} />;
}

export function Callout({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("halo-callout", className)} {...props} />;
}

type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  description?: React.ReactNode;
  label?: React.ReactNode;
  orientation?: "horizontal" | "vertical";
};

export function Field({ children, className, description, label, orientation = "horizontal", ...props }: FieldProps) {
  return (
    <div className={cn("halo-field", orientation === "vertical" && "halo-field--vertical", className)} {...props}>
      {label || description ? (
        <div className="halo-field-copy">
          {label ? <div className="halo-field-label">{label}</div> : null}
          {description ? <div className="halo-field-description">{description}</div> : null}
        </div>
      ) : null}
      <div className="halo-field-control">{children}</div>
    </div>
  );
}

type FieldSetProps = Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  description?: React.ReactNode;
  title?: React.ReactNode;
};

export function FieldSet({ children, className, description, title, ...props }: FieldSetProps) {
  return (
    <section className={cn("halo-fieldset", className)} {...props}>
      {title ? <h2 className="halo-fieldset-title">{title}</h2> : null}
      {description ? <p className="halo-fieldset-description">{description}</p> : null}
      <div className={title || description ? "halo-fieldset-content" : undefined}>{children}</div>
    </section>
  );
}

export function FieldGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("halo-field-group", className)} {...props} />;
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "small" | "medium" };

export function Input({ className, size = "medium", ...props }: InputProps) {
  return <input className={cn("halo-input", `halo-input--${size}`, className)} {...props} />;
}

type SegmentedControlProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> & {
  onValueChange?: (value: string) => void;
  value?: string;
  size?: "small" | "medium";
};

const SegmentedContext = React.createContext<{ value?: string; setValue(value: string): void } | null>(null);

export function SegmentedControl({ children, className, onValueChange, value, size = "medium", ...props }: SegmentedControlProps) {
  return (
    <SegmentedContext.Provider value={{ value, setValue: (next) => onValueChange?.(next) }}>
      <div className={cn("halo-segmented", `halo-segmented--${size}`, className)} {...props}>{children}</div>
    </SegmentedContext.Provider>
  );
}

export function SegmentedControlItem({ children, className, value, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = React.useContext(SegmentedContext);
  return (
    <button
      type="button"
      className={cn("halo-segmented-item", context?.value === value && "is-active", className)}
      onClick={() => context?.setValue(value)}
      {...props}
    >
      {children}
    </button>
  );
}

interface SelectProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

type SelectItemDescriptor = { value: string; label: React.ReactNode; disabled?: boolean };

function collectSelectItems(children: React.ReactNode, result: SelectItemDescriptor[] = []): SelectItemDescriptor[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { children?: React.ReactNode; value?: string; disabled?: boolean };
    if (child.type === SelectItem && typeof props.value === "string") {
      result.push({ value: props.value, label: props.children, disabled: props.disabled });
      return;
    }
    collectSelectItems(props.children, result);
  });
  return result;
}

function findSelectTrigger(children: React.ReactNode): React.ReactElement<SelectTriggerProps> | null {
  let found: React.ReactElement<SelectTriggerProps> | null = null;
  React.Children.forEach(children, (child) => {
    if (found || !React.isValidElement(child)) return;
    if (child.type === SelectTrigger) {
      found = child as React.ReactElement<SelectTriggerProps>;
      return;
    }
    found = findSelectTrigger((child.props as { children?: React.ReactNode }).children);
  });
  return found;
}

export function Select({ children, value, onValueChange, disabled }: SelectProps) {
  const items = collectSelectItems(children);
  const trigger = findSelectTrigger(children);
  return (
    <select
      className={cn("halo-select", trigger?.props.className)}
      value={value ?? ""}
      disabled={disabled}
      aria-label={trigger?.props["aria-label"]}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {!value ? <option value="" disabled>{trigger?.props.placeholder ?? "Choose…"}</option> : null}
      {items.map((item) => <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>)}
    </select>
  );
}

type SelectTriggerProps = React.HTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  size?: string;
  placeholder?: string;
};

export function SelectTrigger({ children }: SelectTriggerProps) { return <>{children}</>; }
export function SelectContent({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function SelectItem({ children }: { children: React.ReactNode; value: string; disabled?: boolean }) { return <>{children}</>; }
export function SelectValue({ placeholder }: { placeholder?: string }) { return <>{placeholder}</>; }

const TabsContext = React.createContext<{ value: string; onValueChange(value: string): void } | null>(null);

export function TabsRoot({ children, className, value, onValueChange }: { children: React.ReactNode; className?: string; value: string; onValueChange(value: string): void }) {
  return <TabsContext.Provider value={{ value, onValueChange }}><div className={className}>{children}</div></TabsContext.Provider>;
}

export function Tabs({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: string; size?: string }) {
  const { variant: _variant, size: _size, ...rest } = props;
  return <div role="tablist" className={cn("halo-tabs", className)} {...rest} />;
}

export function TabsTrigger({ className, value, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  return <button type="button" role="tab" aria-selected={context?.value === value} className={cn("halo-tab", context?.value === value && "is-active", className)} onClick={() => context?.onValueChange(value)} {...props} />;
}

export function TabsContent({ value, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  if (context?.value !== value) return null;
  return <div role="tabpanel" {...props} />;
}

export function ScrollArea({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("halo-scroll-area", className)} {...props} />;
}

type TextProps = React.HTMLAttributes<HTMLElement> & {
  as?: "span" | "p" | "div";
  color?: "secondary" | "tertiary";
  variant?: "small" | "strong";
};

export function Text({ as: Component = "span", className, color, variant, ...props }: TextProps) {
  return <Component className={cn("halo-text", color && `halo-text--${color}`, variant && `halo-text--${variant}`, className)} {...props} />;
}

type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "value" | "onChange"> & {
  value: number[];
  onValueChange(values: number[]): void;
  size?: string;
  variant?: string;
  endContent?: (value: number) => React.ReactNode;
};

export function Slider({ className, value, onValueChange, endContent, size: _size, variant: _variant, ...props }: SliderProps) {
  const current = value[0] ?? 0;
  return (
    <div className={cn("halo-slider", className)}>
      <input type="range" value={current} onChange={(event) => onValueChange([Number(event.target.value)])} {...props} />
      {endContent ? <span className="halo-slider-value">{endContent(current)}</span> : null}
    </div>
  );
}

type ToastKind = "error" | "success" | "message";
type ToastEvent = { id: number; kind: ToastKind; message: string };
const toastListeners = new Set<(event: ToastEvent) => void>();
let toastId = 0;

function publishToast(kind: ToastKind, message: string): void {
  const event = { id: ++toastId, kind, message };
  for (const listener of toastListeners) listener(event);
}

export const toast = {
  error: (message: string) => publishToast("error", message),
  success: (message: string) => publishToast("success", message),
  message: (message: string) => publishToast("message", message),
};

export function Toaster() {
  const [items, setItems] = React.useState<ToastEvent[]>([]);
  React.useEffect(() => {
    const listener = (event: ToastEvent) => {
      setItems((current) => [...current.slice(-2), event]);
      window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== event.id)), 3200);
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);
  return <div className="halo-toaster" aria-live="polite">{items.map((item) => <div key={item.id} className={`halo-toast halo-toast--${item.kind}`}>{item.message}</div>)}</div>;
}

export function TooltipProvider({ children }: { children: React.ReactNode }) { return <>{children}</>; }
