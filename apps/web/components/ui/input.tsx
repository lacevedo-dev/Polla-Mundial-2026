import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    isLoading?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, isLoading, leftIcon, rightIcon, ...props }, ref) => {
        return (
            <div className="relative w-full group">
                {leftIcon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-lime-600">
                        {leftIcon}
                    </div>
                )}
                <input
                    type={type}
                    className={cn(
                        "flex h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium focus:ring-2 focus:ring-lime-400 focus:border-lime-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200",
                        leftIcon ? "pl-11" : "",
                        (rightIcon || isLoading) ? "pr-11" : "",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-lime-600" />
                    ) : (
                        rightIcon
                    )}
                </div>
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
