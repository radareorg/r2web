import { useState, useMemo, useCallback, useEffect, useRef } from "react";

type StringInfo = {
    vaddr: number;
    paddr: number;
    ordinal: number;
    size: number;
    length: number;
    section: string;
    type: string;
    string: string;
    blocks?: string[];
};

type StringsViewProps = {
    strings: StringInfo[];
    onClose: () => void;
    onSeekAddress?: (address: string) => void;
};

const ITEMS_PER_PAGE = 100;

export function StringsView({ strings, onClose, onSeekAddress }: StringsViewProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [filterSection, setFilterSection] = useState<string>("all");
    const [filterType, setFilterType] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("");
    const [showToast, setShowToast] = useState(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setPageInput(currentPage.toString());
    }, [currentPage]);

    const sections = useMemo(() => {
        const sections = new Set(strings.map((s) => s.section));
        return Array.from(sections).sort();
    }, [strings]);

    const types = useMemo(() => {
        const types = new Set(strings.map((s) => s.type));
        return Array.from(types).sort();
    }, [strings]);

    const filteredStrings = useMemo(() => {
        return strings.filter((s) => {
            const matchesSearch =
                debouncedSearchTerm === "" ||
                s.string.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                s.vaddr.toString(16).includes(debouncedSearchTerm.toLowerCase()) ||
                s.paddr.toString(16).includes(debouncedSearchTerm.toLowerCase());

            const matchesSection =
                filterSection === "all" || s.section === filterSection;

            const matchesType = filterType === "all" || s.type === filterType;

            return matchesSearch && matchesSection && matchesType;
        });
    }, [strings, debouncedSearchTerm, filterSection, filterType]);

    const totalPages = Math.ceil(filteredStrings.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const visibleStrings = filteredStrings.slice(startIndex, endIndex);

    const formatAddress = (addr: number) => {
        return "0x" + addr.toString(16).padStart(8, "0");
    };

    const columnWidths = useMemo(() => {
        if (visibleStrings.length === 0) {
            return { ordinal: "40px", vaddr: "80px", paddr: "80px", length: "50px", size: "50px", section: "70px", type: "50px" };
        }

        const getOrdinalWidth = () => {
            const maxOrdinal = Math.max(...visibleStrings.map((s) => s.ordinal));
            const chars = maxOrdinal.toString().length;
            return Math.max(40, chars * 10 + 10) + "px";
        };

        const getAddressWidth = () => {
            const maxLength = Math.max(
                ...visibleStrings.map((s) => formatAddress(s.vaddr).length)
            );
            return Math.max(60, maxLength * 8) + "px";
        };

        const getNumericWidth = (key: keyof StringInfo) => {
            const maxValue = Math.max(...visibleStrings.map((s) => s[key] as number));
            const chars = maxValue.toString().length;
            return Math.max(30, chars * 10 + 10) + "px";
        };

        const getTextWidth = (key: keyof StringInfo) => {
            const maxLength = Math.max(...visibleStrings.map((s) => (s[key] as string).length));
            return Math.max(40, maxLength * 9) + "px";
        };

        return {
            ordinal: getOrdinalWidth(),
            vaddr: getAddressWidth(),
            paddr: getAddressWidth(),
            length: getNumericWidth("length"),
            size: getNumericWidth("size"),
            section: getTextWidth("section"),
            type: getTextWidth("type"),
        };
    }, [visibleStrings]);

    const getTypeColor = (type: string) => {
        switch (type.toLowerCase()) {
            case "utf8":
                return "#5dade2";
            case "ascii":
                return "#58d68d";
            case "utf16":
                return "#af7ac5";
            case "utf32":
                return "#f5b041";
            default:
                return "#ffffff";
        }
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handlePageJump = () => {
        const pageNum = parseInt(pageInput, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            setCurrentPage(pageNum);
        } else {
            setPageInput(currentPage.toString());
        }
    };

    const handlePageInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handlePageJump();
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    };

    const handleTouchStart = (onAction: () => void) => {
        longPressTimerRef.current = setTimeout(() => {
            onAction();
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleTouchMove = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterSection, filterType]);

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
                    maxWidth: "1400px",
                    maxHeight: "90vh",
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
                            STRINGS
                        </h2>
                        <span
                            style={{
                                backgroundColor: "#2d2d2d",
                                padding: "4px 12px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                color: "#888",
                            }}
                        >
                            {filteredStrings.length} / {strings.length}
                        </span>
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
                        padding: "16px 20px",
                        borderBottom: "1px solid #333",
                        display: "flex",
                        gap: "12px",
                        flexWrap: "wrap",
                        alignItems: "center",
                    }}
                >
                    <input
                        type="text"
                        placeholder="Search strings..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#2d2d2d",
                            color: "#fff",
                            border: "1px solid #3d3d3d",
                            borderRadius: "6px",
                            fontSize: "14px",
                            flex: "1",
                            minWidth: "200px",
                        }}
                    />
                    <select
                        value={filterSection}
                        onChange={(e) => setFilterSection(e.target.value)}
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#2d2d2d",
                            color: "#fff",
                            border: "1px solid #3d3d3d",
                            borderRadius: "6px",
                            fontSize: "14px",
                            cursor: "pointer",
                        }}
                    >
                        <option value="all">All Sections</option>
                        {sections.map((section) => (
                            <option key={section} value={section}>
                                {section}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#2d2d2d",
                            color: "#fff",
                            border: "1px solid #3d3d3d",
                            borderRadius: "6px",
                            fontSize: "14px",
                            cursor: "pointer",
                        }}
                    >
                        <option value="all">All Types</option>
                        {types.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>

                <div
                    style={{
                        flex: 1,
                        overflow: "auto",
                        padding: "0",
                        position: "relative",
                    }}
                >
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "13px",
                            tableLayout: "auto",
                        }}
                    >
                        <thead
                            style={{
                                position: "sticky",
                                top: 0,
                                backgroundColor: "#2d2d2d",
                                zIndex: 1,
                            }}
                        >
                            <tr>
                                {[
                                    { key: "#", width: columnWidths.ordinal },
                                    { key: "Vaddr", width: columnWidths.vaddr },
                                    { key: "Paddr", width: columnWidths.paddr },
                                    { key: "Len", width: columnWidths.length },
                                    { key: "Size", width: columnWidths.size },
                                    { key: "Section", width: columnWidths.section },
                                    { key: "Type", width: columnWidths.type },
                                    { key: "String", width: "auto" },
                                ].map((header) => (
                                    <th
                                        key={header.key}
                                        style={{
                                            padding: "12px 8px",
                                            textAlign: "left",
                                            borderBottom: "2px solid #3d3d3d",
                                            color: "#888",
                                            fontWeight: "500",
                                            fontSize: "12px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {header.key}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStrings.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        style={{
                                            padding: "40px",
                                            textAlign: "center",
                                            color: "#666",
                                        }}
                                    >
                                        No strings found matching your criteria
                                    </td>
                                </tr>
                            ) : (
                                visibleStrings.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        style={{
                                            borderBottom: "1px solid #2d2d2d",
                                            transition: "background 0.15s",
                                            cursor: "pointer",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                                "#2a2a2a";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                                "transparent";
                                        }}
                                        onDoubleClick={() => handleCopy(item.string)}
                                        onTouchStart={() => handleTouchStart(() => handleCopy(item.string))}
                                        onTouchEnd={handleTouchEnd}
                                        onTouchMove={handleTouchMove}
                                    >
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                color: "#666",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {item.ordinal}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                fontFamily: "monospace",
                                                color: "#f39c12",
                                                whiteSpace: "nowrap",
                                                cursor: onSeekAddress ? "pointer" : "default",
                                            }}
                                            onClick={() => {
                                                if (onSeekAddress) {
                                                    onSeekAddress(formatAddress(item.vaddr));
                                                }
                                            }}
                                        >
                                            {formatAddress(item.vaddr)}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                fontFamily: "monospace",
                                                color: "#e67e22",
                                                whiteSpace: "nowrap",
                                                cursor: onSeekAddress ? "pointer" : "default",
                                            }}
                                            onClick={() => {
                                                if (onSeekAddress) {
                                                    onSeekAddress(formatAddress(item.paddr));
                                                }
                                            }}
                                        >
                                            {formatAddress(item.paddr)}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                color: "#999",
                                                textAlign: "right",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {item.length}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                color: "#999",
                                                textAlign: "right",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {item.size}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                color: "#3498db",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {item.section}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                color: getTypeColor(item.type),
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {item.type}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                color: "#e8e8e8",
                                                wordBreak: "break-all",
                                            }}
                                        >
                                            {item.string}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredStrings.length > ITEMS_PER_PAGE && (
                    <div
                        style={{
                            padding: "12px 20px",
                            borderTop: "1px solid #333",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "12px",
                            color: "#666",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                            }}
                        >
                            {/* This breaks the alignment on Mobile */}
                            {/*<span>
                                Showing {startIndex + 1}-{Math.min(endIndex, filteredStrings.length)} of {filteredStrings.length}
                            </span>
                            <span>|</span>*/}
                            <span>Page {currentPage} of {totalPages}</span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                            }}
                        >
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: currentPage === 1 ? "#2d2d2d" : "#3d3d3d",
                                    color: "#fff",
                                    border: "1px solid #3d3d3d",
                                    borderRadius: "6px",
                                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                    opacity: currentPage === 1 ? 0.5 : 1,
                                }}
                            >
                                Previous
                            </button>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                }}
                            >
                                <input
                                    type="text"
                                    value={pageInput}
                                    onChange={(e) => setPageInput(e.target.value)}
                                    onKeyDown={handlePageInputKeyDown}
                                    onBlur={handlePageJump}
                                    style={{
                                        width: "60px",
                                        padding: "6px 8px",
                                        backgroundColor: "#2d2d2d",
                                        color: "#fff",
                                        border: "1px solid #3d3d3d",
                                        borderRadius: "6px",
                                        fontSize: "13px",
                                        textAlign: "center",
                                    }}
                                />
                                <span>/ {totalPages}</span>
                            </div>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: currentPage === totalPages ? "#2d2d2d" : "#3d3d3d",
                                    color: "#fff",
                                    border: "1px solid #3d3d3d",
                                    borderRadius: "6px",
                                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                    opacity: currentPage === totalPages ? 0.5 : 1,
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

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
                        <span>Double-click or long-press to copy string</span>
                        {onSeekAddress && <span>• Click address to seek</span>}
                    </div>
                    <span>Press Esc to close</span>
                </div>
            </div>

            {showToast && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "20px",
                        right: "20px",
                        backgroundColor: "#2ecc71",
                        color: "#fff",
                        padding: "12px 20px",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                        zIndex: 1001,
                        animation: "slideIn 0.3s ease-out",
                        fontSize: "14px",
                        fontWeight: "500",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
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
                            d="M20 6L9 17L4 12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    String copied to clipboard
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}

export type { StringInfo };
