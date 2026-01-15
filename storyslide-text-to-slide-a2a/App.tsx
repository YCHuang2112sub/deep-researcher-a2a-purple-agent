
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateSlideData, generateSlideImage } from './services/geminiService';
import { SlideDeck, GenerationStep } from './types';
import SlideRenderer from './components/SlideRenderer';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [researchText, setResearchText] = useState(() => localStorage.getItem('st_researchText') || '');
  const [deck, setDeck] = useState<SlideDeck | null>(() => {
    const saved = localStorage.getItem('st_deck');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentSlideIndex, setCurrentSlideIndex] = useState(() => parseInt(localStorage.getItem('st_slideIndex') || '0'));
  const [step, setStep] = useState<GenerationStep>(() => {
    const saved = localStorage.getItem('st_step');
    return (saved as GenerationStep) || GenerationStep.IDLE;
  });
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence Effects
  useEffect(() => { localStorage.setItem('st_researchText', researchText); }, [researchText]);
  useEffect(() => {
    if (deck) localStorage.setItem('st_deck', JSON.stringify(deck));
    else localStorage.removeItem('st_deck');
  }, [deck]);
  useEffect(() => { localStorage.setItem('st_slideIndex', currentSlideIndex.toString()); }, [currentSlideIndex]);
  useEffect(() => { localStorage.setItem('st_step', step); }, [step]);

  const handleGenerate = async () => {
    if (!researchText.trim()) return;

    try {
      setStep(GenerationStep.ANALYZING);
      const slideData = await generateSlideData(researchText);
      slideData.originalResearch = researchText;

      setStep(GenerationStep.PAINTING);
      const total = slideData.slides.length;

      const updatedSlides = [];
      for (let i = 0; i < slideData.slides.length; i++) {
        const slide = slideData.slides[i];
        setProgress(Math.round(((i + 1) / total) * 100));
        const imageUrl = await generateSlideImage(slide.visualPrompt);
        updatedSlides.push({ ...slide, imageUrl });
      }

      setDeck({ ...slideData, slides: updatedSlides });
      setStep(GenerationStep.COMPLETED);
      setCurrentSlideIndex(0);
    } catch (error) {
      console.error(error);
      alert('Generation failed. Check console for details.');
      setStep(GenerationStep.IDLE);
    }
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.topic && json.slides) {
          setDeck(json);
          setResearchText(json.originalResearch || '');
          setStep(GenerationStep.COMPLETED);
          setCurrentSlideIndex(0);
        } else {
          alert("Invalid project file.");
        }
      } catch (err) {
        alert("Failed to parse project file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const clearProject = () => {
    if (window.confirm("Start new project? Current progress will be cleared from cache.")) {
      setDeck(null);
      setStep(GenerationStep.IDLE);
      setResearchText('');
      setCurrentSlideIndex(0);
      localStorage.removeItem('st_deck');
      localStorage.removeItem('st_researchText');
      localStorage.removeItem('st_step');
      localStorage.removeItem('st_slideIndex');
    }
  };

  const downloadProject = async () => {
    if (!deck || !exportRef.current) return;

    setIsExporting(true);
    const zip = new JSZip();
    const folderName = deck.topic.replace(/\s+/g, '_');
    const imagesFolder = zip.folder("images");

    try {
      // 1. Add JSON data to zip
      zip.file(`${folderName}_data.json`, JSON.stringify(deck, null, 2));

      // 2. Setup PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1920, 1080]
      });

      // 3. Capture all slides
      for (let i = 0; i < deck.slides.length; i++) {
        setCurrentSlideIndex(i);
        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 800));

        const canvas = await html2canvas(exportRef.current, {
          scale: 1,
          useCORS: true,
          width: 1920,
          height: 1080,
          backgroundColor: '#020617',
          windowWidth: 1920,
          windowHeight: 1080
        });

        // Add PNG to Zip
        const pngData = canvas.toDataURL('image/png').split(',')[1];
        if (imagesFolder) {
          imagesFolder.file(`p${(i + 1).toString().padStart(2, '0')}.png`, pngData, { base64: true });
        }

        // Add to PDF
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        if (i > 0) pdf.addPage([1920, 1080], 'landscape');
        pdf.addImage(imgData, 'JPEG', 0, 0, 1920, 1080);
      }

      // Add PDF to Zip
      const pdfBlob = pdf.output('blob');
      zip.file(`${folderName}_presentation.pdf`, pdfBlob);

      // 4. Generate and download Zip
      const content = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `${folderName}_bundle.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(zipUrl);

    } catch (err) {
      console.error("Export error:", err);
      alert("Export encountered an error.");
    } finally {
      setIsExporting(false);
      setCurrentSlideIndex(0);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#020617] text-slate-300">
      <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportProject} className="hidden" />

      <div
        ref={exportRef}
        style={{
          width: '1920px',
          height: '1080px',
          position: 'fixed',
          left: '-5000px',
          top: '0',
          zIndex: -1,
          background: '#000'
        }}
      >
        {deck && <SlideRenderer slide={deck.slides[currentSlideIndex]} />}
      </div>

      <header className="px-8 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center text-slate-900 font-bold text-xl">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <h1 className="text-2xl font-brand tracking-widest text-white">STORYSLIDE AI</h1>
        </div>

        <div className="flex gap-4">
          {!deck && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-slate-400 hover:text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2"
            >
              <i className="fa-solid fa-upload"></i> Import JSON
            </button>
          )}

          {deck && (
            <>
              <button
                onClick={downloadProject}
                disabled={isExporting}
                className={`${isExporting ? 'bg-slate-700' : 'bg-yellow-500 hover:bg-yellow-400'} text-slate-900 px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2`}
              >
                <i className={`fa-solid ${isExporting ? 'fa-circle-notch animate-spin' : 'fa-download'}`}></i>
                {isExporting ? 'ZIPPING PROJECT...' : 'DOWNLOAD ZIP BUNDLE'}
              </button>
              <button
                onClick={clearProject}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-full font-bold transition-all"
              >
                NEW PROJECT
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <div
          className={`flex w-[200%] h-full transition-transform duration-700 ease-in-out will-change-transform ${step !== GenerationStep.IDLE ? '-translate-x-1/2' : 'translate-x-0'}`}
        >
          {/* SLIDE 1: DEEP RESEARCH INPUT */}
          <section className="w-1/2 h-full flex-shrink-0 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto mt-20 text-center">
              <h2 className="text-5xl font-brand text-white mb-6 tracking-tight uppercase">Deep Research</h2>
              <p className="text-xl text-slate-400 mb-12">Standardized 1080p output. Cinematic arrangements. Hype-driven scripts.</p>

              <div className="glass-panel p-6 rounded-2xl shadow-2xl">
                <textarea
                  className="w-full h-80 bg-slate-900/50 border border-slate-700 rounded-xl p-6 text-slate-200 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all resize-none"
                  placeholder="Paste your deep research data..."
                  value={researchText}
                  onChange={(e) => setResearchText(e.target.value)}
                />
                <button
                  onClick={handleGenerate}
                  disabled={!researchText.trim()}
                  className="w-full mt-6 bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-900 py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-3"
                >
                  <i className="fa-solid fa-bolt"></i> GENERATE RESEARCH NODE
                </button>
              </div>
            </div>
          </section>

          {/* SLIDE 2: RESEARCH NODE / RESULTS */}
          <section className="w-1/2 h-full flex-shrink-0 overflow-hidden relative bg-[#020617]">
            {/* LOADING STATE - Only show here when processing */}
            {(step === GenerationStep.ANALYZING || step === GenerationStep.PAINTING) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#020617]">
                <div className="relative w-48 h-48 mb-8">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                  <div className="absolute inset-0 rounded-full border-t-4 border-yellow-500 animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-brand text-white">{progress}%</span>
                  </div>
                </div>
                <h3 className="text-2xl font-brand text-yellow-500 mb-2 uppercase">
                  {step === GenerationStep.ANALYZING ? 'SYNTHESIZING DATA...' : 'RENDERING CINEMATIC FRAMES...'}
                </h3>
              </div>
            )}

            {/* ERROR / EMPTY STATE (Optional catch-all) */}
            {!deck && step !== GenerationStep.IDLE && step !== GenerationStep.ANALYZING && step !== GenerationStep.PAINTING && (
              <div className="h-full flex items-center justify-center text-slate-500">
                <p>Waiting for Research Data...</p>
              </div>
            )}

            {/* RESULTS VIEW */}
            {deck && !isExporting && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full p-8 overflow-y-auto">
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10" style={{ aspectRatio: '16/9' }}>
                    <div className="preview-scaler" style={{
                      width: '1920px',
                      height: '1080px',
                      transformOrigin: 'top left',
                      position: 'absolute',
                      top: 0,
                      left: 0
                    }}>
                      <SlideRenderer slide={deck.slides[currentSlideIndex]} />
                    </div>
                    <style>{`
                        .preview-scaler { 
                          transform: scale(calc(100 / 192)); 
                          width: 1920px;
                          height: 1080px;
                        }
                        @media (min-width: 1024px) {
                          .preview-scaler { transform: scale(0.4); }
                        }
                        @media (min-width: 1280px) {
                          .preview-scaler { transform: scale(0.45); }
                        }
                        @media (min-width: 1536px) {
                          .preview-scaler { transform: scale(0.55); }
                        }
                      `}</style>
                  </div>

                  <div className="flex justify-between items-center glass-panel px-6 py-4 rounded-xl">
                    <button
                      onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                      className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-30"
                      disabled={currentSlideIndex === 0}
                    >
                      <i className="fa-solid fa-chevron-left text-xl"></i>
                    </button>

                    <div className="flex gap-2">
                      {deck.slides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlideIndex(i)}
                          className={`w-3 h-3 rounded-full transition-all ${i === currentSlideIndex ? 'bg-yellow-500 w-8' : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentSlideIndex(prev => Math.min(deck.slides.length - 1, prev + 1))}
                      className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-30"
                      disabled={currentSlideIndex === deck.slides.length - 1}
                    >
                      <i className="fa-solid fa-chevron-right text-xl"></i>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 h-[75vh]">
                  <div className="glass-panel flex-1 rounded-2xl flex flex-col overflow-hidden border border-yellow-500/10">
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center gap-3">
                      <i className="fa-solid fa-microphone text-yellow-500"></i>
                      <span className="font-bold text-sm tracking-widest text-slate-300">TELEPROMPTER</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-[10px] uppercase font-bold text-yellow-500 mb-1">Speaker Notes</p>
                        <p className="text-xs text-yellow-200/60 leading-tight">High Tension YouTube Flow Active</p>
                      </div>
                      <div className="text-xl leading-relaxed text-white font-medium whitespace-pre-wrap italic">
                        "{deck.slides[currentSlideIndex].speakerNotes}"
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isExporting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-slate-950/90 backdrop-blur-sm px-8 text-center">
                <div className="w-24 h-24 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-8"></div>
                <h2 className="text-4xl font-brand text-white mb-2 uppercase">Bundling Your Story</h2>
                <p className="text-slate-500 max-w-md">Capturing slides, generating PDF, and packing everything into a single ZIP file. One download, all your assets.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="px-8 py-2 border-t border-slate-800 bg-slate-950 flex justify-between text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        <div>Asset Bundle: PDF + PNG Deck + JSON</div>
        <div className="flex gap-4">
          <span>{deck ? `Deck: ${deck.topic}` : 'Ready'}</span>
          <span>{isExporting ? 'EXPORTING ZIP' : step}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
