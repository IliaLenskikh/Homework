
import React, { useMemo } from 'react';
import { HomeworkAssignment, Story, ExerciseType } from '../types';
import { grammarStories } from '../data/grammar';
import { vocabStories } from '../data/vocabulary';
import { readingStories } from '../data/reading';
import { readingTrueFalseStories } from '../data/readingTrueFalse';
import { speakingStories } from '../data/speaking';
import { writingStories } from '../data/writing';
import { oralStories } from '../data/oral';
import { monologueStories } from '../data/monologue';
import { listeningStories } from '../data/listening';

interface StudentHomeworkViewProps {
  assignments: HomeworkAssignment[];
  onStartExercise: (story: Story, type: ExerciseType) => void;
  onBack: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const StudentHomeworkView: React.FC<StudentHomeworkViewProps> = ({ assignments, onStartExercise, onBack, onRefresh, loading }) => {
  
  // Helper to find story object by title and type
  const findStory = (title: string, type: ExerciseType): Story | undefined => {
    let source: Story[] = [];
    switch(type) {
      case ExerciseType.GRAMMAR: source = grammarStories; break;
      case ExerciseType.VOCABULARY: source = vocabStories; break;
      case ExerciseType.READING: source = [...readingStories, ...readingTrueFalseStories]; break;
      case ExerciseType.LISTENING: source = listeningStories; break;
      case ExerciseType.SPEAKING: source = speakingStories; break;
      case ExerciseType.ORAL_SPEECH: source = [...oralStories, ...monologueStories]; break;
      case ExerciseType.WRITING: source = writingStories; break;
    }
    return source.find(s => s.title === title);
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isLate = new Date() > new Date(dueDate) && status !== 'completed';
    
    if (status === 'completed') {
      return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase">Completed</span>;
    }
    if (isLate || status === 'overdue') {
      return <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold uppercase">Overdue</span>;
    }
    return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase">Pending</span>;
  };

  // Group assignments by creation date
  const groupedAssignments = useMemo(() => {
    const groups: Record<string, HomeworkAssignment[]> = {};
    
    // Sort all assignments first: Pending -> Overdue -> Completed, then by Due Date
    const sortedAll = [...assignments].sort((a, b) => {
      const statusOrder = { 'pending': 1, 'overdue': 2, 'completed': 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    sortedAll.forEach(task => {
        // Fallback to today if created_at is missing for some reason
        const dateKey = task.created_at 
            ? new Date(task.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
            : "Recent";
            
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(task);
    });

    return groups;
  }, [assignments]);

  // Get sorted date keys (Newest dates first)
  const sortedDateKeys = Object.keys(groupedAssignments).sort((a, b) => {
      if (a === "Recent") return -1;
      return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-200">
        <div className="flex items-center">
            <button 
            onClick={onBack}
            className="mr-6 p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm group"
            >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            </button>
            <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Homework Assignments</h2>
            <p className="text-slate-500 font-medium">Tasks assigned by your teacher</p>
            </div>
        </div>
        {onRefresh && (
            <button 
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 font-bold transition-all active:scale-95 disabled:opacity-50"
            >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {loading ? 'Refreshing...' : 'Refresh'}
            </button>
        )}
      </div>

      <div className="space-y-8">
        {assignments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-slate-800">No homework assigned!</h3>
            <p className="text-slate-500">Enjoy your free time.</p>
          </div>
        ) : (
            sortedDateKeys.map(dateKey => (
                <div key={dateKey}>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 pl-1 border-l-4 border-indigo-200 ml-1">
                        Assigned: {dateKey}
                    </h3>
                    <div className="grid gap-4">
                        {groupedAssignments[dateKey].map((task) => {
                            const story = findStory(task.exercise_title, task.exercise_type);
                            
                            return (
                              <div key={task.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    {getStatusBadge(task.status, task.due_date)}
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{task.exercise_type.replace('_', ' ')}</span>
                                  </div>
                                  <h3 className="text-lg font-bold text-slate-800 mb-1">{task.exercise_title}</h3>
                                  {task.instructions && (
                                    <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2 inline-block">
                                      <span className="font-bold text-slate-400 mr-2">Note:</span> {task.instructions}
                                    </div>
                                  )}
                                  <div className="text-xs text-slate-400 mt-3 font-medium flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                      Due: {new Date(task.due_date).toLocaleDateString()}
                                    </span>
                                    {task.score !== undefined && task.status === 'completed' && (
                                      <span className="text-emerald-600 font-bold">Score: {task.score} / {task.max_score}</span>
                                    )}
                                  </div>
                                </div>
                
                                {task.status !== 'completed' && story && (
                                  <button 
                                    onClick={() => onStartExercise(story, task.exercise_type)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all active:scale-95 shrink-0 w-full md:w-auto"
                                  >
                                    Start Exercise
                                  </button>
                                )}
                                
                                {task.status === 'completed' && (
                                   <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shrink-0">
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                   </div>
                                )}
                              </div>
                            );
                          })}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default StudentHomeworkView;
