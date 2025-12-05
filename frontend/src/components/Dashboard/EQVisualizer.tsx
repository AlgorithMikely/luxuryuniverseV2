import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Maximize2, Minimize2, RefreshCcw, Search, Plus, Headphones } from 'lucide-react';

interface EQNode {
    id: number;
    type: 'lowshelf' | 'peaking' | 'highshelf' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';

    freq: number; // Hz (20 - 20000)
    gain: number; // dB (-24 to +24)
    q: number;    // Q-factor (0.1 to 10)
}

interface EQVisualizerProps {
    className?: string;
    onClose?: () => void;
    onBandsChange?: (bands: EQNode[]) => void;
    analyser?: AnalyserNode | null;
    onExport?: (summary: string) => void;
}


const DB_SCALE = 24;
const DB_RANGE = 48; // +/- 24dB

const EQInput = ({
    value,
    onChange,
    min,
    max,
    className,
    formatter = String
}: {
    value: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
    className: string,
    formatter?: (v: number) => string
}) => {
    const [localVal, setLocalVal] = useState<string>('');
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (!active) setLocalVal(formatter(value));
    }, [value, active, formatter]);

    const commit = () => {
        let num = parseFloat(localVal);
        if (isNaN(num)) num = value;
        num = Math.max(min, Math.min(max, num));
        onChange(num);
        setLocalVal(formatter(num));
        setActive(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            commit();
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <input
            className={className}
            value={active ? localVal : formatter(value)}
            onFocus={() => { setActive(true); setLocalVal(formatter(value)); }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            onChange={(e) => setLocalVal(e.target.value)}
        />
    );
};

const EQVisualizer: React.FC<EQVisualizerProps> = ({ className, onClose, onBandsChange, analyser, onExport }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Default Nodes State
    const [nodes, setNodes] = useState<EQNode[]>([
        { id: 1, type: 'lowshelf', freq: 60, gain: 0, q: 0.7 },
        { id: 2, type: 'peaking', freq: 250, gain: 0, q: 1.0 },
        { id: 3, type: 'peaking', freq: 1000, gain: 0, q: 1.0 },
        { id: 4, type: 'peaking', freq: 4000, gain: 0, q: 1.0 },
        { id: 5, type: 'highshelf', freq: 12000, gain: 0, q: 0.7 },
    ]);

    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSweeping, setIsSweeping] = useState(false);
    const [isSoloing, setIsSoloing] = useState(false);
    const dataArrayRef = useRef<Uint8Array | null>(null);

    const getEffectiveNodes = useCallback(() => {
        if ((!isSweeping && !isSoloing) || selectedNodeId === null) return nodes;

        return nodes.map(n => {
            if (n.id === selectedNodeId) {
                // Priority Limit: Solo overrides Sweep if both active (user intent to isolate)
                if (isSoloing) {
                    return { ...n, type: 'bandpass' as const, q: 5, gain: 0 };
                }
                if (isSweeping) {
                    // Classic Boost Sweep
                    return { ...n, q: 15, gain: 18 };
                }
            }

            // If Soloing, mute other bands
            if (isSoloing) {
                return { ...n, gain: 0 };
            }
            // If Sweeping (Boost), leave other bands as-is
            return n;
        });
    }, [nodes, isSweeping, isSoloing, selectedNodeId]);

    // Notify parent of changes whenever effective nodes change
    useEffect(() => {
        if (onBandsChange) {
            onBandsChange(getEffectiveNodes());
        }
    }, [getEffectiveNodes, onBandsChange]);


    // --- Canvas Drawing Logic ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const effectiveNodes = getEffectiveNodes();

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Grid (Logarithmic Frequency)
        ctx.strokeStyle = '#334155'; // Slate-700
        ctx.lineWidth = 1;
        ctx.beginPath();

        // Simple Grid Lines approximation
        const freqLines = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
        freqLines.forEach(f => {
            const x = (Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        });

        // dB Lines (Scaled to +/- 24dB)
        const dbLines = [-18, -12, -6, 0, 6, 12, 18];
        dbLines.forEach(db => {
            const y = height / 2 - (db / DB_SCALE) * height;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        });
        ctx.stroke();

        // 2. Draw Zero-Gain center line
        ctx.strokeStyle = '#94a3b8'; // Slate-400
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. Draw Spectrum (Real or Simulated)
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#8b5cf6');   // Violet (Sub)
        gradient.addColorStop(0.2, '#3b82f6'); // Blue (Bass)
        gradient.addColorStop(0.4, '#06b6d4'); // Cyan (Low Mids)
        gradient.addColorStop(0.6, '#10b981'); // Emerald (Mids)
        gradient.addColorStop(0.8, '#f59e0b'); // Amber (High Mids)
        gradient.addColorStop(1, '#ef4444');    // Red (Highs)

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.4;

        ctx.beginPath();
        ctx.moveTo(0, height);

        if (analyser) {
            if (!dataArrayRef.current || dataArrayRef.current.length !== analyser.frequencyBinCount) {
                dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
            }
            // @ts-ignore - Buffer type mismatch in some environments
            analyser.getByteFrequencyData(dataArrayRef.current);

            const hasData = dataArrayRef.current.some(v => v > 0);
            if (!hasData) {
                ctx.save();
                ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
                ctx.fillRect(0, 0, width, height);
                ctx.fillStyle = '#ff5555';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText("WAITING FOR AUDIO...", width / 2, height / 2);
                ctx.restore();
                ctx.fillStyle = gradient;
            }

            const bufferLength = dataArrayRef.current.length;
            const sampleRate = analyser.context.sampleRate;

            for (let x = 0; x <= width; x += 4) {
                const logF = (x / width) * (Math.log10(20000) - Math.log10(20)) + Math.log10(20);
                const f = Math.pow(10, logF);
                const binIndex = Math.floor(f * (2 * bufferLength) / sampleRate);

                let value = 0;
                if (binIndex < bufferLength) {
                    value = dataArrayRef.current[binIndex];
                }

                const percent = value / 255;
                const y = height - (percent * height * 0.9);
                ctx.lineTo(x, y);
            }
        } else {
            // Simulated Data
            const time = performance.now() * 0.002;
            for (let x = 0; x <= width; x += 5) {
                const normalizedX = x / width;
                const w1 = Math.sin(normalizedX * 10 + time) * 0.1;
                const w2 = Math.sin(normalizedX * 25 - time * 1.5) * 0.05;
                const w3 = Math.sin(normalizedX * 50 + time * 2) * 0.02;
                const envelope = Math.sin(normalizedX * Math.PI);
                const amp = (0.2 + w1 + w2 + w3) * envelope;
                const y = height - (amp * height);
                ctx.lineTo(x, y);
            }
        }

        ctx.lineTo(width, height);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Frequency Labels
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const ranges = [
            { label: 'SUB', freq: 40, practical: 'Feel' },
            { label: 'BASS', freq: 100, practical: 'Kick/Bass' },
            { label: 'LOW MID', freq: 300, practical: 'Warmth' },
            { label: 'MID', freq: 1000, practical: 'Vocals/Snare' },
            { label: 'HIGH MID', freq: 3000, practical: 'Crunch' },
            { label: 'AIR', freq: 10000, practical: 'Hiss/Cymbals' }
        ];

        ctx.font = '10px monospace';
        ranges.forEach(range => {
            const x = (Math.log10(range.freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
            ctx.fillText(range.label, x, height - 12);
        });

        // Practical Labels
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 9px sans-serif';
        ranges.forEach(range => {
            const x = (Math.log10(range.freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
            ctx.fillText(range.practical, x, height - 2);
        });

        // 4. Draw EQ Curve
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();

        for (let x = 0; x <= width; x += 2) {
            const freq = 20 * Math.pow(1000, x / width);
            let totalGain = 0;

            effectiveNodes.forEach(node => {
                const logF = Math.log10(freq);
                const logCenter = Math.log10(node.freq);
                const bandwidth = 1 / (node.q * 2);

                let gain = 0;
                if (node.type === 'peaking') {
                    gain = node.gain * Math.exp(-(Math.pow(logF - logCenter, 2)) / (2 * Math.pow(bandwidth, 2)));
                } else if (node.type === 'lowshelf') {
                    const diff = logF - logCenter;
                    const transition = 1 / (1 + Math.exp(diff * 5 * node.q));
                    gain = node.gain * transition;
                } else if (node.type === 'highshelf') {
                    const diff = logF - logCenter;
                    const transition = 1 / (1 + Math.exp(-diff * 5 * node.q));
                    gain = node.gain * transition;
                } else if (node.type === 'lowpass') {
                    if (freq > node.freq) {
                        const octaveDiff = Math.log2(freq / node.freq);
                        gain = -12 * octaveDiff * Math.max(0.1, node.q);
                    }
                } else if (node.type === 'highpass') {
                    if (freq < node.freq) {
                        const octaveDiff = Math.log2(node.freq / freq);
                        gain = -12 * octaveDiff * Math.max(0.1, node.q);
                    }
                } else if (node.type === 'notch') {
                    const diff = Math.abs(logF - logCenter);
                    if (diff < bandwidth) gain = -48 * (1 - diff / bandwidth);
                } else if (node.type === 'bandpass') {
                    const diff = Math.abs(logF - logCenter);
                    if (diff < bandwidth) gain = 0;
                    else gain = -12 * (diff - bandwidth);
                }

                totalGain += gain;
            });

            // Clamp visualization
            totalGain = Math.max(-24, Math.min(24, totalGain));

            const y = height / 2 - (totalGain / DB_SCALE) * height;

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 5. Draw Control Nodes
        effectiveNodes.forEach(node => {
            const x = (Math.log10(node.freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
            let y = height / 2 - (node.gain / DB_SCALE) * height;

            // Ensure nodes don't render off-canvas by clamping (keep 10px padding)
            y = Math.max(10, Math.min(height - 10, y));

            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            if (node.id === selectedNodeId) {
                ctx.fillStyle = isSweeping ? '#eab308' : '#3b82f6';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.moveTo(x - 15, y);
                ctx.lineTo(x + 15, y);
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = 'transparent';
            }
            ctx.fill();
            ctx.stroke();
        });

    }, [getEffectiveNodes, selectedNodeId, analyser, isSweeping]);

    // Animation Loop
    useEffect(() => {
        let animationFrameId: number;
        const render = () => {
            draw();
            animationFrameId = requestAnimationFrame(render);
        };
        render(); // Start loop
        return () => cancelAnimationFrame(animationFrameId);
    }, [draw]);

    // --- Interaction Handlers ---
    const getValuesFromMouse = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { f: 1000, g: 0 };
        const rect = canvas.getBoundingClientRect();

        // Clamp to rect bounds to prevent weird values when outside
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

        const xRatio = x / rect.width;
        const logF = xRatio * (Math.log10(20000) - Math.log10(20)) + Math.log10(20);
        const f = Math.pow(10, logF);

        // Map Y to -24dB to +24dB
        const g = -((y - rect.height / 2) / rect.height) * DB_SCALE;

        return { f, g };
    }, []);

    // Global Event Handlers for Dragging
    useEffect(() => {
        if (!isDragging) return;

        const handleWindowMouseMove = (e: MouseEvent) => {
            if (selectedNodeId === null) return;

            const { f, g } = getValuesFromMouse(e.clientX, e.clientY);

            setNodes(prev => prev.map(n => {
                if (n.id === selectedNodeId) {
                    if (isSweeping) {
                        return { ...n, freq: f };
                    }
                    // Limit Gain to +/- 20dB usable range (visual is +/- 24)
                    return { ...n, freq: f, gain: Math.max(-20, Math.min(20, g)) };
                }
                return n;
            }));
        };

        const handleWindowMouseUp = () => {
            setIsDragging(false);
            // Optional: setSelectedNodeId(null); // uncomment if you consistently want to deselect
        };

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [isDragging, selectedNodeId, isSweeping, getValuesFromMouse]);


    const handleMouseDown = (e: React.MouseEvent) => {
        const { f, g } = getValuesFromMouse(e.clientX, e.clientY);
        const HIT_RADIUS = 20;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        // Need effectively rendered coordinates for hit testing
        let clickedNodeId: number | null = null;
        let minDist = Infinity;

        const effectiveNodes = getEffectiveNodes();
        effectiveNodes.forEach(node => {
            const nx = (Math.log10(node.freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * rect.width;
            let ny = rect.height / 2 - (node.gain / DB_SCALE) * rect.height;
            // Clamp hitbox to match visual clamping
            ny = Math.max(10, Math.min(rect.height - 10, ny));

            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const dist = Math.sqrt(Math.pow(nx - mx, 2) + Math.pow(ny - my, 2));
            if (dist < HIT_RADIUS && dist < minDist) {
                minDist = dist;
                clickedNodeId = node.id;
            }
        });

        if (clickedNodeId) {
            setSelectedNodeId(clickedNodeId);
            setIsDragging(true);
        } else {
            setSelectedNodeId(null);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        if (selectedNodeId === null || isSweeping) return;

        // Q-factor adjustment
        const delta = e.deltaY * -0.001;
        setNodes(prev => prev.map(n => {
            if (n.id === selectedNodeId) {
                const newQ = Math.max(0.1, Math.min(100, n.q + delta));
                return { ...n, q: newQ };
            }
            return n;
        }));
    };

    // Add non-passive wheel listener
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (e: WheelEvent) => {
            if (selectedNodeId !== null) e.preventDefault();
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
    }, [selectedNodeId]);

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const resizeCanvas = () => {
            if (containerRef.current && canvasRef.current) {
                const w = containerRef.current.clientWidth;
                const h = containerRef.current.clientHeight;
                canvasRef.current.width = w;
                canvasRef.current.height = h;
                setDimensions({ width: w, height: h });
                draw();
            }
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [draw]);

    const effectiveNodes = getEffectiveNodes();
    const selectedNode = effectiveNodes.find(n => n.id === selectedNodeId);

    // Calculate node position for floating UI
    const getNodePosition = () => {
        if (!selectedNode || dimensions.width === 0) return { x: 0, y: 0 };

        const x = (Math.log10(selectedNode.freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * dimensions.width;
        // Clamp Y to keep inside container even with high gains
        const rawY = dimensions.height / 2 - (selectedNode.gain / DB_SCALE) * dimensions.height;
        const y = Math.max(40, Math.min(dimensions.height - 40, rawY)); // Keep 40px padding

        return { x, y };
    };

    const { x: uiX, y: uiY } = getNodePosition();

    const handleReset = () => {
        const defaultNodes: EQNode[] = [
            { id: 1, type: 'lowshelf', freq: 60, gain: 0, q: 0.7 },
            { id: 2, type: 'peaking', freq: 250, gain: 0, q: 1.0 },
            { id: 3, type: 'peaking', freq: 1000, gain: 0, q: 1.0 },
            { id: 4, type: 'peaking', freq: 4000, gain: 0, q: 1.0 },
            { id: 5, type: 'highshelf', freq: 12000, gain: 0, q: 0.7 },
        ];
        setNodes(defaultNodes);
        setIsSweeping(false);
        setSelectedNodeId(null);
    };

    const handleAddBand = () => {
        if (nodes.length >= 10) return;
        const newId = Math.max(...nodes.map(n => n.id)) + 1;
        const newNode: EQNode = {
            id: newId,
            type: 'peaking',
            freq: 1000,
            gain: 0,
            q: 1.0
        };
        setNodes(prev => [...prev, newNode]);
    };

    const handleDeleteNode = () => {
        if (selectedNodeId === null) return;
        setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
        setSelectedNodeId(null);
    };

    // Helper to update node values directly from inputs
    const handleNodeUpdate = (key: keyof EQNode, value: number) => {
        if (selectedNodeId === null) return;
        setNodes(prev => prev.map(n => {
            if (n.id === selectedNodeId) {
                // Constraints
                let newValue = value;
                if (key === 'freq') newValue = Math.max(20, Math.min(20000, value));
                if (key === 'gain') newValue = Math.max(-18, Math.min(18, value));
                if (key === 'q') newValue = Math.max(0.1, Math.min(100, value));
                return { ...n, [key]: newValue };
            }
            return n;
        }));
    };

    return (
        <div className={`relative bg-black rounded-lg overflow-hidden border border-white/10 ${className}`} ref={containerRef}>
            {/* Global Overlay Info (Top Left - Reduced) */}
            <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none z-10">
                <div className="bg-black/50 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-white/60">
                    EQ {analyser ? '' : '(SIM)'}
                </div>
                <button
                    onClick={handleReset}
                    className="pointer-events-auto bg-white/5 hover:bg-white/10 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-white/60 hover:text-white flex items-center gap-1 transition-colors"
                >
                    <RefreshCcw size={10} /> RESET
                </button>
                <button
                    onClick={handleAddBand}
                    className="pointer-events-auto bg-white/5 hover:bg-white/10 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-white/60 hover:text-white flex items-center gap-1 transition-colors"
                    disabled={nodes.length >= 10}
                >
                    <Plus size={10} /> ADD
                </button>
                {onExport && (
                    <button
                        onClick={() => {
                            const activeNodes = nodes.filter(n => Math.abs(n.gain) > 0.5);
                            if (activeNodes.length === 0) return;

                            const lines = activeNodes.map(n => {
                                const gainSign = n.gain > 0 ? '+' : '';
                                return `- ${Math.round(n.freq)}Hz: ${gainSign}${n.gain.toFixed(1)}dB (Q${n.q.toFixed(1)})`;
                            });
                            onExport(`EQ Suggestions:\n${lines.join('\n')}`);
                        }}
                        className="pointer-events-auto bg-blue-500/20 hover:bg-blue-500/40 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-blue-300 hover:text-blue-100 flex items-center gap-1 transition-colors border border-blue-500/30"
                        title="Copy active bands to Review Notes"
                    >
                        <RefreshCcw size={10} className="rotate-180" /> NOTES
                    </button>
                )}
            </div>

            {/* Static Top Center Editable Values */}

            {selectedNode && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur px-4 py-1.5 rounded-full border border-white/10 pointer-events-auto z-20 shadow-lg">
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-white/40 uppercase tracking-wider">Type</span>
                        <select
                            className="bg-transparent text-white font-mono text-[10px] w-16 text-center focus:outline-none focus:bg-black uppercase cursor-pointer appearance-none"
                            value={selectedNode.type}
                            onChange={(e) => handleNodeUpdate('type', e.target.value as any)}
                        >
                            <option value="peaking">Peak</option>
                            <option value="lowshelf">Low Shelf</option>
                            <option value="highshelf">High Shelf</option>
                            <option value="lowpass">Low Cut</option>
                            <option value="highpass">High Cut</option>
                            <option value="notch">Notch</option>
                            <option value="bandpass">Band</option>
                        </select>
                    </div>
                    <div className="w-px h-6 bg-white/10"></div>
                    <div className="flex flex-col items-center">

                        <span className="text-[8px] text-white/40 uppercase tracking-wider">Freq</span>
                        <div className="flex items-center gap-0.5 group">
                            <EQInput
                                className="bg-transparent text-blue-300 font-mono text-xs w-10 text-center focus:outline-none focus:text-white"
                                value={selectedNode.freq}
                                min={20}
                                max={20000}
                                onChange={(v) => handleNodeUpdate('freq', v)}
                                formatter={(v) => Math.round(v).toString()}
                            />
                            <span className="text-[9px] text-white/30">Hz</span>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-white/40 uppercase tracking-wider">Gain</span>
                        <div className="flex items-center gap-0.5">
                            <EQInput
                                className={`bg-transparent font-mono text-xs w-8 text-center focus:outline-none focus:text-white ${selectedNode.gain > 0 ? 'text-green-400' : 'text-red-400'}`}
                                value={selectedNode.gain}
                                min={-18}
                                max={18}
                                onChange={(v) => handleNodeUpdate('gain', v)}
                                formatter={(v) => v.toFixed(1)}
                            />
                            <span className="text-[9px] text-white/30">dB</span>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-white/40 uppercase tracking-wider">Q</span>
                        <div className="flex items-center gap-0.5">
                            <EQInput
                                className="bg-transparent text-yellow-200 font-mono text-xs w-8 text-center focus:outline-none focus:text-white"
                                value={selectedNode.q}
                                min={0.1}
                                max={100}
                                onChange={(v) => handleNodeUpdate('q', v)}
                                formatter={(v) => v.toFixed(2)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Node Controls (Circular Arc) */}
            {selectedNode && (
                <div
                    className="absolute z-10 pointer-events-none"
                    style={{
                        left: uiX,
                        top: uiY,
                        width: 0, height: 0
                    }}
                >
                    {/* Arc Container: Radius ~35px (Tighter) */}
                    <div className="absolute top-0 left-0 w-0 h-0 pointer-events-none">

                        {/* 1. Sweep (Top-Left) */}
                        <button
                            onClick={() => setIsSweeping(!isSweeping)}
                            className={`pointer-events-auto absolute p-1.5 rounded-full transition-all border shadow-lg ${isSweeping ? 'bg-yellow-500 text-black border-yellow-400 scale-110' : 'bg-black/80 text-white/60 border-white/20 hover:text-white hover:scale-110'}`}
                            style={{
                                top: '-25px',
                                left: '-25px',
                                transform: 'translate(-50%, -50%)'
                            }}
                            title="Sweep (Boost)"
                        >
                            <Search size={12} />
                        </button>

                        {/* 2. Solo (Top Center) */}
                        <button
                            onClick={() => setIsSoloing(!isSoloing)}
                            className={`pointer-events-auto absolute p-1.5 rounded-full transition-all border shadow-lg ${isSoloing ? 'bg-purple-500 text-white border-purple-400 scale-110' : 'bg-black/80 text-white/60 border-white/20 hover:text-white hover:scale-110'}`}
                            style={{
                                top: '-38px',
                                left: '0px',
                                transform: 'translate(-50%, -50%)'
                            }}
                            title="Solo (Pro-Q Style)"
                        >
                            <Headphones size={12} />
                        </button>

                        {/* 3. Delete (Top-Right) */}
                        <button
                            onClick={handleDeleteNode}
                            className="pointer-events-auto absolute p-1.5 rounded-full bg-black/80 text-white/40 border border-white/20 hover:bg-red-900/50 hover:text-red-200 hover:border-red-500/50 transition-all shadow-lg hover:scale-110"
                            style={{
                                top: '-25px',
                                left: '25px',
                                transform: 'translate(-50%, -50%)'
                            }}
                            title="Delete Band"
                        >
                            <Plus size={12} className="rotate-45" />
                        </button>
                    </div>
                </div>
            )}

            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 bg-black/40 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors z-30"
                >
                    <Minimize2 size={16} />
                </button>
            )}

            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair touch-none"
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
            />

            {/* Hint */}
            <div className="absolute bottom-1 right-2 text-[9px] text-white/20 pointer-events-none select-none">
                {selectedNode ? 'Drag to Adjust • Scroll for Q' : 'Click/Drag to Add or Select Node'}
            </div>
        </div>
    );
};

export default EQVisualizer;
