import { useEffect, useRef, useState } from "react";

type InputViewProps = {
    isOpen: boolean;
    title: string;
    placeholder: string;
    onClose: () => void;
    onSubmit: (value: string) => void;
    defaultValue?: string;
};

export function InputView({
    isOpen,
    title,
    placeholder,
    onClose,
    onSubmit,
    defaultValue = "",
}: InputViewProps) {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isOpen]);

    useEffect(() => {
        setValue(defaultValue);
    }, [defaultValue]);

    const handleSubmit = () => {
        if (value.trim()) {
            onSubmit(value.trim());
            setValue("");
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSubmit();
        } else if (e.key === "Escape") {
            setValue("");
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                onClick={() => {
                    setValue("");
                    onClose();
                }}
                style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                    zIndex: 1000,
                }}
            />
            <div
                style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: "#1e1e1e",
                    padding: "24px",
                    borderRadius: "12px",
                    border: "1px solid #333",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                    zIndex: 1001,
                    color: "#fff",
                    minWidth: "400px",
                    maxWidth: "90vw",
                }}
            >
                <h2
                    style={{
                        margin: "0 0 16px 0",
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#fff",
                    }}
                >
                    {title}
                </h2>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "#2d2d2d",
                        color: "#fff",
                        border: "1px solid #3d3d3d",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily:
                            "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                    }}
                    autoFocus
                />
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "10px",
                        marginTop: "20px",
                    }}
                >
                    <button
                        onClick={() => {
                            setValue("");
                            onClose();
                        }}
                        style={{
                            padding: "10px 20px",
                            background: "linear-gradient(180deg, #2f2f35, #242427)",
                            color: "#fff",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "500",
                            transition: "transform 0.12s ease, box-shadow 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow =
                                "0 4px 12px rgba(0,0,0,0.3)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!value.trim()}
                        style={{
                            padding: "10px 20px",
                            background: !value.trim()
                                ? "linear-gradient(180deg, #2d2d2d, #262626)"
                                : "linear-gradient(180deg, #3b82f6, #2563eb)",
                            color: "#fff",
                            border: !value.trim()
                                ? "1px solid #333"
                                : "1px solid rgba(255, 255, 255, 0.06)",
                            borderRadius: "8px",
                            cursor: !value.trim() ? "not-allowed" : "pointer",
                            fontSize: "14px",
                            fontWeight: "500",
                            opacity: !value.trim() ? 0.5 : 1,
                            transition: "transform 0.12s ease, box-shadow 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                            if (value.trim()) {
                                e.currentTarget.style.transform =
                                    "translateY(-1px)";
                                e.currentTarget.style.boxShadow =
                                    "0 4px 12px rgba(0,0,0,0.3)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                        }}
                    >
                        Submit
                    </button>
                </div>
                <div
                    style={{
                        marginTop: "12px",
                        fontSize: "12px",
                        color: "#666",
                        textAlign: "center",
                    }}
                >
                    Press <span style={{ color: "#888", fontFamily: "monospace" }}>Enter</span> to submit, <span style={{ color: "#888", fontFamily: "monospace" }}>Esc</span> to cancel
                </div>
            </div>
        </>
    );
}
