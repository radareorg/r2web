import ELK from 'elkjs';

import type { CFGBlock, CFGEdge } from './cfgParser';

const elk = new ELK();

export interface LayoutNode {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayoutEdge {
    id: string;
    from: string;
    to: string;
    type: "true" | "false" | "unconditional";
    points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
    width: number;
    height: number;
}

export async function layoutCFG(
    blocks: CFGBlock[],
    edges: CFGEdge[]
): Promise<LayoutResult> {
    const children = blocks.map(block => {
        const blockEdges = edges.filter(e => e.from === block.id);
        const hasConditional = blockEdges.some(e => e.type === 'true' || e.type === 'false');

        if (hasConditional) {
            return {
                id: block.id,
                width: block.width,
                height: block.height,
                ports: [
                    {
                        id: `${block.id}_out_true`,
                        width: 1,
                        height: 1,
                        layoutOptions: {
                            'elk.port.side': 'SOUTH'
                        }
                    },
                    {
                        id: `${block.id}_out_false`,
                        width: 1,
                        height: 1,
                        layoutOptions: {
                            'elk.port.side': 'SOUTH'
                        }
                    }
                ]
            };
        }

        return {
            id: block.id,
            width: block.width,
            height: block.height
        };
    });

    const elkEdges = edges.map((edge, i) => {
        const sourceId = edge.type === 'true'
            ? `${edge.from}_out_true`
            : edge.type === 'false'
                ? `${edge.from}_out_false`
                : edge.from;

        return {
            id: edge.id || `edge_${i}`,
            sources: [sourceId],
            targets: [edge.to]
        };
    });

    const graph = {
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'DOWN',
            'elk.spacing.nodeNode': '40',
            'elk.layered.spacing.nodeNodeBetweenLayers': '60',
            'elk.layered.spacing.edgeNodeBetweenLayers': '30',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.portConstraints': 'FIXED_ORDER',
            'elk.layered.unnecessaryBendpoints': 'true',
            'elk.spacing.portPort': '20',
            'elk.layered.mergeEdges': 'true',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        },
        children,
        edges: elkEdges
    };

    const result = await elk.layout(graph);

    const nodes: LayoutNode[] = ((result as any).children || []).map((n: any) => ({
        id: n.id,
        x: n.x || 0,
        y: n.y || 0,
        width: n.width || 100,
        height: n.height || 100
    }));

    const layoutEdges: LayoutEdge[] = ((result as any).edges || []).map((e: any) => {
        const oedge = edges.find(orig => orig.id === e.id);
        const points: Array<{ x: number; y: number }> = [];

        if (e.sections && e.sections[0]) {
            const section = e.sections[0];
            points.push(section.startPoint);

            if (section.bendPoints) {
                points.push(...section.bendPoints);
            }

            points.push(section.endPoint);
        }

        return {
            id: oedge?.id || e.id,
            from: oedge?.from || '',
            to: oedge?.to || '',
            type: oedge?.type || 'unconditional',
            points
        };
    });

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    }

    const width = maxX === -Infinity ? 800 : maxX - minX + 100;
    const height = maxY === -Infinity ? 600 : maxY - minY + 100;

    return {
        nodes,
        edges: layoutEdges,
        width,
        height
    };
}
