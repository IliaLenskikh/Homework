
import React, { useState, useEffect } from 'react';
import { ExerciseType } from '../types';
import { grammarStories } from '../data/grammar';
import { vocabStories } from '../data/vocabulary';
import { readingStories } from '../data/reading';
import { readingTrueFalseStories } from '../data/readingTrueFalse';
import { speakingStories } from '../data/speaking';
import { writingStories } from '../data/writing';
import { oralStories } from '../data/oral';
import { monologueStories } from '../data/monologue';
import { listeningStories } from '../data/listening';

interface TrackedStudent {
    id: string;
    email: string;
    name: string;
    isOnline?: boolean;
}

interface HomeworkModalProps {
  isOpen: boolean;
  studentName?: string; // Optional now, if not provided, we allow selection
  initialStudentId?: string; // Correctly passed ID
  students?: TrackedStudent[]; // List of available students to assign to
  onClose: () => void;
  onAssign: (studentId: string, selectedExercises: { title: string; type: ExerciseType }[], dueDate: string, instructions: string) => void;
  loading: boolean;
  preSelectedTask?: { title: string; type: ExerciseType }; // If assigning a specific task from the list
}

const HomeworkModal: React.FC<HomeworkModalProps> = ({ 
    isOpen, 
    studentName, 
    initialStudentId,
    students = [], 
    onClose, 
    onAssign, 
    loading, 
    preSelectedTask 
}) => {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]); 
  const [dueDate, setDueDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [activeTab, setActiveTab] = useState<ExerciseType>(ExerciseType.GRAMMAR);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Reset state when opening
  useEffect(() => {
      if (isOpen) {
          if (preSelectedTask) {
              setSelectedTasks([`${preSelectedTask.type}:${preSelectedTask.title}`]);
          } else {
              setSelectedTasks([]);
          }
          setDueDate('');
          setInstructions('');
          
          if (initialStudentId) {
              setSelectedStudentId(initialStudentId);
          } else if (!studentName && students.length > 0) {
              setSelectedStudentId(students[0].id);
          }
      }
  }, [isOpen, preSelectedTask, students, studentName, initialStudentId]);

  if (!isOpen) return null;

  const allCategories = [
    { type: ExerciseType.GRAMMAR, stories: grammarStories, label: 'Grammar' },
    { type: ExerciseType.VOCABULARY, stories: vocabStories, label: 'Vocabulary' },
    { type: ExerciseType.READING, stories: [...readingStories, ...readingTrueFalseStories], label: 'Reading' },
    { type: ExerciseType.LISTENING, stories: listeningStories, label: 'Listening' },
    { type: ExerciseType.SPEAKING, stories: speakingStories, label: 'Read Aloud' },
    { type: ExerciseType.ORAL_SPEECH, stories: [...oralStories, ...monologueStories], label: 'Speaking' },
    { type: ExerciseType.WRITING, stories: writingStories, label: 'Writing' },
  ];

  const handleToggleTask = (type: ExerciseType, title: string) => {
    if (preSelectedTask) return; 

    const key = `${type}:${title}`;
    setSelectedTasks(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = () => {
    if (selectedTasks.length === 0) {
      alert("Please select at least one exercise.");
      return;
    }
    if (!dueDate) {
      alert("Please select a due date.");
      return;
    }
    
    // Determine target ID: Priority is `initialStudentId` if passed (specific mode), then `selectedStudentId` (dropdown mode)
    let targetId = initialStudentId || selectedStudentId;
    
    if (!targetId && students.length > 0 && !studentName) {
        // Fallback for dropdown if state wasn't updated but list exists
        targetId = students[0].id;
    }

    if (!targetId) {
        alert("Please select a student.");
        return;
    }

    const payload = selectedTasks.map(taskKey => {
      const [typeStr, ...titleParts] = taskKey.split(':');
      return {
        type: typeStr as ExerciseType,
        title: titleParts.join(':')
      };
    });

    onAssign(targetId, payload, dueDate, instructions);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Assign Homework</h2>
            {studentName ? (
                <p className="text-slate-500">Student: <span className="font-bold text-indigo-600">{studentName}</span></p>
            ) : (
                <div className="flex items-center gap-2 mt-2">
                    <label className="text-sm font-bold text-slate-500">Assign to:</label>
                    <select 
                        className="bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                    >
                        {students.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.isOnline ? '🟢 ' : ''} {s.name} ({s.email})
                            </option>
                        ))}
                    </select>
                </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {preSelectedTask ? (
              // Single Task Mode View
              <div className="flex-1 p-10 flex flex-col items-center justify-center bg-slate-50/50">
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
                      <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Assigning Single Task</h3>
                      <p className="text-slate-500 mb-4">{preSelectedTask.title}</p>
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase">{preSelectedTask.type}</span>
                  </div>
              </div>
          ) : (
              // Multi-select Mode View
              <>
                {/* Sidebar Tabs */}
                <div className="w-48 bg-slate-50 border-r border-slate-100 overflow-y-auto p-2 space-y-1">
                    {allCategories.map(cat => (
                    <button
                        key={cat.type}
                        onClick={() => setActiveTab(cat.type)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                        activeTab === cat.type 
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' 
                            : 'text-slate-500 hover:bg-white hover:text-slate-700'
                        }`}
                    >
                        {cat.label}
                        <span className="ml-2 text-xs opacity-50 bg-slate-200 px-1.5 py-0.5 rounded-full">
                        {cat.stories.length}
                        </span>
                    </button>
                    ))}
                </div>

                {/* Exercise List */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allCategories.find(c => c.type === activeTab)?.stories.map((story, idx) => {
                        const key = `${activeTab}:${story.title}`;
                        const isSelected = selectedTasks.includes(key);
                        return (
                        <div 
                            key={idx}
                            onClick={() => handleToggleTask(activeTab, story.title)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            isSelected 
                                ? 'border-indigo-500 bg-indigo-50' 
                                : 'border-slate-100 hover:border-slate-300'
                            }`}
                        >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 shrink-0 ${
                            isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 bg-white'
                            }`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div>
                            <h4 className={`font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                {story.title}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {story.text?.substring(0, 60) || story.template?.[0]?.substring(0,60) || "Exercise task..."}
                            </p>
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </div>
              </>
          )}
        </div>

        {/* Footer Configuration */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Due Date</label>
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Instructions (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Pay attention to past tenses"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          
          <div className="flex flex-col justify-end gap-3 min-w-[200px]">
            <div className="text-right text-sm text-slate-500 font-medium">
              Selected: <span className="text-indigo-600 font-bold">{selectedTasks.length}</span> exercises
            </div>
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              Assign Homework
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HomeworkModal;
