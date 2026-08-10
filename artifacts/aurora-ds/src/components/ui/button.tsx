import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * Aurora Button — extends the shadcn base with two Aurora-specific variants:
 *   • premium — violet gradient hero background + glow shadow (CTA / paid actions)
 *   • glass   — frosted glass surface, strong-border, backdrop-blur (secondary UI)
 *
 * The "liquid" feel (soft inner highlight on hover, spring-scale on press) is
 * implemented via .btn-liquid in the consuming app's styles.css; it is purely
 * additive and never overrides a variant's colour.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-all duration-200 ease-out active:scale-[0.97] active:duration-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:     "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:   "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost:       "hover:bg-accent hover:text-accent-foreground",
        link:        "text-primary underline-offset-4 hover:underline",
        /** Aurora premium — violet gradient + glow. Use for primary CTAs and paid actions. */
        premium:
          "bg-gradient-to-br from-[#7b2fff] via-[#9343ff] to-[#b56bff] text-white shadow-[0_8px_30px_-10px_rgba(147,67,255,0.6)] hover:brightness-110 hover:shadow-[0_12px_40px_-10px_rgba(147,67,255,0.75)] transition-[filter,box-shadow]",
        /** Aurora glass — frosted surface. Use for secondary controls over dark backgrounds. */
        glass:
          "border border-white/20 bg-white/8 text-foreground backdrop-blur-md hover:bg-white/14 hover:brightness-110 transition-[filter,background-color]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-10 rounded-md px-8",
        xl:      "h-11 rounded-xl px-6 text-base",
        pill:    "h-9 rounded-full px-5",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
