
import React from 'react';
import { ResearchStep, ResearchPhase } from '../types';

interface Props {
  steps: ResearchStep[];
  phase: ResearchPhase;
  activeStepIndex: number;
  onNodeClick: (step: ResearchStep) => void;
}

const NodeFlow: React.FC<Props> = ({ steps, phase, activeStepIndex, onNodeClick }) => {
  const getStatusColor = (status: ResearchStep['status']) => {
    switch (status) {
      case 'searching': return '#3b82f6';
      case 'critiquing': return '#f59e0b';
      case 'refining': return '#a855f7';
      case 'completed': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#374151';
    }
  };

  return (
    <div className="relative w-full h-full p-8 overflow-y-auto scrollbar-hide">
      {/* SVG Background Layer for Connectors */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: Math.max(800, steps.length * 200 + 400) }}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        
        {/* Connector Lines */}
        {steps.map((_, i) => {
          if (i === steps.length - 1) return null;
          const startY = 160 + (i * 180);
          const endY = 160 + ((i + 1) * 180);
          return (
            <path
              key={`path-${i}`}
              d={`M 150 ${startY} C 150 ${startY + 50}, 150 ${endY - 50}, 150 ${endY}`}
              stroke="url(#lineGradient)"
              strokeWidth="2"
              fill="none"
              strokeDasharray={steps[i+1].status !== 'pending' ? "0" : "5,5"}
              className={steps[i].status === 'completed' ? 'stroke-emerald-500/30' : ''}
            />
          );
        })}
      </svg>

      <div className="relative flex flex-col items-center gap-20">
        {/* Start Node */}
        <div className="w-48 glass rounded-xl border border-blue-500/30 p-4 text-center relative z-10 shadow-lg shadow-blue-500/5">
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Trigger</div>
          <div className="text-xs font-semibold">User Query Node</div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-gray-900" />
        </div>

        {/* Dynamic Step Nodes */}
        {steps.map((step, i) => (
          <div 
            key={step.id} 
            onClick={() => onNodeClick(step)}
            className={`w-64 glass rounded-xl border transition-all duration-500 relative z-10 overflow-hidden shadow-2xl group ${
              i === activeStepIndex ? 'ring-2 ring-blue-500/50 scale-105' : 'opacity-80'
            } ${step.status === 'completed' ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
            style={{ borderColor: `${getStatusColor(step.status)}44` }}
          >
            {/* Port Dots */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-gray-900 z-20" style={{ backgroundColor: getStatusColor(step.status) }} />
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-gray-900 z-20" style={{ backgroundColor: getStatusColor(step.status) }} />

            {/* Node Header */}
            <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between" style={{ backgroundColor: `${getStatusColor(step.status)}11` }}>
              <span className="text-[9px] font-bold uppercase tracking-tighter opacity-70">A2A Vector {i + 1}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${step.status === 'completed' ? 'bg-emerald-500' : 'animate-pulse bg-current'}`} style={{ color: getStatusColor(step.status) }} />
            </div>

            {/* Node Body */}
            <div className="p-4 space-y-2">
              <h4 className="text-[11px] font-bold leading-tight line-clamp-2">{step.title}</h4>
              
              {/* Slide Marker Badge */}
              {step.presentationScript && (
                <div className="flex items-center gap-1.5 py-1 px-2 rounded bg-purple-500/10 border border-purple-500/20 text-[8px] text-purple-400 font-bold uppercase animate-in fade-in slide-in-from-top-1">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  Slide Ready
                </div>
              )}

              {/* Loop Status indicator */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <div className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                  step.iteration && step.iteration > 0 ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-gray-500'
                }`}>
                  ITERATION: {step.iteration || 0}
                </div>
                <div className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                  {step.status}
                </div>
              </div>
            </div>

            {/* Hover Indicator for Slides */}
            {step.status === 'completed' && (
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <span className="bg-blue-500 text-[9px] font-bold px-3 py-1 rounded-full text-white shadow-lg translate-y-2 group-hover:translate-y-0 transition-transform">VIEW SLIDE</span>
              </div>
            )}

            {/* Progress Bar within node */}
            {(step.status === 'searching' || step.status === 'critiquing' || step.status === 'refining') && (
              <div className="h-0.5 w-full bg-white/5 relative">
                <div 
                  className="absolute h-full bg-blue-500 animate-[loading_1.5s_infinite_linear]" 
                  style={{ width: '30%', backgroundColor: getStatusColor(step.status) }} 
                />
              </div>
            )}
          </div>
        ))}

        {/* Synthesis Node */}
        <div className={`w-56 glass rounded-xl border p-4 text-center relative z-10 transition-all duration-1000 ${
          phase === ResearchPhase.SYNTHESIZING || phase === ResearchPhase.COMPLETED ? 'border-indigo-500/50 scale-105 opacity-100' : 'opacity-30'
        }`}>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-indigo-500 border-2 border-gray-900" />
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Synthesizer</div>
          <div className="text-xs font-semibold">Final Report Builder</div>
        </div>
      </div>
    </div>
  );
};

export default NodeFlow;
