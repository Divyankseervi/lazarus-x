import React, { useState, useEffect } from 'react';
import { ShieldCheck, CircleAlert, ChevronRight, Hash, Layers, GitCommit, Copy, Check, Play, RotateCcw } from 'lucide-react';

export interface MerkleStep {
    depth: number;
    siblingHash: string;
    siblingSide: 'left' | 'right';
    resultingNodeHash: string;
    duplicateCurrentNode?: boolean;
}

export interface MerkleProofInspection {
    sequence: number;
    totalEvents: number;
    leafHash: string;
    pathSteps: MerkleStep[];
    countedRootHash: string;
    checkpointRootHash: string;
    checkpointDigest: string;
    checkpointVerified: boolean;
}

interface MerkleVisualizerProps {
    proof: MerkleProofInspection;
}

export const MerkleVisualizer: React.FC<MerkleVisualizerProps> = ({ proof }) => {
    const [copiedHash, setCopiedHash] = useState<string | null>(null);
    const [selectedDepth, setSelectedDepth] = useState<number | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

    const copyToClipboard = (text: string) => {
        void navigator.clipboard?.writeText(text);
        setCopiedHash(text);
        setTimeout(() => setCopiedHash(null), 1500);
    };

    const short = (hash: string) => `${hash.slice(0, 8)}...${hash.slice(-8)}`;

    const runAnimation = () => {
        setIsAnimating(true);
        setActiveStepIndex(0);
    };

    const resetAnimation = () => {
        setIsAnimating(false);
        setActiveStepIndex(null);
    };

    useEffect(() => {
        if (!isAnimating || activeStepIndex === null) return;
        const totalSteps = proof.pathSteps.length + 1; // steps + root
        if (activeStepIndex < totalSteps) {
            const timer = setTimeout(() => {
                setActiveStepIndex(prev => {
                    if (prev === null) return null;
                    const next = prev + 1;
                    if (next >= totalSteps) {
                        setIsAnimating(false);
                    }
                    return next;
                });
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [isAnimating, activeStepIndex, proof.pathSteps.length]);

    return (
        <div className="merkle-visualizer" role="region" aria-label="Interactive Merkle Path Visualizer">
            <div className="merkle-vis-header">
                <div className="merkle-vis-title">
                    <Layers size={16} className="text-cyan" />
                    <strong>Cryptographic Inclusion Tree Path</strong>
                    <span className="merkle-vis-badge">
                        Event #{proof.sequence} / {proof.totalEvents}
                    </span>
                </div>
                <div className="merkle-vis-header-right">
                    {!isAnimating ? (
                        <button
                            type="button"
                            className="anim-play-btn"
                            onClick={runAnimation}
                            title="Simulate step-by-step cryptographic hash progression"
                        >
                            <Play size={12} /> Play Verification
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="anim-play-btn active"
                            onClick={resetAnimation}
                            title="Reset playback"
                        >
                            <RotateCcw size={12} className="spin" /> Verifying Step {activeStepIndex}...
                        </button>
                    )}
                    <div className={`merkle-vis-status ${proof.checkpointVerified ? 'status-verified' : 'status-unverified'}`}>
                        {proof.checkpointVerified ? <ShieldCheck size={14} /> : <CircleAlert size={14} />}
                        <span>{proof.checkpointVerified ? 'ROOT MATCH VERIFIED' : 'ROOT MISMATCH'}</span>
                    </div>
                </div>
            </div>

            <div className="merkle-tree-flow">
                {/* 1. Leaf Node */}
                <div className={`merkle-node-level leaf-level ${activeStepIndex === 0 ? 'step-active' : ''}`}>
                    <div className="level-label">
                        <GitCommit size={13} />
                        <span>LEAF (Event #{proof.sequence})</span>
                    </div>
                    <div className="merkle-card leaf-card" onClick={() => copyToClipboard(proof.leafHash)}>
                        <div className="card-top">
                            <span className="node-type">LEAF:V1</span>
                            <button className="copy-btn" title="Copy leaf hash" aria-label="Copy leaf hash">
                                {copiedHash === proof.leafHash ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                            </button>
                        </div>
                        <code className="node-hash" title={proof.leafHash}>{short(proof.leafHash)}</code>
                    </div>
                </div>

                {/* 2. Sibling Path Steps */}
                {proof.pathSteps.map((step, idx) => {
                    const isSelected = selectedDepth === step.depth;
                    const isActiveAnim = activeStepIndex === idx + 1;
                    return (
                        <div key={step.depth} className={`merkle-node-level step-level ${isActiveAnim ? 'step-active' : ''}`}>
                            <div className="level-connector">
                                <ChevronRight size={14} className="connector-icon" />
                                <span className="depth-tag">Depth {step.depth}</span>
                            </div>

                            <div
                                className={`merkle-card step-card ${isSelected ? 'selected' : ''} ${isActiveAnim ? 'animating' : ''}`}
                                onClick={() => setSelectedDepth(isSelected ? null : step.depth)}
                            >
                                <div className="card-top">
                                    <span className={`side-badge ${step.siblingSide}`}>
                                        Sibling on {step.siblingSide.toUpperCase()}
                                    </span>
                                    {step.duplicateCurrentNode && (
                                        <span className="dup-badge">duplicate-last</span>
                                    )}
                                    <button
                                        className="copy-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyToClipboard(step.siblingHash);
                                        }}
                                        title="Copy sibling hash"
                                        aria-label="Copy sibling hash"
                                    >
                                        {copiedHash === step.siblingHash ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                                    </button>
                                </div>
                                <div className="hash-row">
                                    <span className="hash-label"><Hash size={11} /> Sibling:</span>
                                    <code className="node-hash" title={step.siblingHash}>{short(step.siblingHash)}</code>
                                </div>
                                <div className="hash-row resulting-row">
                                    <span className="hash-label">Combined:</span>
                                    <code className="node-hash resulting" title={step.resultingNodeHash}>{short(step.resultingNodeHash)}</code>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {proof.pathSteps.length === 0 && (
                    <div className="merkle-single-leaf-note">
                        <span>Single-event tree: Leaf equals tree root.</span>
                    </div>
                )}

                {/* 3. Root Node */}
                {(() => {
                    const isRootActive = activeStepIndex === proof.pathSteps.length + 1;
                    return (
                        <div className={`merkle-node-level root-level ${isRootActive ? 'step-active' : ''}`}>
                            <div className="level-connector">
                                <ChevronRight size={14} className="connector-icon" />
                                <span className="depth-tag">ROOT</span>
                            </div>
                            <div className={`merkle-card root-card ${proof.checkpointVerified ? 'root-matched' : 'root-mismatched'} ${isRootActive ? 'root-flashing' : ''}`}>
                                <div className="card-top">
                                    <span className="node-type">COUNTED ROOT (V1)</span>
                                    <button
                                        className="copy-btn"
                                        onClick={() => copyToClipboard(proof.countedRootHash)}
                                        title="Copy computed root hash"
                                        aria-label="Copy computed root hash"
                                    >
                                        {copiedHash === proof.countedRootHash ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                                    </button>
                                </div>
                                <div className="hash-row">
                                    <span className="hash-label">Counted:</span>
                                    <code className="node-hash root-hash" title={proof.countedRootHash}>{short(proof.countedRootHash)}</code>
                                </div>
                                <div className="hash-row">
                                    <span className="hash-label">Checkpoint:</span>
                                    <code className="node-hash checkpoint-hash" title={proof.checkpointRootHash}>{short(proof.checkpointRootHash)}</code>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div className="merkle-vis-footer">
                <div className="manifest-digest-box">
                    <span>Checkpoint Manifest Digest:</span>
                    <code>{proof.checkpointDigest}</code>
                </div>
            </div>
        </div>
    );
};
