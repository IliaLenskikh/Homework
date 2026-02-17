
import React, { useState } from 'react';
import { Story, ExerciseType } from '../types';

interface ExerciseCardProps {
  story: Story;
  type: ExerciseType;
  onClick: () => void;
  isCompleted?: boolean;
  onAssign?: () => void; // Optional: Only for teachers
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ story, type, onClick, isCompleted, onAssign }) => {
  
  const getBadgeStyle = () => {
    switch(type) {
      case ExerciseType.GRAMMAR: return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case ExerciseType.VOCABULARY: return 'bg-teal-50 text-teal-700 border-teal-100';
      case ExerciseType.SPEAKING: return 'bg-rose-50 text-rose-700 border-rose-100';
      case ExerciseType.ORAL_SPEECH: return 'bg-purple-50 text-purple-700 border-purple-100';
      case ExerciseType.WRITING: return 'bg-blue-50 text-blue-700 border-blue-100';
      case ExerciseType.READING: return 'bg-amber-50 text-amber-700 border-amber-100';
      case ExerciseType.LISTENING: return 'bg-cyan-50 text-cyan-700 border-cyan-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getPreviewText = () => {
    if (type === ExerciseType.WRITING) {
        return story.emailSubject || "Write an email...";
    }
    if (type === ExerciseType.READING || type === ExerciseType.SPEAKING || type === ExerciseType.ORAL_SPEECH || type === ExerciseType.LISTENING) {
        if (story.text) return story.text;
        if (story.texts) return story.texts[0].content;
        if (type === ExerciseType.LISTENING) return "Audio task. Listen and answer.";
    }
    return story.template[0].replace(/\{0\}/g, '...');
  }

  const badgeStyle = getBadgeStyle();

  return (
    <div 
      className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 cursor-pointer group relative overflow-hidden h-full flex flex-col`}
    >
      {isCompleted && (
        <div className="absolute top-0 right-0 p-4">
            <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
        </div>
      )}

      {/* Main Click Area */}
      <div onClick={onClick} className="flex-1">
        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border mb-4 ${badgeStyle}`}>
            {type === ExerciseType.READING && story.questions ? 'True/False' : 
             type === ExerciseType.ORAL_SPEECH ? (story.speakingType === 'interview' ? 'Interview' : 'Monologue') : type}
        </span>
        
        <h3 className="font-bold text-lg text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors leading-tight">
          {story.title}
        </h3>
        
        <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 mb-4">
          {getPreviewText()}
        </p>
      </div>

      <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-medium text-slate-400 mt-auto">
         <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            5-10 min
         </span>
         
         <div className="flex items-center gap-3">
            {onAssign && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAssign(); }}
                className="z-10 flex items-center gap-1 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors font-bold"
                title="Assign as Homework"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Assign
              </button>
            )}
            <button 
                onClick={onClick}
                className="group-hover:translate-x-1 transition-transform text-indigo-500 font-bold opacity-0 group-hover:opacity-100 flex items-center gap-1"
            >
                Start
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
         </div>
      </div>
    </div>
  );
};

export default ExerciseCard;
