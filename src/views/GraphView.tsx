import { useState, useEffect, useRef, useCallback } from "react";
import mermaid from "mermaid";

type GraphViewProps = {
    graphData: string;
    onClose: () => void;
};

export function GraphView({ graphData, onClose }: GraphViewProps) {
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    const touchMoveHandlerRef = useRef<((e: TouchEvent) => void) | null>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            // securityLevel: "loose",
            fontFamily: "monospace",
        });
        setIsInitialized(true);
    }, []);

    useEffect(() => {
        if (!isInitialized || !graphData) return;

        const renderGraph = async () => {
            try {
                const id = `graph-${Date.now()}`;
                const { svg } = await mermaid.render(id, graphData);
                if (contentRef.current) {
                    contentRef.current.innerHTML = svg;
                    setError(null);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to render graph");
            }
        };

        renderGraph();
    }, [graphData, isInitialized]);

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey) {
            const delta = e.deltaY > 0 ? 0.95 : 1.05;
            setZoom((prev) => Math.max(0.1, Math.min(5, prev * delta)));
        } else {
            setPan((prev) => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY,
            }));
        }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0 && !isTouchDevice) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    }, [pan, isTouchDevice]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    }, [isDragging, dragStart]);

    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchInitialPan, setTouchInitialPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
    const [initialZoom, setInitialZoom] = useState(1);

    const calculateTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const calculateNativeTouchDistance = (touch1: Touch, touch2: Touch) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            setTouchStart({ x: touch.clientX, y: touch.clientY });
            setTouchInitialPan(pan);
            setIsPanning(false);
        } else if (e.touches.length === 2) {
            const distance = calculateTouchDistance(e.touches[0], e.touches[1]);
            setInitialPinchDistance(distance);
            setInitialZoom(zoom);
            setTouchStart(null);
            setIsPanning(false);
        }
    }, [pan, zoom]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length === 1 && touchStart) {
            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStart.x;
            const deltaY = touch.clientY - touchStart.y;

            const threshold = 10;

            if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
                setIsPanning(true);
                setPan({
                    x: touchInitialPan.x + deltaX,
                    y: touchInitialPan.y + deltaY,
                });
                e.preventDefault();
            }
        } else if (e.touches.length === 2 && initialPinchDistance !== null) {
            const currentDistance = calculateNativeTouchDistance(e.touches[0], e.touches[1]);
            const scale = currentDistance / initialPinchDistance;
            const newZoom = Math.max(0.1, Math.min(5, initialZoom * scale));
            setZoom(newZoom);
            e.preventDefault();
        }
    }, [touchStart, touchInitialPan, pan, isPanning, initialPinchDistance, initialZoom]);

    const handleTouchEnd = useCallback(() => {
        setTouchStart(null);
        setIsPanning(false);
        setInitialPinchDistance(null);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isTouchDevice) return;

        const boundTouchMove = (e: TouchEvent) => handleTouchMove(e);
        touchMoveHandlerRef.current = boundTouchMove;
        container.addEventListener('touchmove', boundTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchmove', boundTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isTouchDevice, handleTouchMove, handleTouchEnd]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") {
            onClose();
        } else if (e.key === "+" || e.key === "=") {
            setZoom((prev) => Math.min(5, prev * 1.2));
        } else if (e.key === "-") {
            setZoom((prev) => Math.max(0.1, prev * 0.8));
        } else if (e.key === "0") {
            setZoom(1);
            setPan({ x: 0, y: 0 });
        }
    }, [onClose]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener("wheel", handleWheel, { passive: false });
        }
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            if (container) {
                container.removeEventListener("wheel", handleWheel);
            }
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleWheel, handleKeyDown, handleMouseUp]);

    const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
            }}
        >
            <div
                style={{
                    backgroundColor: "#1e1e1e",
                    borderRadius: "12px",
                    width: "95vw",
                    height: "90vh",
                    maxWidth: "1400px",
                    display: "flex",
                    flexDirection: "column",
                    border: "1px solid #333",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                }}
            >
                <div
                    style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid #333",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <h2
                            style={{
                                margin: 0,
                                fontSize: "20px",
                                fontWeight: "bold",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                                color: "#fff",
                                letterSpacing: "0.05em",
                                lineHeight: "1.2",
                            }}
                        >
                            FUNCTION GRAPH
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#fff",
                            fontSize: "24px",
                            cursor: "pointer",
                            padding: "4px",
                            lineHeight: 1,
                            opacity: 0.7,
                            transition: "opacity 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.7";
                        }}
                    >
                        ×
                    </button>
                </div>

                <div
                    style={{
                        padding: "8px 16px",
                        borderBottom: "1px solid #333",
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        onClick={() => setZoom((prev) => Math.min(5, prev * 1.2))}
                        style={{
                            padding: "6px 12px",
                            backgroundColor: "#3d3d3d",
                            color: "#fff",
                            border: "1px solid #3d3d3d",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M12 5V19M5 12H19"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        Zoom In
                    </button>
                    <button
                        onClick={() => setZoom((prev) => Math.max(0.1, prev * 0.8))}
                        style={{
                            padding: "6px 12px",
                            backgroundColor: "#3d3d3d",
                            color: "#fff",
                            border: "1px solid #3d3d3d",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M5 12H19"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        Zoom Out
                    </button>
                    <button
                        onClick={() => {
                            setZoom(1);
                            setPan({ x: 0, y: 0 });
                        }}
                        style={{
                            padding: "6px 12px",
                            backgroundColor: "#3d3d3d",
                            color: "#fff",
                            border: "1px solid #3d3d3d",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "14px",
                        }}
                    >
                        Reset Zoom
                    </button>
                    <div
                        style={{
                            marginLeft: "auto",
                            padding: "4px 12px",
                            backgroundColor: "#2d2d2d",
                            borderRadius: "12px",
                            fontSize: "12px",
                            color: "#888",
                        }}
                    >
                        {Math.round(zoom * 100)}%
                    </div>
                </div>

                <div
                    ref={containerRef}
                    style={{
                        flex: 1,
                        overflow: "hidden",
                        position: "relative",
                        backgroundColor: "#181818",
                        cursor: isDragging ? "grabbing" : "grab",
                        touchAction: "none",
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onTouchStart={handleTouchStart}
                >
                    {error ? (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                height: "100%",
                                color: "#e74c3c",
                                padding: "20px",
                                textAlign: "center",
                            }}
                        >
                            <svg
                                width="48"
                                height="48"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                style={{ marginBottom: "16px" }}
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <div style={{ fontSize: "16px", marginBottom: "8px" }}>
                                Failed to render graph
                            </div>
                            <div style={{ fontSize: "14px", color: "#888" }}>
                                {error}
                            </div>
                        </div>
                    ) : (
                        <div
                            ref={contentRef}
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: `translate(-50%, -50%) ${transform}`,
                                transformOrigin: "center center",
                                minWidth: "100%",
                                minHeight: "100%",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            {!graphData && (
                                <div style={{ color: "#666", textAlign: "center" }}>
                                    No graph data available
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        padding: "12px 20px",
                        borderTop: "1px solid #333",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "12px",
                        color: "#666",
                        flexWrap: "wrap",
                        gap: "8px",
                    }}
                >
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <span>Drag or scroll to pan</span>
                        <span>• Press 0 to reset</span>
                    </div>
                    <span>Press Esc to close</span>
                </div>
            </div>
        </div>
    );
}
