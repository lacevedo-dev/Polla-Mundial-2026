import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:pointer-events-none disabled:opacity-50 active:scale-95 overflow-hidden",
    {
        variants: {
            variant: {
                primary:
                    "bg-black text-white hover:bg-slate-900 shadow-lg shadow-black/10",
                secondary:
                    "bg-lime-400 text-slate-950 hover:bg-lime-500 shadow-lg shadow-lime-400/20",
                outline:
                    "bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                link: "text-primary underline-offset-4 hover:underline",
                brand: "bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-500/20",
            },
            size: {
                default: "h-11 px-5 py-2.5",
                sm: "h-8 rounded-lg px-3 text-xs",
                lg: "h-14 rounded-2xl px-10 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
    isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, isLoading = false, children, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }), "relative")}
                ref={ref}
                disabled={isLoading || props.disabled}
                {...props}
            >
                <span className={cn(
                    "inline-flex items-center justify-center gap-2 transition-all duration-300",
                    isLoading ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"
                )}>
                    {children}
                    {isLoading && (
                        <span className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in duration-500">
                            <Loader2 className={cn(
                                "h-5 w-5 animate-spin",
                                variant === 'secondary' || variant === 'ghost' ? 'text-slate-900' : 'text-white'
                            )} />
                        </span>
                    )}
                </span>
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
