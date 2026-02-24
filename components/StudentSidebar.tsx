import React, { useState } from 'react';
import { TrackedStudent } from '../types';

interface StudentSidebarProps {
  students: TrackedStudent[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  onAddStudent: (email: string) => Promise<void>;
}

export const StudentSidebar: React.FC<StudentSidebarProps> = ({
  students,
  selectedStudentId,
  onSelectStudent,
  onAddStudent
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddSubmit = async () => {
    if (!emailInput) return;
    setIsAdding(true);
    try {
      await onAddStudent(emailInput);
      setEmailInput('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 mb-2">Tracked Students</h3>
            <div className="flex gap-2">
                <input 
                    type="email" 
                    placeholder="Add student email..." 
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubmit()}
                />
                <button 
                    onClick={handleAddSubmit}
                    disabled={isAdding}
                    className="bg-indigo-600 text-white px-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isAdding ? '...' : '+'}
                </button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto">
            {students.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">No students yet.</div>
            ) : (
                students.map(student => (
                    <div 
                        key={student.id}
                        onClick={() => onSelectStudent(student.id)}
                        className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-all ${selectedStudentId === student.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 truncate pr-2">{student.name}</span>
                            {student.isOnline && (
                                <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" title="Online"></span>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{student.email}</div>
                        <div className="flex justify-between mt-2 text-xs text-slate-400">
                            <span>{student.completedCount} / {student.totalTasks} tasks</span>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};
