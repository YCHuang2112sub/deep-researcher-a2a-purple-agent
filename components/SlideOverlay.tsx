
import React from 'react';
import { ResearchStep } from '../types';

interface Props {
  step: ResearchStep | null;
  onClose: () => void;
  isDeckMode?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onRegenerate?: (stepId: string) => void;
}

const SlideOverlay: React.FC<Props> = ({ step, onClose, isDeckMode, onNext, onPrev, hasPrev, hasNext, onRegenerate }) => {
  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 animate-in fade-in zoom-in duration-300">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

      <div className="relative w-full max-w-6xl h-full glass border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row shadow-[0_0_100px_rgba(59,130,246,0.15)]">
        {/* Left Side: Fact Display (The Slide) */}
        <div className="flex-1 p-8 md:p-12 overflow-y-auto border-b md:border-b-0 md:border-r border-white/10 bg-gradient-to-br from-blue-900/10 to-transparent flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-500/30">
                Insight Node
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white leading-tight">
                {step.title}
              </h2>
            </div>

            {isDeckMode && (
              <div className="flex items-center gap-4">
                <button
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className={`p-2 rounded-lg border border-white/10 bg-white/5 transition-all ${!hasPrev ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/10'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={onNext}
                  className="px-6 py-2 bg-blue-600 rounded-lg font-bold text-sm hover:bg-blue-500 transition-all flex items-center gap-2"
                >
                  {hasNext ? 'NEXT SLIDE' : 'FINISH'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-8">
            {step.imageUrl ? (
              <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
                <img src={step.imageUrl} alt={step.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
              </div>
            ) : (
              <div className="w-full aspect-video rounded-2xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center gap-4 text-gray-500">
                <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-mono tracking-widest uppercase opacity-40 italic">Visuals Offline (Quota)</span>
              </div>
            )}

            <div className="prose prose-invert max-w-none">
              <div className="text-gray-300 text-lg leading-relaxed space-y-4">
                {step.findings?.split('\n').map((p, i) => p.trim() && (
                  <p key={i} className="animate-in slide-in-from-bottom-2 fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                    {p}
                  </p>
                ))}
              </div>
            </div>

            {step.researchPlan && (
              <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Logic Strategy
                </h4>
                <p className="text-xs text-blue-200/60 leading-relaxed italic">
                  "{step.researchPlan}"
                </p>
              </div>
            )}

            {step.qualityAudit && (
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Authenticity</div>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white">{step.qualityAudit.authenticityScore}%</span>
                    <div className="h-6 w-1 bg-yellow-500 rounded-full mb-1 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Hallucination Risk</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-tighter ${step.qualityAudit.hallucinationRisk === 'low' ? 'text-emerald-400' :
                        step.qualityAudit.hallucinationRisk === 'medium' ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                      {step.qualityAudit.hallucinationRisk}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-tight mt-1 line-clamp-2">
                    {step.qualityAudit.critique}
                  </p>
                </div>
              </div>
            )}

            {step.slideDesign && (
              <div className="mt-6 p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                  Slide Design
                </h4>
                <p className="text-xl font-bold text-white leading-tight mb-4">
                  {step.slideDesign.title}
                </p>
                <ul className="space-y-3">
                  {step.slideDesign.points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step.findingsHistory && step.findingsHistory.length > 0 && (
              <div className="mt-8 pt-8 border-t border-white/5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Research Evolution</h4>
                <div className="space-y-6">
                  {step.findingsHistory.map((history, idx) => (
                    <div key={idx} className="relative pl-6 border-l border-white/10 group">
                      <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-slate-800 border border-white/20 group-hover:bg-yellow-500/50 transition-colors" />
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter mb-2">Phase {idx + 1}</div>
                      <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                        {history}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {step.sources && step.sources.length > 0 && (
            <div className="mt-12 pt-8 border-t border-white/5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Grounding Sources</h3>
              <div className="flex flex-wrap gap-2">
                {step.sources.map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:text-white transition-colors">
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Teleprompter Script */}
        <div className="w-full md:w-[400px] bg-black/40 flex flex-col relative overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em]">Live Script</span>
              </div>
              <button
                onClick={() => step && onRegenerate?.(step.id)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-yellow-500 transition-all group"
                title="Regenerate Slide"
              >
                <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            {!isDeckMode && (
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex-1 p-8 overflow-y-auto scrollbar-hide space-y-6">
            {step.presentationScript ? (
              step.presentationScript.split('\n').map((line, i) => line.trim() && (
                <p key={i} className="text-3xl font-bold text-amber-100 leading-snug animate-in slide-in-from-right-4 fade-in" style={{ animationDelay: `${i * 150}ms` }}>
                  {line}
                </p>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">ENERGIZING_SCRIPT...</span>
              </div>
            )}
          </div>

          {/* Decorative scanner effect */}
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-[teleprompter_4s_infinite_linear]" />
        </div>
      </div>

      <style>{`
        @keyframes teleprompter {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default SlideOverlay;
