
import React, { useState } from 'react';
import { Story, ExerciseType } from '../types';

interface ExerciseCardProps {
  story: Story;
  type: ExerciseType;
  onClick: () => void;
  isCompleted?: boolean;
  onAssign?: () => void; // Optional: Only for teachers (when student selected)
  isTeacher?: boolean;   // New prop to determine if we should show the disabled assign button
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ story, type, onClick, isCompleted, onAssign, isTeacher }) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const [justAssigned, setJustAssigned] = useState(false);

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
        if (story.texts && story.texts.length > 0) return story.texts[0].content;
        if (type === ExerciseType.LISTENING) return "Audio task. Listen and answer.";
    }
    return story.template && story.template.length > 0 ? story.template[0].replace(/\{0\}/g, '...') : "Exercise details...";
  }

  const handleAssignClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onAssign) {
          setIsAssigning(true);
          try {
            await onAssign();
            setJustAssigned(true);
            setTimeout(() => setJustAssigned(false), 2000);
          } catch (error) {
            console.error(error);
          } finally {
            setIsAssigning(false);
          }
      }
  };

  const badgeStyle = getBadgeStyle();

  return (
    <div 
      className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 cursor-pointer group relative overflow-hidden h-full flex flex-col`}
    >
      {isCompleted && (
        <div className="absolute top-0 right-0 p-4">
            <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            5-10 min
         </span>
         
         <div className="flex items-center gap-3">
            {(onAssign || isTeacher) && (
              <button 
                onClick={onAssign ? handleAssignClick : (e) => e.stopPropagation()}
                disabled={!onAssign || isAssigning || justAssigned}
                className={`z-10 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all font-bold whitespace-nowrap border ${
                    !onAssign 
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' 
                    : justAssigned 
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                        : 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 cursor-pointer'
                }`}
                title={!onAssign ? "Select a student first" : "Assign as Homework"}
              >
                {isAssigning ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : justAssigned ? (
                    <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Added
                    </>
                ) : !onAssign ? (
                    <>
                    Select student first
                    </>
                ) : (
                    <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Add to HW
                    </>
                )}
              </button>
            )}
            <button 
                onClick={onClick}
                className="group-hover:translate-x-1 transition-transform text-indigo-500 font-bold opacity-0 group-hover:opacity-100 flex items-center gap-1"
            >
                Start
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
            </button>
         </div>
      </div>
    </div>
  );
};

export default ExerciseCard;
