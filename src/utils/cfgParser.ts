export interface ParsedOp {
    type: "flag" | "instr";
    content?: string;
    addr?: string;
    mnemonic?: string;
    args?: string;
    comment?: string;
    raw: string;
}

export interface CFGBlock {
    id: string;
    addr: number;
    label: string;
    instructions: ParsedOp[];
    width: number;
    height: number;
    maxMnemonicLen: number;
    maxArgsLen: number;
}

export interface CFGEdge {
    id: string;
    from: string;
    to: string;
    type: "true" | "false" | "unconditional";
}

export interface CFGData {
    functionName: string;
    functionAddr: number;
    blocks: CFGBlock[];
    edges: CFGEdge[];
}

const CHAR_WIDTH = 7;
const LINE_HEIGHT = 16;
const PADDING_X = 14;
const PADDING_Y = 8;
const HEADER_HEIGHT = 24;
const COL_GAP = 16;

function decodeComment(comment: string): string {
    if (!comment) return "";
    try {
        // r2 comments are base64 encoded
        return atob(comment);
    } catch {
        return comment;
    }
}

function measureBlock(ops: ParsedOp[], maxMnemonicLen: number, maxArgsLen: number): { width: number; height: number } {
    // Calculate width based on column layout: addr | mnemonic | args | comment
    const addrColW = 12 * CHAR_WIDTH;
    const mnemonicColW = Math.max(6, maxMnemonicLen) * CHAR_WIDTH;
    const argsColW = Math.max(10, maxArgsLen) * CHAR_WIDTH;

    // Find max comment length
    let maxCommentLen = 0;
    let maxFlagLen = 0;
    for (const op of ops) {
        if (op.type === "flag" && op.content) {
            if (op.content.length > maxFlagLen) maxFlagLen = op.content.length;
        } else if (op.comment && op.comment.length > maxCommentLen) {
            maxCommentLen = op.comment.length;
        }
    }
    const commentColW = maxCommentLen > 0 ? maxCommentLen * CHAR_WIDTH : 0;

    const instrWidth = addrColW + COL_GAP + mnemonicColW + COL_GAP + argsColW + (commentColW > 0 ? COL_GAP + commentColW : 0);
    const flagWidth = maxFlagLen * CHAR_WIDTH;
    const w = Math.max(instrWidth, flagWidth, 40 * CHAR_WIDTH) + PADDING_X * 2;
    const h = HEADER_HEIGHT + ops.length * LINE_HEIGHT + PADDING_Y * 2;
    return { width: Math.ceil(w), height: Math.ceil(h) };
}

export function parseAgfj(json: unknown): CFGData {
    const data = json as any;

    if (!data || !Array.isArray(data) || data.length === 0) {
        return {
            functionName: "unknown",
            functionAddr: 0,
            blocks: [],
            edges: []
        };
    }

    const func = data[0];
    const functionName = func.name || "unknown";
    const functionAddr = func.addr || 0;
    const blocks: CFGBlock[] = [];
    const edges: CFGEdge[] = [];

    if (!func.blocks || !Array.isArray(func.blocks)) {
        return {
            functionName,
            functionAddr,
            blocks: [],
            edges: []
        };
    }

    const sortedBlocks = [...func.blocks].sort((a: any, b: any) => (a.addr || 0) - (b.addr || 0));

    for (const block of sortedBlocks) {
        const addr = block.addr || 0;
        const id = `0x${addr.toString(16)}`;
        const label = `[0x${addr.toString(16).padStart(8, '0')}]`;

        const instructions: ParsedOp[] = [];
        let maxMnemonicLen = 0;
        let maxArgsLen = 0;

        if (block.ops && Array.isArray(block.ops)) {
            for (const op of block.ops) {
                // Parse flags
                if (op.flags && Array.isArray(op.flags)) {
                    for (const flag of op.flags) {
                        const content = `;-- ${flag}:`;
                        instructions.push({
                            type: "flag",
                            content,
                            raw: content
                        });
                    }
                }

                // Parse instruction
                const displayText = op.disasm || op.opcode || op.text || "";
                const opAddr = `0x${(op.addr || 0).toString(16).padStart(8, '0')}`;

                let mnemonic = "";
                let args = "";

                const firstSpace = displayText.indexOf(" ");
                if (firstSpace !== -1) {
                    mnemonic = displayText.substring(0, firstSpace);
                    args = displayText.substring(firstSpace + 1).trim();
                } else {
                    mnemonic = displayText;
                }

                let commentStr = "";
                if (op.comment) {
                    commentStr = `; ${decodeComment(op.comment)}`;
                }

                // Also extract comments from refs (e.g. ; 0x152a, ; 0x3fe0)
                if (op.refs && Array.isArray(op.refs)) {
                    for (const ref of op.refs) {
                        if (ref.addr !== undefined) {
                            const refHex = `0x${ref.addr.toString(16)}`;
                            if (commentStr) {
                                commentStr += `  ${refHex}`;
                            } else {
                                commentStr = `; ${refHex}`;
                            }
                        }
                    }
                }

                if (mnemonic.length > maxMnemonicLen) maxMnemonicLen = mnemonic.length;
                if (args.length > maxArgsLen) maxArgsLen = args.length;

                instructions.push({
                    type: "instr",
                    addr: opAddr,
                    mnemonic,
                    args,
                    comment: commentStr,
                    raw: displayText
                });
            }
        }

        const { width, height } = measureBlock(instructions, maxMnemonicLen, maxArgsLen);

        blocks.push({
            id,
            addr,
            label,
            instructions,
            width,
            height,
            maxMnemonicLen,
            maxArgsLen
        });
    }

    for (let i = 0; i < sortedBlocks.length; i++) {
        const block = sortedBlocks[i];
        const blockId = `0x${(block.addr || 0).toString(16)}`;

        if (block.jump !== undefined) {
            const jumpAddr = block.jump;
            const targetId = `0x${jumpAddr.toString(16)}`;

            if (block.fail !== undefined) {
                edges.push({
                    id: `${blockId}_true`,
                    from: blockId,
                    to: targetId,
                    type: "true"
                });

                const failAddr = block.fail;
                const failId = `0x${failAddr.toString(16)}`;
                edges.push({
                    id: `${blockId}_false`,
                    from: blockId,
                    to: failId,
                    type: "false"
                });
            } else {
                edges.push({
                    id: `${blockId}_jmp`,
                    from: blockId,
                    to: targetId,
                    type: "unconditional"
                });
            }
        } else if (block.fail !== undefined) {
            const failAddr = block.fail;
            const failId = `0x${failAddr.toString(16)}`;
            edges.push({
                id: `${blockId}_fail`,
                from: blockId,
                to: failId,
                type: "false"
            });
        } else if (i < sortedBlocks.length - 1) {
            const nextBlock = sortedBlocks[i + 1];
            if (nextBlock.addr !== undefined) {
                const nextId = `0x${nextBlock.addr.toString(16)}`;
                edges.push({
                    id: `${blockId}_fall`,
                    from: blockId,
                    to: nextId,
                    type: "unconditional"
                });
            }
        }
    }

    return {
        functionName,
        functionAddr,
        blocks,
        edges
    };
}
