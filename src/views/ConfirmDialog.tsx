import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDark?: boolean;
};

export function ConfirmDialog({
    isOpen,
    title,
    message,
    onClose,
    onConfirm,
    confirmText = "Delete",
    cancelText = "Cancel",
    isDark = true,
}: ConfirmDialogProps) {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen && confirmButtonRef.current) {
            confirmButtonRef.current.focus();
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            onConfirm();
        } else if (e.key === "Escape") {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                    zIndex: 2000,
                }}
            />
            <div
                onKeyDown={handleKeyDown}
                style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
                    padding: "24px",
                    borderRadius: "12px",
                    border: `1px solid ${isDark ? "#333" : "#ddd"}`,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                    zIndex: 2001,
                    color: isDark ? "#fff" : "#333",
                    minWidth: "350px",
                    maxWidth: "90vw",
                }}
            >
                <h2
                    style={{
                        margin: "0 0 12px 0",
                        fontSize: "18px",
                        fontWeight: "600",
                        color: isDark ? "#fff" : "#333",
                    }}
                >
                    {title}
                </h2>
                <p
                    style={{
                        margin: "0 0 24px 0",
                        fontSize: "14px",
                        color: isDark ? "#ccc" : "#666",
                        lineHeight: "1.5",
                    }}
                >
                    {message}
                </p>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "10px",
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: "10px 20px",
                            background: isDark
                                ? "linear-gradient(180deg, #2f2f35, #242427)"
                                : "linear-gradient(180deg, #e0e0e0, #d0d0d0)",
                            color: isDark ? "#fff" : "#333",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "500",
                            transition: "transform 0.12s ease, box-shadow 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        ref={confirmButtonRef}
                        onClick={onConfirm}
                        style={{
                            padding: "10px 20px",
                            background: "linear-gradient(180deg, #ef4444, #dc2626)",
                            color: "#fff",
                            border: "1px solid rgba(255, 0, 0, 0.15)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "500",
                            transition: "transform 0.12s ease, box-shadow 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(220, 38, 38, 0.3)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </>
    );
}
