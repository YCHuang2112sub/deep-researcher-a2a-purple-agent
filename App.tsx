
import React, { useState, useRef, useEffect } from 'react';
import { ResearchStep, ResearchReport, ResearchPhase, AgentLog } from './types';
import { planResearchSteps, executeSearch, synthesizeReport, critiqueFindings, generateSlideScript, generateImage, designSlide, auditScript } from './services/geminiService';
import NodeFlow from './components/NodeFlow';
import ReportViewer from './components/ReportViewer';
import SlideOverlay from './components/SlideOverlay';
import PresentationView from './components/PresentationView';

function App() {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<ResearchPhase>(ResearchPhase.IDLE);
  const [steps, setSteps] = useState<ResearchStep[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [originalQuery, setOriginalQuery] = useState('');

  // Slide Maker Configuration
  const [speakerPersona, setSpeakerPersona] = useState('How a renowned YouTuber would speak with high energy, vibe, and hype—BUT keeping all the technical details and authenticity. Never hallucinate or invent baseless points; stay strictly grounded in the research while making it sound legendary.');
  const [visualPersona, setVisualPersona] = useState('A renowned illustrator who uses visual storytelling to bring users through a captivating narrative. The tone is artistic, evocative, and educational, focusing on how each fact fits into a larger story.');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedSlideStep, setSelectedSlideStep] = useState<ResearchStep | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  const suggestions = [
    "The landscape of an Agentic Future (2025-2030)",
    "Emergent behavior in multi-agent LLM systems",
    "Post-scarcity economics and AI automation",
    "The evolution of personalized medicine via GenAI"
  ];

  const addLog = (stepId: string, role: AgentLog['role'], message: string) => {
    setSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, logs: [...s.logs, { role, message, timestamp: Date.now() }] } : s
    ));
  };

  const handleSuggestion = (topic: string) => {
    setQuery(topic);
    setTimeout(() => executeResearchFlow(topic), 100);
  };

  const startResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    executeResearchFlow(query);
  };

  const executeResearchFlow = async (searchQuery: string) => {
    setError(null);
    setReport(null);
    setIsPresenting(false);
    setPhase(ResearchPhase.PLANNING);
    setActiveStepIndex(-1);
    setOriginalQuery(searchQuery);

    try {
      const plannedSteps = await planResearchSteps(searchQuery);
      setSteps(plannedSteps);
      setPhase(ResearchPhase.INVESTIGATING);

      const finalSteps: ResearchStep[] = [...plannedSteps];

      for (let i = 0; i < finalSteps.length; i++) {
        setActiveStepIndex(i);
        let iteration = 0;
        const maxIterations = 2;
        let isSufficient = false;

        while (iteration < maxIterations && !isSufficient) {
          const stepId = finalSteps[i].id;

          setSteps(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: iteration === 0 ? 'searching' : 'refining', iteration } : s
          ));
          addLog(stepId, 'Investigator', iteration === 0 ? 'Starting deep web investigation...' : `Attempting refinement pass #${iteration}...`);

          try {
            const searchResult = await executeSearch(
              finalSteps[i].title,
              iteration > 0 ? finalSteps[i].feedback : undefined,
              finalSteps[i].findings
            );

            const updatedFindings = iteration === 0
              ? searchResult.findings
              : `${finalSteps[i].findings}\n\n[Refinement ${iteration}]:\n${searchResult.findings}`;

            finalSteps[i] = {
              ...finalSteps[i],
              findings: updatedFindings,
              findingsHistory: [...(finalSteps[i].findingsHistory || []), searchResult.findings],
              sources: [...(finalSteps[i].sources || []), ...searchResult.sources]
            };
            addLog(stepId, 'Investigator', `Gathered ${searchResult.sources.length} sources.`);

            setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'critiquing' } : s));
            addLog(stepId, 'Critic', 'Auditing findings for quality...');

            const critique = await critiqueFindings(finalSteps[i].title, updatedFindings);
            addLog(stepId, 'Critic', critique.feedback);

            if (critique.sufficient || iteration >= maxIterations - 1) {
              isSufficient = true;
              finalSteps[i].status = 'completed';
              addLog(stepId, 'Investigator', 'Verification complete.');

              // 1. Design the Slide
              try {
                addLog(stepId, 'Presenter', 'Designing slide layout & visual concepts...');
                const design = await designSlide(finalSteps[i].title, updatedFindings, speakerPersona, visualPersona);
                finalSteps[i].slideDesign = design;
                finalSteps[i].preferredLayout = design.layout as any;

                // 2. Generate Assets concurrently based on design
                addLog(stepId, 'Presenter', 'Synthesizing script & cinematic background...');
                const [script, imageUrl] = await Promise.all([
                  generateSlideScript(design, speakerPersona),
                  generateImage(design.visualPrompt, visualPersona)
                ]);
                finalSteps[i].presentationScript = script;
                finalSteps[i].imageUrl = imageUrl;

                // 3. Quality Audit (Post-generation verification)
                addLog(stepId, 'Presenter', 'Running quality audit (Authenticity & Hallucination check)...');
                const audit = await auditScript(script, updatedFindings);
                finalSteps[i].qualityAudit = audit;
              } catch (assetErr: any) {
                console.warn("Asset synthesis failed:", assetErr);
                addLog(stepId, 'Presenter', '[NOTICE] Asset synthesis limited. Using defaults.');
              }

              addLog(stepId, 'Presenter', 'Process finalized. Node ready.');
            } else {
              finalSteps[i].feedback = critique.refinedQuery || critique.feedback;
              iteration++;
              addLog(stepId, 'Investigator', 'Refining based on feedback...');
            }

            setSteps([...finalSteps]);
          } catch (stepErr: any) {
            console.error("Step failed:", stepErr);
            const isQuota = stepErr?.message?.toLowerCase().includes("quota") || stepErr?.message?.includes("429");

            if (isQuota) {
              addLog(stepId, 'Investigator', "CRITICAL: Quota reached for text search. Retrying once after delay...");
              await new Promise(r => setTimeout(r, 2000)); // Wait 2s and try one more time or skip
              iteration++;
              continue;
            }

            finalSteps[i].status = 'error';
            setSteps([...finalSteps]);
            break;
          }
        }
      }

      setPhase(ResearchPhase.SYNTHESIZING);
      setActiveStepIndex(-1);
      const finalReport = await synthesizeReport(searchQuery, finalSteps);
      setReport(finalReport);
      setPhase(ResearchPhase.COMPLETED);

      // Auto-navigation to presentation mode
      setTimeout(() => {
        setIsPresenting(true);
        setCurrentSlideIndex(0);
      }, 2000);

    } catch (err: any) {
      setError(err.message || "An error occurred.");
      setPhase(ResearchPhase.IDLE);
    }
  };

  const regenerateSlide = async (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    addLog(stepId, 'Presenter', 'RE-DESIGNING: Crafting new narrative structure...');

    // Update status to show activity
    setSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, presentationScript: undefined, imageUrl: undefined, slideDesign: undefined } : s
    ));

    try {
      const design = await designSlide(step.title, step.findings || '', speakerPersona, visualPersona);

      addLog(stepId, 'Presenter', 'RE-SYNTHESIZING: Generating fresh script & vision...');
      const [newScript, newImageUrl] = await Promise.all([
        generateSlideScript(design, speakerPersona),
        generateImage(design.visualPrompt, visualPersona)
      ]);

      addLog(stepId, 'Presenter', 'RE-AUDITING: Verifying truth-levels...');
      const audit = await auditScript(newScript, step.findings || '');

      const updatedStep = {
        presentationScript: newScript,
        preferredLayout: design.layout as any,
        imageUrl: newImageUrl,
        slideDesign: design,
        qualityAudit: audit
      };

      setSteps(prev => prev.map(s =>
        s.id === stepId ? {
          ...s,
          ...updatedStep
        } : s
      ));

      addLog(stepId, 'Presenter', 'RE-DESIGN COMPLETE: All assets updated.');

      // If the selected slide is this one, update it too
      if (selectedSlideStep?.id === stepId) {
        setSelectedSlideStep(prev => prev ? {
          ...prev,
          ...updatedStep
        } : null);
      }
    } catch (err) {
      console.error("Regeneration failed:", err);
      addLog(stepId, 'Presenter', 'CRITICAL: Regeneration failed. Check quotas.');
    }
  };

  const openSlide = (step: ResearchStep) => {
    if (step.status === 'completed') {
      setSelectedSlideStep(step);
    }
  };

  const nextSlide = () => {
    if (currentSlideIndex < steps.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      setIsPresenting(false); // End presentation
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#020617] text-gray-100">
      {/* Header */}
      <header className="h-16 border-b border-white/10 glass flex items-center justify-between px-6 z-50 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center text-slate-900 font-bold text-xl shadow-[0_0_20px_rgba(234,179,8,0.2)]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold tracking-[0.2em] text-xl text-white uppercase font-brand">STORYSLIDE<span className="text-yellow-500 ml-1">AI</span></span>
          {phase !== ResearchPhase.IDLE && (
            <div className="ml-4 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-bold text-yellow-500 uppercase tracking-widest animate-pulse">
              {phase === ResearchPhase.PLANNING ? 'Mapping Logic' : phase === ResearchPhase.INVESTIGATING ? 'Searching Web' : 'Final Synthesis'}
            </div>
          )}
        </div>

        {phase === ResearchPhase.IDLE && (
          <form onSubmit={startResearch} className="flex-1 max-w-xl mx-8 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Deploy investigation node..."
              className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 text-sm transition-all pr-24"
            />
            <button className="absolute right-1.5 top-1.5 h-8 px-4 bg-yellow-500 rounded-lg text-xs font-bold text-slate-900 hover:bg-yellow-400 transition-colors">
              GENERATE
            </button>
          </form>
        )}

        <div className="flex items-center gap-4">
          {phase === ResearchPhase.COMPLETED && (
            <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setIsPresenting(false)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${!isPresenting ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Nodes
              </button>
              <button
                onClick={() => setIsPresenting(true)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${isPresenting ? 'bg-yellow-500 text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Deck
              </button>
            </div>
          )}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Persona
          </button>
        </div>
      </header>

      {/* Main Content Area: Sliding Container */}
      <main className="flex-1 relative overflow-hidden">
        <div
          className="flex w-[200%] h-full transition-transform duration-700 ease-in-out will-change-transform"
          style={{ transform: isPresenting ? 'translateX(-50%)' : 'translateX(0%)' }}
        >
          {/* TAB 1: RESEARCH FLOW */}
          <div className="w-1/2 h-full flex overflow-hidden">
            {phase === ResearchPhase.IDLE ? (
              <div className="w-full flex flex-col items-center justify-center p-6 space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-6xl font-black tracking-tight leading-tight text-white uppercase font-brand">
                    Deep Research <br /> <span className="text-yellow-500">Nodes.</span>
                  </h2>
                  <p className="text-slate-500 max-w-lg mx-auto text-lg">
                    Recursive investigation loops. Factual synthesis. <br />Final 1080p slide deck output.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-3 max-w-2xl px-4">
                  {suggestions.map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(topic)}
                      className="px-6 py-3 rounded-2xl border border-white/5 bg-slate-900/50 text-sm font-medium hover:border-yellow-500/50 hover:bg-yellow-500/5 hover:text-yellow-500 transition-all duration-300 shadow-xl"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full">
                {/* Left Panel: Node Flow */}
                <aside className="w-[450px] border-r border-white/5 bg-[#010409] relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                  <NodeFlow
                    steps={steps}
                    phase={phase}
                    activeStepIndex={activeStepIndex}
                    onNodeClick={openSlide}
                  />
                </aside>

                {/* Right Panel: Logs and Report */}
                <section ref={scrollRef} className="flex-1 overflow-y-auto bg-black/20 relative scrollbar-hide">
                  <div className="p-8 max-w-4xl mx-auto min-h-full">
                    {report ? (
                      <ReportViewer report={report} />
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Live Investigation Stream</h3>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                            <span className="text-[9px] font-mono text-yellow-500/80 uppercase">Node_Active</span>
                          </div>
                        </div>

                        {steps.map((step, idx) => (
                          <div key={step.id} className={`space-y-3 transition-all duration-700 ${idx > activeStepIndex ? 'opacity-20 translate-y-4' : 'opacity-100 translate-y-0'}`}>
                            <div className="flex items-center gap-3">
                              <div className="h-px flex-1 bg-white/5" />
                              <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Vector_{idx + 1}</span>
                              <div className="h-px flex-1 bg-white/5" />
                            </div>
                            <div className="space-y-2">
                              {step.logs.map((log, i) => (
                                <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-500">
                                  <span className={`text-[9px] font-bold w-20 flex-shrink-0 uppercase tracking-tighter ${log.role === 'Investigator' ? 'text-blue-400' :
                                    log.role === 'Critic' ? 'text-amber-400' : 'text-purple-400'
                                    }`}>
                                    {log.role}
                                  </span>
                                  <div className="flex-1 space-y-1">
                                    <p className={`text-xs leading-relaxed font-mono ${log.role === 'Presenter' ? 'text-purple-200 italic' : 'text-slate-400'}`}>
                                      {log.message}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {phase === ResearchPhase.SYNTHESIZING && (
                          <div className="py-20 flex flex-col items-center justify-center space-y-6">
                            <div className="w-16 h-16 border-2 border-yellow-500/10 border-t-yellow-500 rounded-full animate-spin" />
                            <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-[0.4em] animate-pulse">Finalizing Asset Synthesis</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* TAB 2: PRESENTATION DECK */}
          <div className="w-1/2 h-full overflow-hidden bg-[#020617]">
            <PresentationView
              steps={steps}
              currentIndex={currentSlideIndex}
              originalQuery={originalQuery}
              onNext={() => setCurrentSlideIndex(prev => Math.min(steps.length - 1, prev + 1))}
              onPrev={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
              onClose={() => setIsPresenting(false)}
              onRegenerate={regenerateSlide}
            />
          </div>
        </div>
      </main>

      <SlideOverlay
        step={selectedSlideStep}
        onClose={() => setSelectedSlideStep(null)}
        onRegenerate={regenerateSlide}
      />

      {/* Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsConfigOpen(false)} />
          <div className="relative w-full max-w-2xl glass border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
              <h3 className="text-xl font-bold text-white uppercase tracking-widest">Project Configuration</h3>
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <label className="text-sm font-bold text-white uppercase tracking-wider">Speaker Persona (Script Maker)</label>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed italic">
                  Defines the voice, tone, and narrative style of the teleprompter script.
                </p>
                <textarea
                  value={speakerPersona}
                  onChange={(e) => setSpeakerPersona(e.target.value)}
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 text-sm text-slate-300 transition-all resize-none"
                  placeholder="e.g., A technical expert who simplifies complex ideas..."
                />
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <label className="text-sm font-bold text-white uppercase tracking-wider">Visual Persona (Slide Maker)</label>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed italic">
                  Defines the aesthetic, art style, and composition of the generated slide visuals.
                </p>
                <textarea
                  value={visualPersona}
                  onChange={(e) => setVisualPersona(e.target.value)}
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 text-sm text-slate-300 transition-all resize-none"
                  placeholder="e.g., Cyberpunk aesthetic with neon colors and glitch effects..."
                />
              </section>
            </div>

            <div className="p-6 border-t border-white/5 bg-slate-900/40 flex justify-end gap-3">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="px-8 py-3 bg-yellow-500 rounded-xl text-xs font-bold text-slate-900 hover:bg-yellow-400 transition-all shadow-lg uppercase tracking-widest"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}

export default App;
