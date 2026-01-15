
import React from 'react';
import { ResearchReport } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  report: ResearchReport;
}

const ReportViewer: React.FC<Props> = ({ report }) => {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Executive Summary */}
      <section className="glass p-8 rounded-3xl">
        <h2 className="text-2xl font-bold mb-4 text-white">Executive Summary</h2>
        <p className="text-lg text-gray-300 leading-relaxed">{report.summary}</p>
      </section>

      {/* Visual Analytics */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass p-8 rounded-3xl">
          <h3 className="text-xl font-bold mb-6 text-white">Extracted Metrics</h3>
          <div className="h-80 w-full relative">
            <ResponsiveContainer width="99%" height="99%" minHeight={300}>
              <BarChart data={report.dataPoints} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {report.dataPoints.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-8 rounded-3xl">
          <h3 className="text-xl font-bold mb-6 text-white">Key Takeaways</h3>
          <ul className="space-y-4">
            {report.keyFindings.map((finding, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="text-gray-300">{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Detailed Content */}
      <section className="glass p-8 rounded-3xl">
        <h3 className="text-xl font-bold mb-6 text-white">In-Depth Analysis</h3>
        <div className="prose prose-invert max-w-none text-gray-300 leading-loose">
          {report.detailedAnalysis.split('\n').map((para, i) => (
            <p key={i} className="mb-4">{para}</p>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 px-2">Verified Sources</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {report.sources.map((source, i) => (
            <a
              key={i}
              href={source.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="glass p-4 rounded-xl hover:bg-white/5 transition-colors group flex items-center justify-between"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-white truncate">{source.title}</span>
                <span className="text-xs text-blue-400/70 truncate">{new URL(source.uri).hostname}</span>
              </div>
              <svg className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ReportViewer;
