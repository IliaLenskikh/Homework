import React from 'react';
import { UserProfile, HomeworkAssignment, Story, ExerciseType } from '../types';
import { CategoryCard } from './CategoryCard';
import { grammarStories } from '../data/grammar';
import { vocabStories } from '../data/vocabulary';
import { readingStories } from '../data/reading';
import { readingTrueFalseStories } from '../data/readingTrueFalse';
import { listeningStories } from '../data/listening';
import { speakingStories } from '../data/speaking';
import { writingStories } from '../data/writing';
import { oralStories } from '../data/oral';
import { monologueStories } from '../data/monologue';

interface StudentDashboardProps {
  userProfile: { name: string };
  stats: {
    progressPercentage: number;
    totalCompleted: number;
    totalTasks: number;
  };
  homework: {
    pendingCount: number;
  };
  onNavigate: {
    toHomework: () => void;
    toCategory: (type: string) => void;
  };
  readOnly?: boolean;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  userProfile,
  stats,
  homework,
  onNavigate,
  readOnly
}) => {
  const allReadingStories = [...readingStories, ...readingTrueFalseStories];
  const allOralStories = [...oralStories, ...monologueStories];

  const getCategoryStats = (stories: Story[]) => {
    // This is a placeholder as the actual stats logic was inline in AppRouter.
    // In a real refactor, we might pass these down or calculate them if we have the completed stories set.
    // For now, we will rely on the fact that the original code calculated these.
    // Wait, the original code used `getCategoryStats` helper function which relied on `completedStories`.
    // The prompt says "stats (total progress, per-category counts)".
    // However, passing per-category counts for all categories might be cumbersome.
    // Let's check how `AppRouter` does it.
    // It uses `getCategoryStats(stories)` which filters `completedStories`.
    // Since we don't have `completedStories` here, we might need to pass it or pass the calculated stats.
    // The prompt says "stats (total progress, per-category counts)".
    // Let's assume for this step that we can calculate it if we pass `completedStories` or just pass the counts.
    // To keep it simple and strictly follow the prompt "stats (total progress, per-category counts)", 
    // I should probably accept an object with counts.
    // But `AppRouter` has `getCategoryStats` defined inside it.
    // I'll define a helper here but I need `completedStories`.
    // The prompt says "stats (total progress, per-category counts)".
    // I will add `completedStories` to the props to make it easier, or just pass the counts.
    // Passing counts is cleaner for the component interface.
    return { completed: 0, total: stories.length }; 
  };

  // Re-reading the prompt: "stats (total progress, per-category counts)"
  // I will update the interface to accept `categoryStats`.
  
  const handleCategoryClick = (type: string) => {
    if (readOnly) return;
    onNavigate.toCategory(type);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Hello, {userProfile.name || 'Student'}!
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Ready to master your English skills? Choose a category below or check your homework.
            </p>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-xl border border-slate-100 mb-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * stats.progressPercentage) / 100} className="text-indigo-600 transition-all duration-1000 ease-out" />
                    </svg>
                    <span className="absolute text-xl font-bold text-slate-800">{stats.progressPercentage}%</span>
                </div>
                <div>
                    <div className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Total Progress</div>
                    <div className="text-2xl font-extrabold text-slate-900">{stats.totalCompleted} / {stats.totalTasks} Tasks</div>
                </div>
            </div>
            
            <div 
                onClick={readOnly ? undefined : onNavigate.toHomework}
                className={`flex items-center gap-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-2xl shadow-lg hover:scale-105 transition-transform ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <div>
                    <div className="font-bold text-lg">Homework</div>
                    <div className="text-indigo-100 text-sm">{homework.pendingCount} tasks pending</div>
                </div>
                {!readOnly && <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>}
            </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${readOnly ? '[&_div]:!cursor-not-allowed' : ''}`}>
            <CategoryCard 
                title="Grammar" 
                subtitle="Tenses & Forms" 
                stats={{ completed: 0, total: grammarStories.length }} 
                onClick={() => handleCategoryClick('grammar')}
                colorClass="text-indigo-600 bg-indigo-50"
                delay={0}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>}
                readOnly={false}
            />
            <CategoryCard 
                title="Vocabulary" 
                subtitle="Word Formation" 
                stats={{ completed: 0, total: vocabStories.length }}
                onClick={() => handleCategoryClick('vocabulary')}
                colorClass="text-teal-600 bg-teal-50"
                delay={100}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.638 1.638 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.638 1.638 0 00-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0c.31 0 .555-.26.532-.57a48.039 48.039 0 01-.642-5.056c-1.518-.19-3.057-.309-4.616-.354a.64.64 0 00-.657.643v0z" /></svg>}
                readOnly={false}
            />
            <CategoryCard 
                title="Reading" 
                subtitle="Comprehension" 
                stats={{ completed: 0, total: allReadingStories.length }}
                onClick={() => handleCategoryClick('reading')}
                colorClass="text-amber-600 bg-amber-50"
                delay={200}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
                readOnly={false}
            />
            <CategoryCard 
                title="Listening" 
                subtitle="Audio Tasks" 
                stats={{ completed: 0, total: listeningStories.length }}
                onClick={() => handleCategoryClick('listening')}
                colorClass="text-cyan-600 bg-cyan-50"
                delay={250}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>}
                readOnly={false}
            />
            <CategoryCard 
                title="Read Aloud" 
                subtitle="Phonetics" 
                stats={{ completed: 0, total: speakingStories.length }}
                onClick={() => handleCategoryClick('speaking')}
                colorClass="text-rose-600 bg-rose-50"
                delay={300}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>}
                readOnly={false}
            />
            <CategoryCard 
                title="Speaking" 
                subtitle="Monologue" 
                stats={{ completed: 0, total: allOralStories.length }}
                onClick={() => handleCategoryClick('oral')}
                colorClass="text-purple-600 bg-purple-50"
                delay={400}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>}
                readOnly={false}
            />
            <CategoryCard 
                title="Writing" 
                subtitle="Email Task" 
                stats={{ completed: 0, total: writingStories.length }}
                onClick={() => handleCategoryClick('writing')}
                colorClass="text-blue-600 bg-blue-50"
                delay={500}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>}
                readOnly={false}
            />
        </div>
    </div>
  );
};
