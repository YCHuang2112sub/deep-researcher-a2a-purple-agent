
import React from 'react';
import { Slide } from '../types';

interface SlideRendererProps {
  slide: Slide;
}

const SlideRenderer: React.FC<SlideRendererProps> = ({ slide }) => {
  // We use fixed pixel-based styles to ensure that when html2canvas captures 
  // at 1920x1080, the text proportions remain consistent with the visual design.
  const styles = {
    title: { fontSize: '84px', lineHeight: '1', marginBottom: '40px' },
    body: { fontSize: '38px', lineHeight: '1.4' },
    containerPadding: '80px'
  };

  const renderLayout = () => {
    switch (slide.layout) {
      case 'split-left':
        return (
          <div className="flex h-full w-full">
            <div className="w-1/2 h-full overflow-hidden">
               <img src={slide.imageUrl || 'https://picsum.photos/1200/675'} className="w-full h-full object-cover" alt="illustration" />
            </div>
            <div className="w-1/2 flex flex-col justify-center bg-slate-900/40" style={{ padding: styles.containerPadding }}>
              <h2 className="font-brand text-yellow-400" style={styles.title}>{slide.title}</h2>
              <p className="leading-relaxed text-slate-200" style={styles.body}>{slide.bodyText}</p>
            </div>
          </div>
        );
      case 'split-right':
        return (
          <div className="flex h-full w-full flex-row-reverse">
            <div className="w-1/2 h-full overflow-hidden">
               <img src={slide.imageUrl || 'https://picsum.photos/1200/675'} className="w-full h-full object-cover" alt="illustration" />
            </div>
            <div className="w-1/2 flex flex-col justify-center bg-slate-900/40" style={{ padding: styles.containerPadding }}>
              <h2 className="font-brand text-yellow-400" style={styles.title}>{slide.title}</h2>
              <p className="leading-relaxed text-slate-200" style={styles.body}>{slide.bodyText}</p>
            </div>
          </div>
        );
      case 'bottom-overlay':
        return (
          <div className="relative h-full w-full">
            <img src={slide.imageUrl || 'https://picsum.photos/1200/675'} className="w-full h-full object-cover" alt="illustration" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent" style={{ padding: `120px ${styles.containerPadding} ${styles.containerPadding}` }}>
              <h2 className="font-brand text-yellow-400" style={styles.title}>{slide.title}</h2>
              <p className="text-slate-100 max-w-6xl" style={styles.body}>{slide.bodyText}</p>
            </div>
          </div>
        );
      case 'centered':
      default:
        return (
          <div className="relative h-full w-full flex items-center justify-center">
            <img src={slide.imageUrl || 'https://picsum.photos/1200/675'} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm" alt="bg" />
            <div className="relative glass-panel rounded-3xl text-center shadow-2xl border-yellow-500/20 max-w-6xl" style={{ padding: '100px' }}>
              <h2 className="font-brand text-yellow-400 tracking-wider" style={{ fontSize: '110px', marginBottom: '50px' }}>{slide.title}</h2>
              <p className="font-light text-white leading-relaxed" style={{ fontSize: '46px' }}>{slide.bodyText}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 overflow-hidden border border-slate-800">
      {renderLayout()}
    </div>
  );
};

export default SlideRenderer;
