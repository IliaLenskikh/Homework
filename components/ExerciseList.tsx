import React from 'react';
import { Story, ExerciseType } from '../types';
import ExerciseCard from './ExerciseCard';

interface ExerciseListProps {
  stories: Story[];
  type: ExerciseType;
  completedStories: Set<string>;
  onStartExercise: (story: Story, type: ExerciseType, source: 'CATALOG' | 'HOMEWORK') => void;
  onGoHome: () => void;
}

export const ExerciseList: React.FC<ExerciseListProps> = ({
  stories,
  type,
  completedStories,
  onStartExercise,
  onGoHome,
}) => {
  let title = 'Grammar';
  let subtitle = 'Tenses & Forms';
  if (type === ExerciseType.VOCABULARY) {
    title = 'Vocabulary';
    subtitle = 'Word Formation';
  }
  if (type === ExerciseType.READING) {
    title = 'Reading';
    subtitle = 'Text Comprehension';
  }
  if (type === ExerciseType.LISTENING) {
    title = 'Listening';
    subtitle = 'Audio Tasks';
  }
  if (type === ExerciseType.SPEAKING) {
    title = 'Read Aloud';
    subtitle = 'Phonetics';
  }
  if (type === ExerciseType.ORAL_SPEECH) {
    title = 'Speaking';
    subtitle = 'Interview & Monologue';
  }
  if (type === ExerciseType.WRITING) {
    title = 'Writing';
    subtitle = 'Personal Email';
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center mb-10 pb-6 border-b border-slate-200 justify-between">
        <div className="flex items-center">
          <button
            onClick={onGoHome}
            className="mr-6 p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm group"
          >
            <svg
              className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {title}
            </h2>
            <p className="text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stories.map((story, idx) => {
          const isCompleted = completedStories.has(story.title);

          return (
            <div key={idx} className={`relative rounded-2xl transition-all`}>
              <ExerciseCard
                story={story}
                type={type}
                onClick={() => onStartExercise(story, type, 'CATALOG')}
                isCompleted={isCompleted}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
