import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    position?: 'top' | 'bottom';
}

export function Tooltip({ children, content, position = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

        const updatePosition = () => {
            if (!triggerRef.current || !tooltipRef.current) return;
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            const spacing = 8;
            let top = position === 'top'
                ? triggerRect.top - tooltipRect.height - spacing
                : triggerRect.bottom + spacing;
            let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
            left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
            if (top < 8) top = triggerRect.bottom + spacing;
            setCoords({ top, left });
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isVisible, position]);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
                className="inline-block"
            >
                {children}
            </div>
            {isVisible && typeof window !== 'undefined' && createPortal(
                <div
                    ref={tooltipRef}
                    className="pointer-events-none fixed z-[9999]"
                    style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
                    role="tooltip"
                >
                    <div className="max-w-xs rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-2xl">
                        {content}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
