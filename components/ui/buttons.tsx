import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

// Primary: dark espresso pill. Secondary: outlined pill. Both >= 44px.
export function PrimaryButton({ className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "tap inline-flex items-center justify-center rounded-pill bg-espresso px-6 text-base font-semibold text-espresso-ink",
        "transition-opacity duration-150 hover:opacity-90 disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "tap inline-flex items-center justify-center rounded-pill border border-ink/25 bg-transparent px-6 text-base font-semibold",
        "transition-colors duration-150 hover:bg-ink/5 disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
