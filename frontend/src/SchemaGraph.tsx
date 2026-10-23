import React, { useState } from 'react';
import { Database, Link as LinkIcon, CheckCircle, ArrowRight, Layers, Table } from 'lucide-react';
import type { CaseSchema } from './schemaTypes';

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
    schema?: CaseSchema | null;
    engineData?: Record<string, Array<Record<string, unknown>>>;
    onSelectTable?: (table: string) => void;
    selectedTable?: string;
}

export const SchemaGraph: React.FC<SchemaGraphProps> = ({ tables, schema, engineData, onSelectTable, selectedTable }) => {
    const [hoveredTable, setHoveredTable] = useState<string | null>(null);
    const definitionByName = new Map((schema?.tableDefinitions ?? []).map(definition => [definition.name, definition]));
    const tableNodes: SchemaTableNode[] = tables.map(name => {
        const rows = engineData?.[name] || [];
        const observed = new Set<string>();
        rows.forEach(row => Object.keys(row).forEach(key => { if (key !== '_recordId') observed.add(key); }));
        const declared = definitionByName.get(name)?.columns.map(column => column.name) ?? [];
        const fields = declared.length > 0 ? declared : Array.from(observed);
        return { name, rowCount: rows.length, fields, violations: { fatal: 0, resolvable: 0 } };
    });
    const edges: SchemaForeignKeyEdge[] = (schema?.constraints ?? []).filter(constraint => constraint.type === 'FOREIGN_KEY').map((constraint, index) => {
        const sourceField = constraint.fields?.[0] ?? constraint.field;
        const targetField = constraint.targetFields?.[0] ?? constraint.targetField ?? 'id';
        const sources = engineData?.[constraint.table] ?? [];
        const targets = engineData?.[constraint.targetTable ?? ''] ?? [];
        const references = sources
            .map(source => source[sourceField])
            .filter(value => value !== undefined && value !== null);
        const matchedReferences = references.filter(value =>
            targets.some(target => target[targetField] !== undefined && target[targetField] !== null && String(target[targetField]) === String(value))
        ).length;
        // Open-world evidence is incomplete: a link is shown as matched only when
        // every currently observed non-NULL source reference has visible support.
        // Unmatched references remain pending rather than being labelled corruption.
        const resolved = references.length > 0 && matchedReferences === references.length;
        return {
            id: constraint.id ?? `fk-${index}-${constraint.table}-${sourceField}`,
            fromTable: constraint.table,
            fromField: sourceField,
            toTable: constraint.targetTable ?? '',
            toField: targetField,
            status: resolved ? 'resolved' : 'pending',
        };
    });
    const activeFocus = hoveredTable || selectedTable || null;

    return (
        <div className="schema-graph-container" role="region" aria-label="Relational constraint schema graph">
            <div className="schema-graph-header">
                <div className="schema-graph-title"><Database size={15} className="text-cyan" /><strong>{schema?.name || 'Relational schema & constraints'}</strong><span className="live-pill"><i /> CASE SCHEMA</span></div>
                <div className="schema-graph-legend"><span className="legend-item"><span className="legend-dot status-resolved" /> Observed reference matches</span><span className="legend-item"><span className="legend-dot status-pending" /> Not yet resolved</span></div>
            </div>
            <div className="schema-graph-canvas">
                <div className="schema-cards-grid">
                    {tableNodes.map(node => {
                        const isSelected = selectedTable === node.name;
                        const isHovered = hoveredTable === node.name;
                        const isConnected = !activeFocus || node.name === activeFocus || edges.some(edge => (edge.fromTable === activeFocus && edge.toTable === node.name) || (edge.toTable === activeFocus && edge.fromTable === node.name));
                        return <div key={node.name} className={`schema-table-card ${isSelected ? 'table-selected' : ''} ${isHovered ? 'table-hovered' : ''} ${!isConnected ? 'table-dimmed' : ''}`} onClick={() => onSelectTable?.(node.name)} onMouseEnter={() => setHoveredTable(node.name)} onMouseLeave={() => setHoveredTable(null)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectTable?.(node.name); } }} aria-label={`Inspect relation ${node.name} (${node.rowCount} rows)`}>
                            <div className="table-card-head"><div className="table-card-title"><Table size={14} className="relation-icon" /><strong>{node.name}</strong></div><span className="row-count-badge">{node.rowCount} row{node.rowCount === 1 ? '' : 's'}</span></div>
                            <div className="table-card-fields">{node.fields.slice(0, 8).map(field => {
                                const declaredColumn = definitionByName.get(node.name)?.columns.find(column => column.name === field);
                                const isForeignKey = edges.some(edge => edge.fromTable === node.name && edge.fromField === field);
                                return <div key={field} className="field-chip"><span className="field-name">{field}</span>{declaredColumn && <span className="field-type-chip">{declaredColumn.type}</span>}{isForeignKey && <span title="Foreign key field" className="fk-indicator"><LinkIcon size={10} /></span>}</div>;
                            })}{node.fields.length > 8 && <span className="more-fields">+{node.fields.length - 8} more</span>}</div>
                            <div className="table-card-footer"><span className="status-indicator"><CheckCircle size={12} className="text-emerald" /><small>{node.fields.length} declared/observed field{node.fields.length === 1 ? '' : 's'}</small></span></div>
                        </div>;
                    })}
                </div>
                <div className="schema-edges-panel"><div className="edges-title"><Layers size={13} className="text-cyan" /><span>Declared foreign-key constraints</span></div>
                    <div className="edges-list">{edges.map(edge => {
                        const isHighlighted = activeFocus ? edge.fromTable === activeFocus || edge.toTable === activeFocus : false;
                        return <div key={edge.id} className={`edge-tag edge-${edge.status} ${isHighlighted ? 'edge-highlighted' : ''} ${activeFocus && !isHighlighted ? 'edge-dimmed' : ''}`}><span className="edge-from"><b>{edge.fromTable}</b>.{edge.fromField}</span><ArrowRight size={13} className="edge-arrow" /><span className="edge-to"><b>{edge.toTable}</b>.{edge.toField}</span><span className="edge-status-pill">{edge.status === 'resolved' ? 'observed match' : 'awaiting evidence'}</span></div>;
                    })}{edges.length === 0 && <p className="schema-empty-note">No foreign-key relationships are declared in this case schema.</p>}</div>
                </div>
            </div>
        </div>
    );
};
