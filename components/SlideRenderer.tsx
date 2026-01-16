
import React from 'react';

export interface SlideData {
    title: string;
    bodyText: string;
    points?: string[];
    imageUrl?: string;
    layout: 'split-left' | 'split-right' | 'bottom-overlay' | 'centered';
}

interface Props {
    slide: SlideData;
}

const SlideRenderer: React.FC<Props> = ({ slide }) => {
    const renderContent = () => {
        if (slide.points && slide.points.length > 0) {
            return (
                <ul className="space-y-4">
                    {slide.points.map((point, i) => (
                        <li key={i} className="flex gap-4 items-start text-4xl lg:text-5xl text-slate-200 font-medium leading-snug">
                            <span className="mt-2 w-3 h-3 rounded-full bg-yellow-500 shrink-0 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                            <span>{point}</span>
                        </li>
                    ))}
                </ul>
            );
        }
        return (
            <p className="text-4xl lg:text-5xl text-slate-300 leading-relaxed font-medium">
                {slide.bodyText}
            </p>
        );
    };

    const renderLayout = () => {
        const bgImageStyle = slide.imageUrl ? {
            backgroundImage: `url(${slide.imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        } : {};

        switch (slide.layout) {
            case 'split-left':
                return (
                    <div className="flex h-full w-full bg-[#020617]">
                        <div className="w-1/2 p-12 lg:p-20 flex flex-col justify-center relative z-10 bg-slate-950/60 backdrop-blur-md border-r border-white/5">
                            <h1 className="text-5xl lg:text-7xl font-black text-white uppercase leading-none mb-10 tracking-tighter">
                                {slide.title}
                            </h1>
                            {renderContent()}
                        </div>
                        <div className="w-1/2 h-full" style={bgImageStyle} />
                    </div>
                );
            case 'split-right':
                return (
                    <div className="flex h-full w-full bg-[#020617]">
                        <div className="w-1/2 h-full" style={bgImageStyle} />
                        <div className="w-1/2 p-12 lg:p-20 flex flex-col justify-center relative z-10 bg-slate-950/60 backdrop-blur-md border-l border-white/5">
                            <h1 className="text-5xl lg:text-7xl font-black text-white uppercase leading-none mb-10 tracking-tighter">
                                {slide.title}
                            </h1>
                            {renderContent()}
                        </div>
                    </div>
                );
            case 'bottom-overlay':
                return (
                    <div className="relative h-full w-full overflow-hidden" style={bgImageStyle}>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-12 lg:p-20 z-10 bg-slate-950/40 backdrop-blur-sm">
                            <h1 className="text-6xl lg:text-8xl font-black text-white uppercase leading-none mb-8 tracking-tighter shadow-black drop-shadow-2xl">
                                {slide.title}
                            </h1>
                            <div className="max-w-5xl">
                                {renderContent()}
                            </div>
                        </div>
                    </div>
                );
            case 'centered':
            default:
                return (
                    <div className="relative h-full w-full flex flex-col items-center justify-center p-12 lg:p-20 text-center overflow-hidden" style={bgImageStyle}>
                        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" />
                        <div className="relative z-10 max-w-6xl">
                            <h1 className="text-6xl lg:text-8xl font-black text-white uppercase leading-tight mb-8 tracking-tighter drop-shadow-2xl">
                                {slide.title}
                            </h1>
                            <div className="h-1.5 w-40 bg-yellow-500 mx-auto mb-12 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
                            <div className="flex justify-center text-left">
                                {renderContent()}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="w-full h-full bg-black overflow-hidden select-none">
            {renderLayout()}
        </div>
    );
};

export default SlideRenderer;
