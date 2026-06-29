import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
}

export function Tooltip({
    children,
    content,
    position = 'top',
    className = '',
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [actualPosition, setActualPosition] = useState(position);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const spacing = 8;

        let top = 0;
        let left = 0;
        let finalPosition = position;

        switch (position) {
            case 'top':
                top = triggerRect.top - tooltipRect.height - spacing;
                left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
                break;
            case 'bottom':
                top = triggerRect.bottom + spacing;
                left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
                break;
            case 'left':
                top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
                left = triggerRect.left - tooltipRect.width - spacing;
                break;
            case 'right':
                top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
                left = triggerRect.right + spacing;
                break;
        }

        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        if (left < 8) left = 8;
        if (top < 8) {
            top = triggerRect.bottom + spacing;
            finalPosition = 'bottom';
        }
        if (top + tooltipRect.height > window.innerHeight - 8 && position === 'bottom') {
            top = triggerRect.top - tooltipRect.height - spacing;
            finalPosition = 'top';
        }

        setCoords({ top, left });
        setActualPosition(finalPosition);
    }, [position]);

    useEffect(() => {
        if (!isVisible) return;

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        const handleOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            if (
                triggerRef.current?.contains(target) ||
                tooltipRef.current?.contains(target)
            ) {
                return;
            }
            setIsVisible(false);
        };

        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('touchstart', handleOutside);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('touchstart', handleOutside);
        };
    }, [isVisible, updatePosition]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`inline-flex border-0 bg-transparent p-0 text-left ${className}`}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
                onClick={() => setIsVisible((current) => !current)}
                aria-expanded={isVisible}
            >
                {children}
            </button>

            {isVisible && typeof document !== 'undefined' && createPortal(
                <div
                    ref={tooltipRef}
                    className="pointer-events-none fixed z-[9999]"
                    style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
                    role="tooltip"
                >
                    <div className="relative">
                        <div
                            className={`absolute h-2 w-2 rotate-45 border bg-slate-900 ${
                                actualPosition === 'top'
                                    ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r border-l-0 border-t-0'
                                    : actualPosition === 'bottom'
                                      ? 'top-[-4px] left-1/2 -translate-x-1/2 border-l border-t border-b-0 border-r-0'
                                      : actualPosition === 'left'
                                        ? 'right-[-4px] top-1/2 -translate-y-1/2 border-r border-t border-l-0 border-b-0'
                                        : 'left-[-4px] top-1/2 -translate-y-1/2 border-l border-b border-r-0 border-t-0'
                            }`}
                        />
                        <div className="w-[min(100vw-1.5rem,16rem)] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white shadow-2xl">
                            {content}
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
