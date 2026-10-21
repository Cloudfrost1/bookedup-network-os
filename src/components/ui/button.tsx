import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-line text-sm font-bold transition-[transform,box-shadow,background-color] duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-hard-sm hover:translate-x-px hover:translate-y-px hover:shadow-none active:translate-x-0.5 active:translate-y-0.5",
        secondary: "bg-background text-foreground shadow-hard-sm hover:translate-x-px hover:translate-y-px hover:bg-subtle hover:shadow-none",
        dark: "bg-ink text-white shadow-hard-sm hover:translate-x-px hover:translate-y-px hover:shadow-none",
        ghost: "border-transparent text-foreground hover:bg-subtle",
        link: "border-0 px-0 text-primary underline-offset-4 hover:underline",
        danger: "bg-danger text-white shadow-hard-sm hover:translate-x-px hover:translate-y-px hover:shadow-none",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
