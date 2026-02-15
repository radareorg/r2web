import { useEffect, useRef, useState, useCallback } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { foldGutter, foldKeymap } from "@codemirror/language";
import { javascript, javascriptLanguage, scopeCompletionSource } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { type Directory } from "@wasmer/sdk";
import { ConfirmDialog } from "./ConfirmDialog";

// Themes (should we really provide this much?)
import { oneDark } from "@codemirror/theme-one-dark";
import { materialLight } from "@ddietr/codemirror-themes/material-light";
import { materialDark } from "@ddietr/codemirror-themes/material-dark";
import { solarizedLight } from "@ddietr/codemirror-themes/solarized-light";
import { solarizedDark } from "@ddietr/codemirror-themes/solarized-dark";
import { dracula } from "@ddietr/codemirror-themes/dracula";
import { githubLight } from "@ddietr/codemirror-themes/github-light";
import { githubDark } from "@ddietr/codemirror-themes/github-dark";
import { aura } from "@ddietr/codemirror-themes/aura";
import { tokyoNight } from "@ddietr/codemirror-themes/tokyo-night";
import { tokyoNightStorm } from "@ddietr/codemirror-themes/tokyo-night-storm";
import { tokyoNightDay } from "@ddietr/codemirror-themes/tokyo-night-day";

type DirEntry = {
    name: string;
    type: "file" | "dir" | "unknown";
};

type ThemeOption = {
    name: string;
    extension: Extension;
    isDark: boolean;
};

const themes: ThemeOption[] = [
    { name: "GitHub Dark", extension: githubDark, isDark: true },
    { name: "GitHub Light", extension: githubLight, isDark: false },
    { name: "One Dark", extension: oneDark, isDark: true },
    { name: "Material Light", extension: materialLight, isDark: false },
    { name: "Material Dark", extension: materialDark, isDark: true },
    { name: "Solarized Light", extension: solarizedLight, isDark: false },
    { name: "Solarized Dark", extension: solarizedDark, isDark: true },
    { name: "Dracula", extension: dracula, isDark: true },
    { name: "Aura", extension: aura, isDark: true },
    { name: "Tokyo Night", extension: tokyoNight, isDark: true },
    { name: "Tokyo Night Storm", extension: tokyoNightStorm, isDark: true },
    { name: "Tokyo Night Day", extension: tokyoNightDay, isDark: false },
];

type CodeEditorViewProps = {
    isOpen: boolean;
    onClose: () => void;
    dir: Directory | null;
    onFileSelect?: (fileName: string) => void;
};

function getLanguageExtension(filename: string): Extension {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            if (filename.endsWith('.r2.js')) {
                return javascript({ jsx: false });
            }
            return javascript({ jsx: ext?.includes('x') });
        case 'json':
            return json();
        case 'r2':
        default:
            return javascript();
    }
}

export function CodeEditorView({ isOpen, onClose, dir, onFileSelect }: CodeEditorViewProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [files, setFiles] = useState<DirEntry[]>([]);
    const [currentFile, setCurrentFile] = useState<string>("");
    const [content, setContent] = useState<string>("");
    const [isDirty, setIsDirty] = useState(false);
    const [newFileName, setNewFileName] = useState("");
    const [showNewFileInput, setShowNewFileInput] = useState(false);
    const [showSaveAsInput, setShowSaveAsInput] = useState(false);
    const [saveAsFileName, setSaveAsFileName] = useState("");
    const [selectedTheme, setSelectedTheme] = useState<ThemeOption>(themes[0]);
    const [showThemeDropdown, setShowThemeDropdown] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<string>("");
    const [isMobile, setIsMobile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const getExtensions = useCallback((_doc: string, langExtension: Extension = javascript()): Extension[] => {
        const extensions: Extension[] = [
            selectedTheme.extension,
            lineNumbers(),
            foldGutter(),
            langExtension,
            history(),
            autocompletion({
                override: [
                    (context) => {
                        // Provide JavaScript autocompletion
                        if (javascriptLanguage.isActiveAt(context.state, context.pos)) {
                            return scopeCompletionSource(globalThis)(context);
                        }
                        return null;
                    }
                ]
            }),
            highlightSelectionMatches(),
            keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                ...searchKeymap,
                ...completionKeymap,
                ...foldKeymap,
                {
                    key: "Ctrl-s",
                    run: () => {
                        handleSave();
                        return true;
                    },
                },
                {
                    key: "Cmd-s",
                    run: () => {
                        handleSave();
                        return true;
                    },
                },

            ]),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    setContent(update.state.doc.toString());
                    setIsDirty(true);
                }
            }),
        ];
        return extensions;
    }, [selectedTheme]);

    const loadFiles = useCallback(async () => {
        if (!dir) return;
        try {
            const entries = await dir.readDir("/");
            const fileEntries = entries.filter((f: DirEntry) => f.type === "file");
            setFiles(fileEntries);

            // Check if current file still exists
            if (currentFile && !fileEntries.find((f: DirEntry) => f.name === currentFile)) {
                // File was deleted externally, clear the editor
                setCurrentFile("");
                setContent("");
                setIsDirty(false);
                if (viewRef.current) {
                    const newState = EditorState.create({
                        doc: "",
                        extensions: getExtensions(""),
                    });
                    viewRef.current.setState(newState);
                }
            }
        } catch (error) {
            console.error("Error reading directory:", error);
            setFiles([]);
        }
    }, [dir, currentFile, getExtensions]);

    useEffect(() => {
        if (isOpen && dir) {
            loadFiles();
        }
    }, [isOpen, dir, loadFiles]);

    useEffect(() => {
        if (!editorRef.current || !isOpen) return;

        const state = EditorState.create({
            doc: content,
            extensions: getExtensions(content),
        });

        const view = new EditorView({
            state,
            parent: editorRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [isOpen, selectedTheme]);

    useEffect(() => {
        if (viewRef.current && viewRef.current.state.doc.toString() !== content) {
            const transaction = viewRef.current.state.update({
                changes: {
                    from: 0,
                    to: viewRef.current.state.doc.length,
                    insert: content,
                },
            });
            viewRef.current.dispatch(transaction);
        }
    }, [content]);

    const loadFile = async (filename: string) => {
        if (!dir) return;
        try {
            const text = await dir.readTextFile(`/${filename}`);
            setContent(text);
            setCurrentFile(filename);
            setIsDirty(false);

            const langExtension = getLanguageExtension(filename);
            if (viewRef.current) {
                const newState = EditorState.create({
                    doc: text,
                    extensions: getExtensions(text, langExtension),
                });
                viewRef.current.setState(newState);
            }

            onFileSelect?.(filename);
        } catch (error) {
            console.error("Error loading file:", error);
        }
    };

    const handleSave = async () => {
        if (!dir) return;

        const contentToSave = viewRef.current?.state.doc.toString() || content;

        // If no content, nothing to save
        if (!contentToSave && !currentFile) return;

        const fileExists = currentFile && files.find((f: DirEntry) => f.name === currentFile);

        if (!currentFile || !fileExists) {
            setSaveAsFileName(currentFile || "");
            setShowSaveAsInput(true);
            return;
        }

        try {
            await dir.writeFile(`/${currentFile}`, contentToSave);
            setIsDirty(false);
        } catch (error) {
            console.error("Error saving file:", error);
        }
    };

    const handleSaveAs = async () => {
        if (!dir || !saveAsFileName.trim()) return;
        const filename = saveAsFileName.trim();
        try {
            const contentToSave = viewRef.current?.state.doc.toString() || content;
            await dir.writeFile(`/${filename}`, contentToSave);
            setSaveAsFileName("");
            setShowSaveAsInput(false);
            setCurrentFile(filename);
            setIsDirty(false);
            await loadFiles();
        } catch (error) {
            console.error("Error saving file:", error);
        }
    };

    const handleCreateNewFile = async () => {
        if (!dir || !newFileName.trim()) return;
        const filename = newFileName.trim();
        try {
            await dir.writeFile(`/${filename}`, "");
            setNewFileName("");
            setShowNewFileInput(false);
            await loadFiles();
            await loadFile(filename);
        } catch (error) {
            console.error("Error creating file:", error);
        }
    };

    const handleDeleteFile = (filename: string) => {
        if (!dir) return;
        setFileToDelete(filename);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteFile = async () => {
        if (!dir || !fileToDelete) return;
        try {
            await dir.removeFile(`/${fileToDelete}`);
            if (currentFile === fileToDelete) {
                setCurrentFile("");
                setContent("");
                if (viewRef.current) {
                    const newState = EditorState.create({
                        doc: "",
                        extensions: getExtensions(""),
                    });
                    viewRef.current.setState(newState);
                }
            }
            await loadFiles();
        } catch (error) {
            console.error("Error deleting file:", error);
        } finally {
            setShowDeleteConfirm(false);
            setFileToDelete("");
        }
    };

    const handleThemeChange = (theme: ThemeOption) => {
        setSelectedTheme(theme);
        setShowThemeDropdown(false);
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.7)",
                    zIndex: 1000,
                }}
                onClick={onClose}
            />
            <div
                style={{
                    position: "fixed",
                    top: isMobile ? 0 : "50%",
                    left: isMobile ? 0 : "50%",
                    transform: isMobile ? "none" : "translate(-50%, -50%)",
                    width: isMobile ? "100vw" : "90vw",
                    height: isMobile ? "100vh" : "85vh",
                    backgroundColor: selectedTheme.isDark ? "#1e1e1e" : "#ffffff",
                    borderRadius: isMobile ? 0 : "12px",
                    border: "1px solid #333",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                    zIndex: 1001,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderBottom: "1px solid #333",
                        backgroundColor: selectedTheme.isDark ? "#252525" : "#f0f0f0",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                        <h3 style={{
                            margin: 0,
                            fontSize: isMobile ? "14px" : "16px",
                            color: selectedTheme.isDark ? "#fff" : "#333",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {isMobile ? (currentFile || "Editor") : `Code Editor ${currentFile ? `- ${currentFile}` : ""}`}
                            {isDirty && <span style={{ color: "#f39c12" }}> *</span>}
                        </h3>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {isMobile && (
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                style={{
                                    padding: "8px 12px",
                                    background: sidebarOpen
                                        ? "linear-gradient(180deg, #3b82f6, #2563eb)"
                                        : (selectedTheme.isDark
                                            ? "linear-gradient(180deg, #3a3a3a, #2a2a2a)"
                                            : "linear-gradient(180deg, #e0e0e0, #d0d0d0)"),
                                    color: "#fff",
                                    border: "1px solid rgba(255, 255, 255, 0.06)",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    minWidth: "44px",
                                    minHeight: "44px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                Files
                            </button>
                        )}
                        <div style={{ position: "relative" }}>
                            <button
                                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                                style={{
                                    padding: isMobile ? "8px 12px" : "6px 12px",
                                    background: selectedTheme.isDark
                                        ? "linear-gradient(180deg, #3a3a3a, #2a2a2a)"
                                        : "linear-gradient(180deg, #e0e0e0, #d0d0d0)",
                                    color: selectedTheme.isDark ? "#fff" : "#333",
                                    border: "1px solid rgba(255, 255, 255, 0.06)",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    minHeight: isMobile ? "44px" : "auto",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                }}
                            >
                                {isMobile ? "Theme" : selectedTheme.name} ▼
                            </button>
                            {showThemeDropdown && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "100%",
                                        right: 0,
                                        marginTop: "4px",
                                        backgroundColor: selectedTheme.isDark ? "#2a2a2a" : "#ffffff",
                                        border: "1px solid #333",
                                        borderRadius: "6px",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                        zIndex: 1002,
                                        minWidth: "160px",
                                        maxHeight: "300px",
                                        overflowY: "auto",
                                    }}
                                >
                                    {themes.map((theme) => (
                                        <div
                                            key={theme.name}
                                            onClick={() => handleThemeChange(theme)}
                                            style={{
                                                padding: "8px 12px",
                                                cursor: "pointer",
                                                backgroundColor: selectedTheme.name === theme.name
                                                    ? (selectedTheme.isDark ? "#3b82f6" : "#2563eb")
                                                    : "transparent",
                                                color: selectedTheme.name === theme.name
                                                    ? "#fff"
                                                    : (selectedTheme.isDark ? "#ccc" : "#333"),
                                                fontSize: "13px",
                                            }}
                                            onMouseEnter={(e) => {
                                                if (selectedTheme.name !== theme.name) {
                                                    e.currentTarget.style.backgroundColor = selectedTheme.isDark ? "#333" : "#f0f0f0";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (selectedTheme.name !== theme.name) {
                                                    e.currentTarget.style.backgroundColor = "transparent";
                                                }
                                            }}
                                        >
                                            {theme.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowNewFileInput(true)}
                            style={{
                                padding: isMobile ? "8px 12px" : "6px 12px",
                                background: "linear-gradient(180deg, #27ae60, #219a52)",
                                color: "#fff",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                                minHeight: isMobile ? "44px" : "auto",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            {isMobile ? "New" : "New File"}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isDirty && !!currentFile}
                            style={{
                                padding: isMobile ? "8px 12px" : "6px 12px",
                                background: !isDirty && !!currentFile
                                    ? "linear-gradient(180deg, #2d2d2d, #262626)"
                                    : "linear-gradient(180deg, #3b82f6, #2563eb)",
                                color: "#fff",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                borderRadius: "6px",
                                cursor: !isDirty && !!currentFile ? "not-allowed" : "pointer",
                                fontSize: "13px",
                                opacity: !isDirty && !!currentFile ? 0.5 : 1,
                                minHeight: isMobile ? "44px" : "auto",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            Save
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                padding: isMobile ? "8px 12px" : "6px 12px",
                                background: selectedTheme.isDark
                                    ? "linear-gradient(180deg, #2f2f35, #242427)"
                                    : "linear-gradient(180deg, #e0e0e0, #d0d0d0)",
                                color: selectedTheme.isDark ? "#fff" : "#333",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                                minHeight: isMobile ? "44px" : "auto",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>

                {showNewFileInput && (
                    <div
                        style={{
                            padding: "12px 16px",
                            backgroundColor: selectedTheme.isDark ? "#2a2a2a" : "#f5f5f5",
                            borderBottom: "1px solid #333",
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                        }}
                    >
                        <span style={{ color: selectedTheme.isDark ? "#fff" : "#333", fontSize: "14px" }}>Filename:</span>
                        <input
                            type="text"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateNewFile();
                                if (e.key === "Escape") {
                                    setShowNewFileInput(false);
                                    setNewFileName("");
                                }
                            }}
                            placeholder="Enter filename (e.g., script.js)"
                            autoFocus
                            style={{
                                flex: 1,
                                padding: "8px 12px",
                                backgroundColor: selectedTheme.isDark ? "#1e1e1e" : "#fff",
                                color: selectedTheme.isDark ? "#fff" : "#333",
                                border: "1px solid #3d3d3d",
                                borderRadius: "6px",
                                fontSize: "14px",
                            }}
                        />
                        <button
                            onClick={handleCreateNewFile}
                            disabled={!newFileName.trim()}
                            style={{
                                padding: "8px 16px",
                                background: !newFileName.trim()
                                    ? "linear-gradient(180deg, #2d2d2d, #262626)"
                                    : "linear-gradient(180deg, #3b82f6, #2563eb)",
                                color: "#fff",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                borderRadius: "6px",
                                cursor: !newFileName.trim() ? "not-allowed" : "pointer",
                                fontSize: "13px",
                                opacity: !newFileName.trim() ? 0.5 : 1,
                            }}
                        >
                            Create
                        </button>
                        <button
                            onClick={() => {
                                setShowNewFileInput(false);
                                setNewFileName("");
                            }}
                            style={{
                                padding: "8px 16px",
                                background: selectedTheme.isDark
                                    ? "linear-gradient(180deg, #2f2f35, #242427)"
                                    : "linear-gradient(180deg, #e0e0e0, #d0d0d0)",
                                color: selectedTheme.isDark ? "#fff" : "#333",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {showSaveAsInput && (
                    <div
                        style={{
                            padding: "12px 16px",
                            backgroundColor: selectedTheme.isDark ? "#2a2a2a" : "#f5f5f5",
                            borderBottom: "1px solid #333",
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                        }}
                    >
                        <span style={{ color: selectedTheme.isDark ? "#fff" : "#333", fontSize: "14px" }}>Save as:</span>
                        <input
                            type="text"
                            value={saveAsFileName}
                            onChange={(e) => setSaveAsFileName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveAs();
                                if (e.key === "Escape") {
                                    setShowSaveAsInput(false);
                                    setSaveAsFileName("");
                                }
                            }}
                            placeholder="Enter filename (e.g., script.js)"
                            autoFocus
                            style={{
                                flex: 1,
                                padding: "8px 12px",
                                backgroundColor: selectedTheme.isDark ? "#1e1e1e" : "#fff",
                                color: selectedTheme.isDark ? "#fff" : "#333",
                                border: "1px solid #3d3d3d",
                                borderRadius: "6px",
                                fontSize: "14px",
                            }}
                        />
                        <button
                            onClick={handleSaveAs}
                            disabled={!saveAsFileName.trim()}
                            style={{
                                padding: "8px 16px",
                                background: !saveAsFileName.trim()
                                    ? "linear-gradient(180deg, #2d2d2d, #262626)"
                                    : "linear-gradient(180deg, #3b82f6, #2563eb)",
                                color: "#fff",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                borderRadius: "6px",
                                cursor: !saveAsFileName.trim() ? "not-allowed" : "pointer",
                                fontSize: "13px",
                                opacity: !saveAsFileName.trim() ? 0.5 : 1,
                            }}
                        >
                            Save
                        </button>
                        <button
                            onClick={() => {
                                setShowSaveAsInput(false);
                                setSaveAsFileName("");
                            }}
                            style={{
                                padding: "8px 16px",
                                background: selectedTheme.isDark
                                    ? "linear-gradient(180deg, #2f2f35, #242427)"
                                    : "linear-gradient(180deg, #e0e0e0, #d0d0d0)",
                                color: selectedTheme.isDark ? "#fff" : "#333",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                <div style={{
                    display: "flex",
                    flex: 1,
                    overflow: "hidden",
                    flexDirection: isMobile ? "column" : "row",
                }}>
                    {(!isMobile || sidebarOpen) && (
                    <div
                        style={{
                            width: isMobile ? "100%" : "200px",
                            height: isMobile ? "200px" : "auto",
                            backgroundColor: selectedTheme.isDark ? "#252525" : "#f5f5f5",
                            borderRight: isMobile ? "none" : "1px solid #333",
                            borderBottom: isMobile ? "1px solid #333" : "none",
                            overflowY: "auto",
                            padding: "8px 0",
                            flexShrink: 0,
                        }}
                    >
                        <div
                            style={{
                                padding: "8px 12px",
                                fontSize: "12px",
                                color: selectedTheme.isDark ? "#888" : "#666",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                            }}
                        >
                            Files
                        </div>
                        {files.length === 0 ? (
                            <div
                                style={{
                                    padding: "12px",
                                    color: selectedTheme.isDark ? "#666" : "#999",
                                    fontSize: "13px",
                                    textAlign: "center",
                                }}
                            >
                                No files yet
                            </div>
                        ) : (
                            files.map((file) => (
                                <div
                                    key={file.name}
                                    onClick={() => loadFile(file.name)}
                                    style={{
                                        padding: "8px 12px",
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        backgroundColor: currentFile === file.name
                                            ? "#3b82f6"
                                            : "transparent",
                                        color: currentFile === file.name
                                            ? "#fff"
                                            : (selectedTheme.isDark ? "#ccc" : "#333"),
                                        fontSize: "13px",
                                    }}
                                    onMouseEnter={(e) => {
                                        if (currentFile !== file.name) {
                                            e.currentTarget.style.backgroundColor = selectedTheme.isDark ? "#333" : "#e0e0e0";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (currentFile !== file.name) {
                                            e.currentTarget.style.backgroundColor = "transparent";
                                        }
                                    }}
                                >
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {file.name}
                                    </span>
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFile(file.name);
                                        }}
                                        style={{
                                            opacity: 0,
                                            cursor: "pointer",
                                            fontSize: "16px",
                                            padding: "0 4px",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.opacity = "1";
                                        }}
                                    >
                                        ×
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                    )}

                    <div
                        ref={editorRef}
                        style={{
                            flex: 1,
                            overflow: "auto",
                            backgroundColor: selectedTheme.isDark ? "#1e1e1e" : "#ffffff",
                            minHeight: isMobile && sidebarOpen ? "calc(100% - 200px)" : "auto",
                        }}
                    />
                </div>

                <div
                    style={{
                        padding: "8px 16px",
                        backgroundColor: selectedTheme.isDark ? "#252525" : "#f0f0f0",
                        borderTop: "1px solid #333",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: isMobile ? "11px" : "12px",
                        color: selectedTheme.isDark ? "#888" : "#666",
                        flexWrap: "wrap",
                        gap: "4px",
                    }}
                >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "50%" }}>
                        {currentFile ? `${currentFile}` : "No file selected"}
                    </span>
                    <span>
                        {isDirty ? "Modified" : "Saved"} | Lines: {content.split("\n").length} | Chars: {content.length}
                    </span>
                </div>
                <ConfirmDialog
                    isOpen={showDeleteConfirm}
                    title="Delete File"
                    message={`Are you sure you want to delete "${fileToDelete}"? This action cannot be undone.`}
                    onClose={() => {
                        setShowDeleteConfirm(false);
                        setFileToDelete("");
                    }}
                    onConfirm={confirmDeleteFile}
                    confirmText="Delete"
                    cancelText="Cancel"
                    isDark={selectedTheme.isDark}
                />
            </div>
        </>
    );
}
