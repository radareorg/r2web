import { useState, useEffect, useRef, useMemo } from "react";
import { parseAgfj } from "../utils/cfgParser";
import { layoutCFG, type LayoutResult } from "../utils/elkLayout";

const EDGE_COLORS = {
    true: "#4ade80",
    false: "#f87171",
    unconditional: "#94a3b8"
};

type CFGViewProps = {
    graphData: any;
    onClose: () => void;
};

function edgePath(points: Array<{ x: number; y: number }>): string {
    if (points.length < 2) return "";

    const [first, ...rest] = points;
    let d = `M ${first.x} ${first.y}`;

    for (const p of rest) {
        d += ` L ${p.x} ${p.y}`;
    }

    return d;
}

function arrowHead(
    points: Array<{ x: number; y: number }>,
    color: string
): React.JSX.Element | null {
    if (points.length < 2) return null;

    const to = points[points.length - 1];
    const from = points[points.length - 2];
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const size = 6;

    const x1 = to.x - size * Math.cos(angle - Math.PI / 6);
    const y1 = to.y - size * Math.sin(angle - Math.PI / 6);
    const x2 = to.x - size * Math.cos(angle + Math.PI / 6);
    const y2 = to.y - size * Math.sin(angle + Math.PI / 6);

    return (
        <polygon
            points={`${to.x},${to.y} ${x1},${y1} ${x2},${y2}`}
            fill={color}
        />
    );
}

export function CFGView({ graphData, onClose }: CFGViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null);
    const [layoutError, setLayoutError] = useState<string | null>(null);
    const [interactionMode, setInteractionMode] = useState<"pan" | "select">("pan");

    const zoomRef = useRef(zoom);
    const panRef = useRef(pan);
    const isDraggingRef = useRef(isDragging);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const layoutResultRef = useRef(layoutResult);
    const interactionModeRef = useRef(interactionMode);

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => {
        panRef.current = pan;
    }, [pan]);

    useEffect(() => {
        isDraggingRef.current = isDragging;
    }, [isDragging]);

    useEffect(() => {
        layoutResultRef.current = layoutResult;
    }, [layoutResult]);

    useEffect(() => {
        interactionModeRef.current = interactionMode;
    }, [interactionMode]);

    const cfgData = useMemo(() => parseAgfj(graphData), [graphData]);

    useEffect(() => {
        if (cfgData.blocks.length === 0) {
            setLayoutResult(null);
            return;
        }

        let cancelled = false;
        setLayoutError(null);

        layoutCFG(cfgData.blocks, cfgData.edges)
            .then(result => {
                if (!cancelled) {
                    setLayoutResult(result);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setLayoutError(err instanceof Error ? err.message : "Failed to compute layout");
                }
            });

        return () => { cancelled = true; };
    }, [cfgData]);

    useEffect(() => {
        if (!containerRef.current || !layoutResult) return;

        const rect = containerRef.current.getBoundingClientRect();
        const scaleX = rect.width / layoutResult.width;
        const scaleY = rect.height / layoutResult.height;
        const fit = Math.min(scaleX, scaleY, 1) * 0.95;

        setZoom(fit);
        setPan({ x: 0, y: 0 });
    }, [layoutResult]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();

            if (e.ctrlKey || e.metaKey) {
                const delta = e.deltaY > 0 ? 0.92 : 1.08;
                setZoom(prev => Math.max(0.05, Math.min(5, prev * delta)));
            } else {
                setPan(prev => ({
                    x: prev.x - e.deltaX,
                    y: prev.y - e.deltaY
                }));
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0 && interactionModeRef.current === "pan") {
                setIsDragging(true);
                dragStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingRef.current) {
                setPan({
                    x: e.clientX - dragStartRef.current.x,
                    y: e.clientY - dragStartRef.current.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "+" || e.key === "=") {
                setZoom(prev => Math.min(5, prev * 1.2));
            } else if (e.key === "-") {
                setZoom(prev => Math.max(0.1, prev * 0.8));
            } else if (e.key === "0") {
                setZoom(1);
                setPan({ x: 0, y: 0 });
            } else if (e.key === "s" || e.key === "S") {
                setInteractionMode(prev => prev === "pan" ? "select" : "pan");
            }
        };

        container.addEventListener("wheel", handleWheel, { passive: false });
        container.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            container.removeEventListener("wheel", handleWheel);
            container.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, interactionMode]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let touchStart: { x: number; y: number } | null = null;
        let touchInitialPan = { x: 0, y: 0 };
        let initialPinchDistance: number | null = null;
        let initialZoom = 1;

        const calculateTouchDistance = (touch1: Touch, touch2: Touch) => {
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                touchStart = { x: touch.clientX, y: touch.clientY };
                touchInitialPan = panRef.current;
            } else if (e.touches.length === 2) {
                const distance = calculateTouchDistance(e.touches[0], e.touches[1]);
                initialPinchDistance = distance;
                initialZoom = zoomRef.current;
                touchStart = null;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 1 && touchStart) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - touchStart.x;
                const deltaY = touch.clientY - touchStart.y;
                const threshold = 10;

                if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
                    setPan({
                        x: touchInitialPan.x + deltaX,
                        y: touchInitialPan.y + deltaY
                    });
                    e.preventDefault();
                }
            } else if (e.touches.length === 2 && initialPinchDistance !== null) {
                const currentDistance = calculateTouchDistance(e.touches[0], e.touches[1]);
                const scale = currentDistance / initialPinchDistance;
                const newZoom = Math.max(0.1, Math.min(5, initialZoom * scale));
                setZoom(newZoom);
                e.preventDefault();
            }
        };

        const handleTouchEnd = () => {
            touchStart = null;
            initialPinchDistance = null;
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    if (!layoutResult) {
        if (layoutError) {
            return (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 1000,
                        backgroundColor: "rgba(0, 0, 0, 0.6)"
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#1e1e1e",
                            borderRadius: "12px",
                            padding: "40px",
                            color: "#f87171",
                            border: "1px solid #333"
                        }}
                    >
                        <h2 style={{ margin: 0, marginBottom: "16px" }}>Error</h2>
                        <p style={{ margin: 0, color: "#888" }}>{layoutError}</p>
                        <button
                            onClick={onClose}
                            style={{
                                marginTop: "20px",
                                padding: "8px 16px",
                                backgroundColor: "#3d3d3d",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer"
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1000,
                    backgroundColor: "rgba(0, 0, 0, 0.6)"
                }}
            >
                <div
                    style={{
                        backgroundColor: "#1e1e1e",
                        borderRadius: "12px",
                        padding: "40px",
                        color: "#fff",
                        border: "1px solid #333"
                    }}
                >
                    <div style={{ textAlign: "center" }}>
                        <div
                            style={{
                                width: "40px",
                                height: "40px",
                                border: "3px solid #333",
                                borderTop: "3px solid #3498db",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite",
                                margin: "0 auto 16px"
                            }}
                        />
                        <p style={{ margin: 0 }}>Computing graph layout...</p>
                    </div>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
                backgroundColor: "rgba(0, 0, 0, 0.6)"
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
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
                }}
            >
                <div
                    style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid #333",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: "20px",
                                fontWeight: "bold",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                color: "#fff",
                                letterSpacing: "0.05em"
                            }}
                        >
                            {cfgData.functionName}
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
                            transition: "opacity 0.2s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.7"; }}
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
                        flexWrap: "wrap"
                    }}
                >
                    <button
                        onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
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
                            gap: "4px"
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Zoom In
                    </button>
                    <button
                        onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
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
                            gap: "4px"
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Zoom Out
                    </button>
                    <button
                        onClick={() => {
                            if (!containerRef.current || !layoutResultRef.current) return;
                            const rect = containerRef.current.getBoundingClientRect();
                            const scaleX = rect.width / layoutResultRef.current.width;
                            const scaleY = rect.height / layoutResultRef.current.height;
                            const fit = Math.min(scaleX, scaleY, 1) * 0.95;
                            setZoom(fit);
                            setPan({ x: 0, y: 0 });
                        }}
                        style={{
                            padding: "6px 12px",
                            backgroundColor: "#3d3d3d",
                            color: "#fff",
                            border: "1px solid #3d3d3d",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "14px"
                        }}
                    >
                        Reset
                    </button>
                    <div
                        style={{
                            marginLeft: "8px",
                            width: "1px",
                            height: "24px",
                            backgroundColor: "#3d3d3d"
                        }}
                    />
                    <button
                        onClick={() => setInteractionMode(prev => prev === "pan" ? "select" : "pan")}
                        style={{
                            padding: "6px 12px",
                            backgroundColor: interactionMode === "select" ? "#3b82f6" : "#3d3d3d",
                            color: "#fff",
                            border: `1px solid ${interactionMode === "select" ? "#3b82f6" : "#3d3d3d"}`,
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                        }}
                        title={interactionMode === "pan" ? "Switch to select mode (S)" : "Switch to pan mode (S)"}
                    >
                        {interactionMode === "pan" ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M18 11V5a2 2 0 00-2-2 2 2 0 00-2 2v0M14 10V3a2 2 0 00-2-2 2 2 0 00-2 2v9M10 12.5V4.5a2 2 0 00-2-2 2 2 0 00-2 2v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                <path d="M18 11a2 2 0 014 0v3a8 8 0 01-8 8h-2c-4.418 0-8-3.582-8-8v-1a2 2 0 014 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M5 3v18M19 3v18M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        )}
                        {interactionMode === "pan" ? "Pan" : "Select"}
                    </button>
                    <div
                        style={{
                            marginLeft: "auto",
                            padding: "4px 12px",
                            backgroundColor: "#2d2d2d",
                            borderRadius: "12px",
                            fontSize: "12px",
                            color: "#888"
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
                        backgroundColor: "#141417",
                        cursor: interactionMode === "select" ? "text" : (isDragging ? "grabbing" : "grab"),
                        touchAction: "none",
                        userSelect: interactionMode === "select" ? "text" : "none"
                    }}
                >
                    <svg
                        width={layoutResult.width}
                        height={layoutResult.height}
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: "center center"
                        }}
                    >
                        {layoutResult.edges.map((edge, i) => {
                            const color = EDGE_COLORS[edge.type];
                            const label = edge.type === "true" ? "T" : edge.type === "false" ? "F" : null;
                            let labelPos: { x: number; y: number } | null = null;
                            if (label && edge.points.length >= 2) {
                                labelPos = {
                                    x: (edge.points[0].x + edge.points[1].x) / 2,
                                    y: (edge.points[0].y + edge.points[1].y) / 2
                                };
                            }
                            return (
                                <g key={`edge-${i}`}>
                                    <path
                                        d={edgePath(edge.points)}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={1.5}
                                    />
                                    {arrowHead(edge.points, color)}
                                    {labelPos && (
                                        <>
                                            <rect
                                                x={labelPos.x - 8}
                                                y={labelPos.y - 8}
                                                width={16}
                                                height={16}
                                                rx={4}
                                                fill="#1e1e1e"
                                                stroke={color}
                                                strokeWidth={0.75}
                                            />
                                            <text
                                                x={labelPos.x}
                                                y={labelPos.y + 4}
                                                fill={color}
                                                fontSize={10}
                                                fontWeight={700}
                                                fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
                                                textAnchor="middle"
                                            >
                                                {label}
                                            </text>
                                        </>
                                    )}
                                </g>
                            );
                        })}

                        {layoutResult.nodes.map((node, i) => {
                            const block = cfgData.blocks[i];
                            if (!block) return null;

                            const CW = 7;   // matches parser CHAR_WIDTH
                            const GAP = 16;  // matches parser COL_GAP
                            const PX = 14;   // matches parser PADDING_X
                            const addrColW = 12 * CW;
                            const mnemonicX = PX + addrColW + GAP;
                            const argsX = mnemonicX + Math.max(6, block.maxMnemonicLen) * CW + GAP;
                            const commentX = argsX + Math.max(10, block.maxArgsLen) * CW + GAP;

                            return (
                                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                                    <rect
                                        width={node.width}
                                        height={node.height}
                                        rx={4}
                                        fill="#1e1e1e"
                                        stroke="#3d3d3d"
                                        strokeWidth={1}
                                    />
                                    <rect
                                        width={node.width}
                                        height={24}
                                        rx={4}
                                        fill="#2d2d2d"
                                    />
                                    <rect
                                        y={20}
                                        width={node.width}
                                        height={4}
                                        fill="#2d2d2d"
                                    />
                                    <text
                                        x={PX}
                                        y={17}
                                        fill="#f39c12"
                                        fontSize={12}
                                        fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
                                        fontWeight={600}
                                    >
                                        {block.label}
                                    </text>
                                    <line
                                        x1={0}
                                        y1={24}
                                        x2={node.width}
                                        y2={24}
                                        stroke="#3d3d3d"
                                        strokeWidth={0.5}
                                    />
                                    {block.instructions.map((instr, j) => {
                                        const yPos = 24 + 8 + (j + 1) * 16 - 3;
                                        if (instr.type === "flag") {
                                            return (
                                                <text
                                                    key={j}
                                                    x={PX + 16}
                                                    y={yPos}
                                                    fill="#e67e22"
                                                    fontSize={11}
                                                    fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
                                                    fontStyle="italic"
                                                >
                                                    {instr.content}
                                                </text>
                                            );
                                        }

                                        return (
                                            <g key={j}>
                                                <text
                                                    x={PX}
                                                    y={yPos}
                                                    fill="#f39c12"
                                                    fontSize={11}
                                                    fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
                                                >
                                                    {instr.addr}
                                                </text>
                                                <text
                                                    x={mnemonicX}
                                                    y={yPos}
                                                    fill="#3b82f6"
                                                    fontSize={11}
                                                    fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
                                                >
                                                    {instr.mnemonic}
                                                </text>
                                                <text
                                                    x={argsX}
                                                    y={yPos}
                                                    fill="#d4d4d4"
                                                    fontSize={11}
                                                    fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
                                                >
                                                    {instr.args}
                                                </text>
                                                {instr.comment && (
                                                    <text
                                                        x={commentX}
                                                        y={yPos}
                                                        fill="#6b7280"
                                                        fontSize={11}
                                                        fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
                                                    >
                                                        {instr.comment}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}
                                </g>
                            );
                        })}
                    </svg>
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
                        gap: "8px"
                    }}
                >
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <span style={{ color: "#94a3b8" }}>Scroll to pan · Ctrl+scroll to zoom</span>
                    </div>
                    <span style={{ color: "#94a3b8" }}>S to toggle select · Esc to close</span>
                </div>
            </div>
        </div>
    );
}
