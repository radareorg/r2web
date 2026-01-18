import { useState, useMemo, useCallback, useEffect } from "react";

type HexLine = {
    offset: string;
    offsetNum: number;
    bytes: string[];
    ascii: string;
};

type HexViewProps = {
    hexData: HexLine[];
    onClose: () => void;
};

const ROWS_PER_PAGE = 100;
const BYTES_PER_ROW = 16;

export function HexView({ hexData, onClose }: HexViewProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("");
    const [showToast, setShowToast] = useState(false);
    const [scrollToAddress, setScrollToAddress] = useState("");

    useEffect(() => {
        setPageInput(currentPage.toString());
    }, [currentPage]);

    const filteredHexData = useMemo(() => {
        if (!searchTerm) return hexData;

        const searchTermLower = searchTerm.toLowerCase();
        return hexData.filter((line) => {
            const bytesStr = line.bytes.join("").toLowerCase();
            const matchesBytes = bytesStr.includes(searchTermLower);
            const matchesAscii = line.ascii.toLowerCase().includes(searchTermLower);
            const matchesOffset = line.offset.toLowerCase().includes(searchTermLower);

            return matchesBytes || matchesAscii || matchesOffset;
        });
    }, [hexData, searchTerm]);

    const totalPages = Math.ceil(filteredHexData.length / ROWS_PER_PAGE);
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    const visibleHexData = filteredHexData.slice(startIndex, endIndex);

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

    const handleAddressJump = () => {
        const targetAddress = scrollToAddress.toLowerCase();
        const matchingIndex = hexData.findIndex(
            (line) => line.offset.toLowerCase() === targetAddress
        );

        if (matchingIndex !== -1) {
            const targetPage = Math.ceil((matchingIndex + 1) / ROWS_PER_PAGE);
            setCurrentPage(targetPage);
        }
    };

    const handleAddressJumpKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleAddressJump();
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
    }, [searchTerm]);

    const getAsciiColor = (char: string) => {
        const code = char.charCodeAt(0);
        if (code < 32 || code === 127) return "#666666";
        return "#e8e8e8";
    };

    const highlightByte = (byte: string) => {
        if (!searchTerm) return false;
        const term = searchTerm.toLowerCase();
        return byte.toLowerCase().includes(term);
    };

    const columnHeaders = Array.from({ length: BYTES_PER_ROW }, (_, i) =>
        i.toString(16).toUpperCase()
    );

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
                    maxWidth: "1600px",
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
                            HEXDUMP
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
                            {filteredHexData.length} rows
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
                        placeholder="Search hex or ASCII..."
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
                    <input
                        type="text"
                        placeholder="Jump to address (e.g., 0x1234)"
                        value={scrollToAddress}
                        onChange={(e) => setScrollToAddress(e.target.value)}
                        onKeyDown={handleAddressJumpKeyDown}
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#2d2d2d",
                            color: "#fff",
                            border: "1px solid #3d3d3d",
                            borderRadius: "6px",
                            fontSize: "14px",
                            width: "200px",
                        }}
                    />
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
                                <th
                                    style={{
                                        padding: "12px 8px",
                                        textAlign: "left",
                                        borderBottom: "2px solid #3d3d3d",
                                        color: "#888",
                                        fontWeight: "500",
                                        fontSize: "12px",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                    }}
                                >
                                    Offset
                                </th>
                                {columnHeaders.map((col) => (
                                    <th
                                        key={col}
                                        style={{
                                            padding: "12px 8px",
                                            textAlign: "center",
                                            borderBottom: "2px solid #3d3d3d",
                                            color: "#888",
                                            fontWeight: "500",
                                            fontSize: "12px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px",
                                            width: "20px",
                                        }}
                                    >
                                        {col}
                                    </th>
                                ))}
                                <th
                                    style={{
                                        padding: "12px 8px",
                                        textAlign: "left",
                                        borderBottom: "2px solid #3d3d3d",
                                        color: "#888",
                                        fontWeight: "500",
                                        fontSize: "12px",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                    }}
                                >
                                    ASCII
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHexData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={18}
                                        style={{
                                            padding: "40px",
                                            textAlign: "center",
                                            color: "#666",
                                        }}
                                    >
                                        No hex data found matching your search
                                    </td>
                                </tr>
                            ) : (
                                visibleHexData.map((line, idx) => (
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
                                        onDoubleClick={() => handleCopy(line.bytes.join(""))}
                                    >
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                fontFamily: "monospace",
                                                color: "#f39c12",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {line.offset}
                                        </td>
                                        {line.bytes.map((byte, bIdx) => (
                                            <td
                                                key={bIdx}
                                                style={{
                                                    padding: "4px 6px",
                                                    fontFamily: "monospace",
                                                    color: highlightByte(byte)
                                                        ? "#2ecc71"
                                                        : "#e8e8e8",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {byte.toUpperCase()}
                                            </td>
                                        ))}
                                        <td
                                            style={{
                                                padding: "10px 8px",
                                                fontFamily: "monospace",
                                                color: "#e8e8e8",
                                                letterSpacing: "1px",
                                            }}
                                        >
                                            {line.ascii.split("").map((char, cIdx) => (
                                                <span
                                                    key={cIdx}
                                                    style={{
                                                        color: getAsciiColor(char),
                                                    }}
                                                >
                                                    {char}
                                                </span>
                                            ))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredHexData.length > ROWS_PER_PAGE && (
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
                            <span>
                                Showing {startIndex + 1}-{Math.min(endIndex, filteredHexData.length)} of {filteredHexData.length} rows
                            </span>
                            <span>|</span>
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
                    }}
                >
                    <span>Double-click or long-press to copy bytes</span>
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
                    Bytes copied to clipboard
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

export type { HexLine };
