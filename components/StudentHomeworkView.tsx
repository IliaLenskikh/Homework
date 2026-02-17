
import React, { useMemo, useState } from 'react';
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
  const [selectedDateGroup, setSelectedDateGroup] = useState<string | null>(null);
  
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

  const getBadgeStyle = (type: string) => {
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

  const getStatusBadge = (status: string, dueDate: string) => {
    const isLate = new Date() > new Date(dueDate) && status !== 'completed';
    
    if (status === 'completed') {
      return <span className="absolute top-4 right-4 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-200 shadow-sm flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Done</span>;
    }
    if (isLate || status === 'overdue') {
      return <span className="absolute top-4 right-4 px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-rose-200 shadow-sm">Overdue</span>;
    }
    return null; 
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
        const dateObj = task.created_at ? new Date(task.created_at) : new Date();
        // Format: 25.04 (DD.MM)
        const dateKey = dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(task);
    });

    return groups;
  }, [assignments]);

  // Get sorted date keys (Newest dates first)
  const sortedDateKeys = Object.keys(groupedAssignments).sort((a, b) => {
      // Find the actual date object from the first task in each group to sort correctly
      const taskA = groupedAssignments[a][0];
      const taskB = groupedAssignments[b][0];
      const dateA = taskA.created_at ? new Date(taskA.created_at).getTime() : 0;
      const dateB = taskB.created_at ? new Date(taskB.created_at).getTime() : 0;
      return dateB - dateA;
  });

  const activeDateGroup = selectedDateGroup ? groupedAssignments[selectedDateGroup] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-200">
        <div className="flex items-center">
            <button 
            onClick={selectedDateGroup ? () => setSelectedDateGroup(null) : onBack}
            className="mr-6 p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm group"
            >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            </button>
            <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {selectedDateGroup ? `Homework for ${selectedDateGroup}` : 'Homework'}
                </h2>
                <p className="text-slate-500 font-medium">
                    {selectedDateGroup ? 'Complete the tasks below' : 'Select a date folder'}
                </p>
            </div>
        </div>
        {onRefresh && !selectedDateGroup && (
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

      <div className="space-y-12">
        {assignments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-slate-800">No homework assigned!</h3>
            <p className="text-slate-500">Enjoy your free time.</p>
          </div>
        ) : selectedDateGroup ? (
            // View 2: Task List for Selected Date
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {activeDateGroup.map((task) => {
                    const story = findStory(task.exercise_title, task.exercise_type);
                    const badgeStyle = getBadgeStyle(task.exercise_type);
                    
                    return (
                        <div 
                        key={task.id} 
                        className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 flex flex-col relative overflow-hidden group h-full ${task.status === 'completed' ? 'opacity-75 grayscale-[0.5] hover:grayscale-0' : ''}`}
                        >
                        {getStatusBadge(task.status, task.due_date)}

                        <div className="flex-1 mb-6">
                            <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border mb-4 ${badgeStyle}`}>
                                {task.exercise_type.replace('_', ' ')}
                            </span>
                            
                            <h3 className="font-bold text-lg text-slate-800 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                                {task.exercise_title}
                            </h3>
                            
                            {task.instructions ? (
                                <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-3">
                                    <span className="font-bold text-xs text-slate-400 uppercase block mb-1">Note:</span>
                                    {task.instructions}
                                </p>
                            ) : (
                                <p className="text-sm text-slate-400 line-clamp-2">
                                    {story?.text?.substring(0, 60) || "Complete the task..."}
                                </p>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-medium mt-auto">
                            <span className={`flex items-center gap-1 ${new Date() > new Date(task.due_date) && task.status !== 'completed' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>

                            {task.status !== 'completed' && story ? (
                                <button 
                                    onClick={() => onStartExercise(story, task.exercise_type)}
                                    className="group-hover:translate-x-1 transition-transform text-indigo-600 font-bold flex items-center gap-1"
                                >
                                    Start
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            ) : (
                                task.score !== undefined && (
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                        Score: {task.score} / {task.max_score}
                                    </span>
                                )
                            )}
                        </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            // View 1: Date Folders
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedDateKeys.map(dateKey => {
                    const tasks = groupedAssignments[dateKey];
                    const pendingCount = tasks.filter(t => t.status === 'pending').length;
                    const overdueCount = tasks.filter(t => t.status === 'overdue' || (new Date() > new Date(t.due_date) && t.status !== 'completed')).length;
                    const completedCount = tasks.filter(t => t.status === 'completed').length;
                    const total = tasks.length;
                    
                    const isAllDone = completedCount === total && total > 0;
                    const hasOverdue = overdueCount > 0;

                    return (
                        <div 
                            key={dateKey}
                            onClick={() => setSelectedDateGroup(dateKey)}
                            className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-slate-100 flex flex-col group relative overflow-hidden h-full min-h-[200px]"
                        >
                            <div className="absolute top-6 right-6">
                                {isAllDone ? (
                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                ) : (
                                    <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-2 ${hasOverdue ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                        {hasOverdue && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>}
                                        {completedCount}/{total} Done
                                    </div>
                                )}
                            </div>

                            <div className={`p-4 rounded-2xl w-fit mb-6 transition-transform group-hover:scale-110 ${isAllDone ? 'bg-emerald-50 text-emerald-600' : hasOverdue ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>

                            <div className="mt-auto">
                                <h3 className="text-2xl font-extrabold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                                    Homework for {dateKey}
                                </h3>
                                
                                <div className="flex flex-col gap-1 text-sm font-medium">
                                    {hasOverdue ? (
                                        <span className="text-rose-500 font-bold flex items-center gap-1">
                                            {overdueCount} task{overdueCount > 1 ? 's' : ''} overdue
                                        </span>
                                    ) : pendingCount > 0 ? (
                                        <span className="text-slate-500">
                                            {pendingCount} task{pendingCount > 1 ? 's' : ''} to do
                                        </span>
                                    ) : (
                                        <span className="text-emerald-500 font-bold">All tasks completed!</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
};

export default StudentHomeworkView;
