import React, { useState } from 'react';
import { TrackedStudent } from '../types';
import { StudentSidebar } from './StudentSidebar';

interface TeacherLayoutProps {
  students: TrackedStudent[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string | null) => void;
  onAddStudent: (email: string) => Promise<void>;
  children: React.ReactNode;
}

export const TeacherLayout: React.FC<TeacherLayoutProps> = ({
  students,
  selectedStudentId,
  onSelectStudent,
  onAddStudent,
  children
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:shadow-none
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-100 lg:hidden flex justify-between items-center">
                <h2 className="font-bold text-slate-800">Students</h2>
                <button onClick={() => setIsMobileSidebarOpen(false)} className="text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <StudentSidebar 
                students={students}
                selectedStudentId={selectedStudentId}
                onSelectStudent={(id) => {
                    onSelectStudent(id);
                    setIsMobileSidebarOpen(false);
                }}
                onAddStudent={onAddStudent}
            />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center gap-4">
            <button 
                onClick={() => setIsMobileSidebarOpen(true)}
                className="text-slate-500 hover:text-indigo-600"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span className="font-bold text-slate-800">Teacher Dashboard</span>
        </div>

        {/* Mirrored Mode Banner */}
        {selectedStudent && (
            <div className="bg-indigo-600 text-white px-6 py-3 flex justify-between items-center shadow-md z-10">
                <div className="flex items-center gap-2 font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    <span>Viewing as: <span className="font-bold">{selectedStudent.name}</span></span>
                </div>
                <button 
                    onClick={() => onSelectStudent(null)}
                    className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                    Exit Mirrored Mode
                </button>
            </div>
        )}

        {/* Scrollable Canvas */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
            {children}
        </main>
      </div>
    </div>
  );
};
