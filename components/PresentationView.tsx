
import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import JSZip from 'jszip';
// @ts-ignore
import { jsPDF } from 'jspdf';
import { ResearchStep } from '../types';
import SlideRenderer from './SlideRenderer';

interface Props {
    steps: ResearchStep[];
    currentIndex: number;
    originalQuery: string;
    onNext: () => void;
    onPrev: () => void;
    onClose: () => void;
    onRegenerate?: (stepId: string) => void;
}

const PresentationView: React.FC<Props> = ({ steps, currentIndex, originalQuery, onNext, onPrev, onClose, onRegenerate }) => {
    const currentStep = steps[currentIndex];
    const [isDownloading, setIsDownloading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);

    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                const width = containerRef.current.clientWidth;
                const height = containerRef.current.clientHeight;
                if (width > 0 && height > 0) {
                    const sx = width / 1920;
                    const sy = height / 1080;
                    setScale(Math.min(sx, sy) * 0.96);
                }
            }
        };

        const observer = new ResizeObserver(update);
        if (containerRef.current) observer.observe(containerRef.current);

        update(); // Initial call
        return () => observer.disconnect();
    }, []);

    if (!currentStep) return null;

    const slideData = {
        title: currentStep.slideDesign?.title || currentStep.title,
        bodyText: currentStep.findings?.substring(0, 300) + '...' || '',
        points: currentStep.slideDesign?.points,
        imageUrl: currentStep.imageUrl,
        layout: currentStep.preferredLayout || (['centered', 'split-left', 'split-right', 'bottom-overlay'][currentIndex % 4]) as any
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const zip = new JSZip();

            // 1. Project Data (Consolidated Research & Scripts)
            const projectData = {
                originalQuery: originalQuery || "No input provided.",
                exportedAt: new Date().toISOString(),
                slides: steps.map((s, i) => ({
                    slideIndex: i + 1,
                    title: s.title,
                    researchPlan: s.researchPlan || null,
                    findings: s.findings || "",
                    speakerNote: s.presentationScript || "No script generated.",
                    slideDesign: s.slideDesign || null,
                    sources: s.sources || []
                }))
            };
            zip.file("project_data.json", JSON.stringify(projectData, null, 2));

            // 3. Slides PDF
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [1920, 1080]
            });

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                if (i > 0) pdf.addPage([1920, 1080], 'landscape');

                // Add slide background (black)
                pdf.setFillColor(0, 0, 0);
                pdf.rect(0, 0, 1920, 1080, 'F');

                if (step.imageUrl) {
                    try {
                        const img = new Image();
                        img.crossOrigin = "Anonymous";
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = step.imageUrl!;
                        });
                        pdf.addImage(img, 'JPEG', 0, 0, 1920, 1080, undefined, 'FAST');
                    } catch (e) {
                        console.warn("Could not add image to PDF for slide", i);
                    }
                }

                // Add title as overlay for PDF clarity
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(40);
                pdf.text(step.title, 60, 100);
            }

            const pdfBlob = pdf.output('blob');
            zip.file("slides.pdf", pdfBlob);

            // 4. Generate and Download ZIP
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const link = document.createElement("a");
            link.href = url;
            link.download = `research_project_${Date.now()}.zip`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download failed:", err);
            alert("Download failed. See console for details.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-[#020617] text-slate-300 overflow-hidden">
            {/* Header bar within presentation view */}
            <div className="px-8 py-4 border-b border-white/10 flex justify-between items-center bg-slate-950/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center text-slate-900 font-bold">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <span className="text-xl font-bold tracking-widest text-white uppercase">Presentation Deck</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 rounded-full font-bold text-xs tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <svg className={`w-4 h-4 ${isDownloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {isDownloading ? 'PACKAGING...' : 'DOWNLOAD .ZIP'}
                    </button>
                    <button onClick={onClose} className="text-slate-400 hover:text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-colors">
                        EXIT VIEW
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-8 p-8">
                {/* Left Column: Slide + Navigator */}
                <div className="lg:col-span-8 flex flex-col h-full min-h-0 gap-6 overflow-hidden">
                    <div ref={containerRef} className="flex-1 relative w-full rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] bg-black border border-white/5 flex items-center justify-center min-h-0">
                        <div className="absolute top-1/2 left-1/2 origin-center" style={{
                            width: '1920px',
                            height: '1080px',
                            transform: `translate(-50%, -50%) scale(${scale})`,
                            transition: 'transform 0.1s ease-out'
                        }}>
                            <SlideRenderer slide={slideData} />
                        </div>
                    </div>

                    {/* Navigator */}
                    <div className="flex justify-between items-center bg-slate-900/50 border border-white/10 px-6 py-4 rounded-2xl shadow-xl">
                        <button
                            onClick={onPrev}
                            disabled={currentIndex === 0}
                            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-20"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div className="flex gap-3">
                            {steps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-yellow-500 w-12' : 'bg-slate-700 w-2'}`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={onNext}
                            disabled={currentIndex === steps.length - 1}
                            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-20"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Right Column: Speaker Notes (Independent Panel) */}
                <div className="lg:col-span-4 flex flex-col h-full min-h-0 overflow-hidden">
                    <div className="bg-slate-900/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full border border-white/5">
                        <div className="p-6 border-b border-white/5 flex flex-col gap-4 bg-slate-900/40">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                    <span className="font-bold text-[10px] tracking-widest text-slate-500 uppercase">Speaker Presentation Script</span>
                                </div>
                                <button
                                    onClick={() => currentStep && onRegenerate?.(currentStep.id)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-yellow-500 transition-all group"
                                    title="Regenerate Slide"
                                >
                                    <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>

                            {currentStep.researchPlan && (
                                <div className="px-4 py-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                                    <div className="text-[9px] font-bold text-yellow-500/50 uppercase tracking-[0.2em] mb-1">Investigation Plan</div>
                                    <p className="text-[11px] text-slate-400 italic leading-relaxed">
                                        {currentStep.researchPlan}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                            {currentStep.presentationScript ? (
                                <div className="space-y-6 pb-20">
                                    {currentStep.presentationScript.split('\n').map((line, i) => line.trim() && (
                                        <p key={i} className="text-2xl leading-relaxed text-white font-bold selection:bg-yellow-500/30 animate-in slide-in-from-bottom-4 fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                                            {line}
                                        </p>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                                    <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs font-mono">REGENERATING_ASSETS...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PresentationView;
