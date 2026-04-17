import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    /** Posición preferida del tooltip */
    position?: 'top' | 'bottom' | 'left' | 'right';
    /** Desactivar tooltip en móviles */
    disableOnMobile?: boolean;
}

/**
 * Tooltip accesible y responsive
 *
 * Características:
 * - Se posiciona automáticamente para no salirse de la pantalla
 * - Funciona con hover y focus (accesible)
 * - Se puede desactivar en móviles
 * - Renderiza en un portal para evitar z-index issues
 */
export const Tooltip: React.FC<TooltipProps> = ({
    children,
    content,
    position = 'top',
    disableOnMobile = false,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [actualPosition, setActualPosition] = useState(position);
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const updatePosition = () => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const spacing = 8; // espacio entre trigger y tooltip

        let top = 0;
        let left = 0;
        let finalPosition = position;

        // Calcular posición inicial según preferencia
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

        // Ajustar si se sale por la derecha
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }

        // Ajustar si se sale por la izquierda
        if (left < 8) {
            left = 8;
        }

        // Ajustar si se sale por arriba (cambiar a bottom)
        if (top < 8 && (position === 'top' || position === 'left' || position === 'right')) {
            top = triggerRect.bottom + spacing;
            finalPosition = 'bottom';
        }

        // Ajustar si se sale por abajo (cambiar a top)
        if (top + tooltipRect.height > window.innerHeight - 8 && position === 'bottom') {
            top = triggerRect.top - tooltipRect.height - spacing;
            finalPosition = 'top';
        }

        setCoords({ top, left });
        setActualPosition(finalPosition);
    };

    useEffect(() => {
        if (isVisible) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isVisible]);

    const handleShow = () => {
        if (disableOnMobile && isMobile) return;
        setIsVisible(true);
    };

    const handleHide = () => {
        setIsVisible(false);
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleShow}
                onMouseLeave={handleHide}
                onFocus={handleShow}
                onBlur={handleHide}
                className="inline-block"
                style={{ cursor: 'help' }}
            >
                {children}
            </div>

            {isVisible && typeof window !== 'undefined' && createPortal(
                <div
                    ref={tooltipRef}
                    className="pointer-events-none fixed z-[9999] animate-in fade-in-0 zoom-in-95 duration-200"
                    style={{
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                    }}
                    role="tooltip"
                >
                    <div className="relative">
                        {/* Flecha del tooltip */}
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

                        {/* Contenido del tooltip */}
                        <div className="max-w-xs rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-2xl">
                            {content}
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};
