import React, { useState } from 'react';
import { Database, Link as LinkIcon, CheckCircle, ArrowRight, Layers, Table } from 'lucide-react';

export interface SchemaTableNode {
    name: string;
    rowCount: number;
    fields: string[];
    violations: { fatal: number; resolvable: number };
}

export interface SchemaForeignKeyEdge {
    id: string;
    fromTable: string;
    fromField: string;
    toTable: string;
    toField: string;
    status: 'resolved' | 'pending' | 'violated';
}

interface SchemaGraphProps {
    tables: string[];
    engineData?: Record<string, Array<Record<string, unknown>>>;
    onSelectTable?: (table: string) => void;
    selectedTable?: string;
}

export const SchemaGraph: React.FC<SchemaGraphProps> = ({
    tables,
    engineData,
    onSelectTable,
    selectedTable,
}) => {
    const [hoveredTable, setHoveredTable] = useState<string | null>(null);

    // Build table nodes from known schema & current data
    const tableNodes: SchemaTableNode[] = tables.map(name => {
        const rows = engineData?.[name] || [];
        const fieldSet = new Set<string>();
        rows.forEach(r => Object.keys(r).forEach(k => { if (k !== '_recordId') fieldSet.add(k); }));
        if (fieldSet.size === 0) {
            if (name === 'Department') ['id', 'name'].forEach(f => fieldSet.add(f));
            if (name === 'Employee') ['id', 'name', 'departmentId'].forEach(f => fieldSet.add(f));
            if (name === 'Order') ['id', 'amount', 'employeeId'].forEach(f => fieldSet.add(f));
        }

        return {
            name,
            rowCount: rows.length,
            fields: Array.from(fieldSet),
            violations: { fatal: 0, resolvable: 0 },
        };
    });

    // Known FK edges in target domain
    const edges: SchemaForeignKeyEdge[] = [
        {
            id: 'emp-to-dept',
            fromTable: 'Employee',
            fromField: 'departmentId',
            toTable: 'Department',
            toField: 'id',
            status: 'resolved',
        },
        {
            id: 'order-to-emp',
            fromTable: 'Order',
            fromField: 'employeeId',
            toTable: 'Employee',
            toField: 'id',
            status: 'resolved',
        },
    ];

    const activeFocus = hoveredTable || selectedTable || null;

    return (
        <div className="schema-graph-container" role="region" aria-label="Relational Constraint Schema Graph">
            <div className="schema-graph-header">
                <div className="schema-graph-title">
                    <Database size={15} className="text-cyan" />
                    <strong>Relational Constraint & Entity Lineage Graph</strong>
                    <span className="live-pill"><i /> LIVE GRAPH</span>
                </div>
                <div className="schema-graph-legend">
                    <span className="legend-item"><span className="legend-dot status-resolved" /> Satisfied FK</span>
                    <span className="legend-item"><span className="legend-dot status-pending" /> Open-World</span>
                    <span className="legend-item"><span className="legend-dot status-violated" /> Conflict</span>
                </div>
            </div>

            <div className="schema-graph-canvas">
                <div className="schema-cards-grid">
                    {tableNodes.map(node => {
                        const isSelected = selectedTable === node.name;
                        const isHovered = hoveredTable === node.name;
                        const isConnected = !activeFocus || node.name === activeFocus || edges.some(e =>
                            (e.fromTable === activeFocus && e.toTable === node.name) ||
                            (e.toTable === activeFocus && e.fromTable === node.name)
                        );

                        return (
                            <div
                                key={node.name}
                                className={`schema-table-card ${isSelected ? 'table-selected' : ''} ${isHovered ? 'table-hovered' : ''} ${!isConnected ? 'table-dimmed' : ''}`}
                                onClick={() => onSelectTable?.(node.name)}
                                onMouseEnter={() => setHoveredTable(node.name)}
                                onMouseLeave={() => setHoveredTable(null)}
                                role="button"
                                tabIndex={0}
                                aria-label={`Inspect relation ${node.name} (${node.rowCount} rows)`}
                            >
                                <div className="table-card-head">
                                    <div className="table-card-title">
                                        <Table size={14} className="relation-icon" />
                                        <strong>{node.name}</strong>
                                    </div>
                                    <span className="row-count-badge">
                                        {node.rowCount} row{node.rowCount === 1 ? '' : 's'}
                                    </span>
                                </div>

                                <div className="table-card-fields">
                                    {node.fields.slice(0, 5).map(f => (
                                        <div key={f} className="field-chip">
                                            <span className="field-name">{f}</span>
                                            {f.endsWith('Id') && (
                                                <span title="Foreign Key Field" className="fk-indicator">
                                                    <LinkIcon size={10} />
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                    {node.fields.length > 5 && (
                                        <span className="more-fields">+{node.fields.length - 5} more</span>
                                    )}
                                </div>

                                <div className="table-card-footer">
                                    <span className="status-indicator">
                                        <CheckCircle size={12} className="text-emerald" />
                                        <small>Constraint health active</small>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Animated Lineage Flow Visualizer */}
                <div className="schema-edges-panel">
                    <div className="edges-title">
                        <Layers size={13} className="text-cyan" />
                        <span>Active Lineage & Foreign Key Constraints:</span>
                    </div>
                    <div className="edges-list">
                        {edges.map(edge => {
                            const isEdgeHighlighted = activeFocus ? (edge.fromTable === activeFocus || edge.toTable === activeFocus) : false;
                            const isEdgeDimmed = activeFocus ? (!isEdgeHighlighted) : false;

                            return (
                                <div
                                    key={edge.id}
                                    className={`edge-tag edge-${edge.status} ${isEdgeHighlighted ? 'edge-highlighted' : ''} ${isEdgeDimmed ? 'edge-dimmed' : ''}`}
                                >
                                    <span className="edge-from"><b>{edge.fromTable}</b>.{edge.fromField}</span>
                                    <ArrowRight size={13} className="edge-arrow" />
                                    <span className="edge-to"><b>{edge.toTable}</b>.{edge.toField}</span>
                                    <span className="edge-status-pill">{edge.status}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
