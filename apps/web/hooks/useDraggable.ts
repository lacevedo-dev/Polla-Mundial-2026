import { useCallback, useEffect, useRef, useState } from 'react';

interface Position {
    x: number;
    y: number;
}

interface UseDraggableOptions {
    initialPosition?: Position;
    storageKey?: string;
    bounds?: 'window' | 'parent';
}

export function useDraggable(options: UseDraggableOptions = {}) {
    const { initialPosition = { x: 20, y: 20 }, storageKey, bounds = 'window' } = options;

    const [position, setPosition] = useState<Position>(() => {
        if (storageKey) {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch {
                    return initialPosition;
                }
            }
        }
        return initialPosition;
    });

    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const dragStartPos = useRef<Position>({ x: 0, y: 0 });
    const elementStartPos = useRef<Position>({ x: 0, y: 0 });

    const constrainPosition = useCallback((pos: Position): Position => {
        if (!dragRef.current) return pos;

        const rect = dragRef.current.getBoundingClientRect();
        const maxX = bounds === 'window' ? window.innerWidth - rect.width : (dragRef.current.parentElement?.clientWidth ?? window.innerWidth) - rect.width;
        const maxY = bounds === 'window' ? window.innerHeight - rect.height : (dragRef.current.parentElement?.clientHeight ?? window.innerHeight) - rect.height;

        return {
            x: Math.max(0, Math.min(pos.x, maxX)),
            y: Math.max(0, Math.min(pos.y, maxY)),
        };
    }, [bounds]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        e.preventDefault();
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        elementStartPos.current = position;
    }, [position]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        setIsDragging(true);
        dragStartPos.current = { x: touch.clientX, y: touch.clientY };
        elementStartPos.current = position;
    }, [position]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - dragStartPos.current.x;
            const deltaY = e.clientY - dragStartPos.current.y;
            const newPos = constrainPosition({
                x: elementStartPos.current.x + deltaX,
                y: elementStartPos.current.y + deltaY,
            });
            setPosition(newPos);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            const deltaX = touch.clientX - dragStartPos.current.x;
            const deltaY = touch.clientY - dragStartPos.current.y;
            const newPos = constrainPosition({
                x: elementStartPos.current.x + deltaX,
                y: elementStartPos.current.y + deltaY,
            });
            setPosition(newPos);
        };

        const handleEnd = () => {
            setIsDragging(false);
            if (storageKey) {
                localStorage.setItem(storageKey, JSON.stringify(position));
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('touchend', handleEnd);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, position, storageKey, constrainPosition]);

    return {
        ref: dragRef,
        position,
        isDragging,
        handleMouseDown,
        handleTouchStart,
        setPosition,
    };
}
