import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

type BaseProps = {
  className?: string;
  children?: React.ReactNode;
};

export function Card({ className, children }: BaseProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[var(--shadow)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
  );
}

export function InnerCard({ className, children }: BaseProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: BaseProps & {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--text)]">{title}</h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Pill({
  className,
  children,
  tone = "default",
}: BaseProps & {
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "accent"
      ? "border-[color:var(--accent)]/25 bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
      : tone === "success"
        ? "border-[color:var(--success)]/25 bg-[color:var(--success)]/10 text-[color:var(--success)]"
        : tone === "warning"
          ? "border-[color:var(--warning)]/25 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
          : tone === "danger"
            ? "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
            : "border-[color:var(--line)] bg-white/[0.025] text-[color:var(--muted)]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold leading-none",
        toneClass,
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "accent"
      ? "text-[color:var(--accent)]"
      : tone === "success"
        ? "text-[color:var(--success)]"
        : tone === "warning"
          ? "text-[color:var(--warning)]"
          : tone === "danger"
            ? "text-[color:var(--danger)]"
            : "text-[color:var(--text)]";

  return (
    <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
        {label}
      </p>
      <div className={cn("mt-3 text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{detail}</p>
      ) : null}
    </div>
  );
}

const fieldBase =
  "min-h-12 w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldBase, "min-h-28 resize-y", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldBase, className)} />;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variantClass =
    variant === "secondary"
      ? "border-[color:var(--line)] bg-[color:var(--surface-strong)] text-[color:var(--text)] hover:border-[color:var(--accent)]"
      : variant === "ghost"
        ? "border-transparent bg-transparent text-[color:var(--text)] hover:bg-white/5"
        : variant === "danger"
          ? "border-transparent bg-[color:var(--danger)] text-white hover:opacity-90"
          : "border-transparent bg-[color:var(--accent)] text-[#03121d] hover:brightness-110";

  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        variantClass,
        className
      )}
    />
  );
}

export function Divider({ className }: BaseProps) {
  return <div className={cn("h-px bg-[color:var(--line)]", className)} />;
}
