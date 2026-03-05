import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "border-transparent bg-slate-100 text-slate-900",
                secondary: "border-transparent bg-lime-100 text-lime-900",
                brand: "border-transparent bg-lime-400 text-slate-950",
                destructive: "border-transparent bg-rose-500 text-slate-50",
                outline: "text-slate-950 border border-slate-200",
                success: "border-transparent bg-emerald-100 text-emerald-900",
                premium: "border-transparent bg-purple-100 text-purple-900",
                diamond: "border-transparent bg-cyan-100 text-cyan-900",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
