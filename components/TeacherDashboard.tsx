import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile, StudentResult, HomeworkAssignment, LiveSession, ExerciseType } from '../types';
import HomeworkModal from './HomeworkModal';

interface TrackedStudent {
    id: string;
    email: string;
    name: string;
    completedCount: number;
    totalTasks: number;
    pendingHomeworkCount?: number;
    isOnline?: boolean;
}

interface TeacherDashboardProps {
    userProfile: UserProfile;
    trackedStudents: TrackedStudent[];
    onAddStudent: (email: string) => Promise<void>;
    onRemoveStudent: (email: string) => void;
    liveStudents: Record<string, LiveSession>;
    onlineUsers: Record<string, any>;
    onStartLiveSession: (title: string) => void;
    onEndLiveSession: () => void;
    onPushExercise: (title: string, type: ExerciseType) => void;
    liveSessionActive: boolean;
    liveSessionCode: string | null;
    sessionParticipants: string[];
    loading: boolean;
    onAssignHomework: (studentId: string, exercises: any[], date: string, instr: string) => Promise<void>;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
    userProfile,
    trackedStudents,
    onAddStudent,
    onRemoveStudent,
    liveStudents,
    onlineUsers,
    onStartLiveSession,
    onEndLiveSession,
    onPushExercise,
    liveSessionActive,
    liveSessionCode,
    sessionParticipants,
    loading,
    onAssignHomework
}) => {
    const [activeTab, setActiveTab] = useState<'LIVE_VIEW' | 'STUDENTS' | 'HOMEWORK' | 'ANALYTICS'>('STUDENTS');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
    const [resultDetail, setResultDetail] = useState<StudentResult | null>(null);
    const [emailInput, setEmailInput] = useState('');
    const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);
    const [studentToAssign, setStudentToAssign] = useState<TrackedStudent | null>(null);
    
    // Live Session Push State
    const [pushTab, setPushTab] = useState<ExerciseType>(ExerciseType.GRAMMAR);

    // Derived state
    const selectedStudent = trackedStudents.find(s => s.id === selectedStudentId);
    const activeSessions: LiveSession[] = Object.values(liveStudents);

    // Fetch results when a student is selected
    useEffect(() => {
        if (selectedStudentId) {
            fetchStudentResults(selectedStudentId);
        }
    }, [selectedStudentId]);

    const fetchStudentResults = async (studentId: string) => {
        const { data, error } = await supabase
            .from('student_results')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error("Error fetching results", error);
        } else {
            setStudentResults(data as StudentResult[]);
        }
    };

    const handleAssignClick = (student: TrackedStudent | null) => {
        setStudentToAssign(student);
        setIsHomeworkModalOpen(true);
    };

    const renderLiveView = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">Live Classroom</h2>
            
            {!liveSessionActive ? (
                <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-slate-200 text-center">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Start Live Session</h3>
                    <p className="text-slate-500 mb-6">Create a real-time session to monitor student progress.</p>
                    <button 
                        onClick={() => onStartLiveSession(`Class ${new Date().toLocaleDateString()}`)}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                        {loading ? "Starting..." : "Start Session"}
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-2xl shadow-xl flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold mb-1">Session Active</h3>
                            <div className="flex items-center gap-2 text-indigo-100">
                                <span>Code:</span>
                                <span className="font-mono text-xl bg-white/20 px-2 rounded">{liveSessionCode}</span>
                            </div>
                            <p className="text-sm mt-2 opacity-80">{sessionParticipants.length} students connected</p>
                        </div>
                        <button 
                            onClick={onEndLiveSession}
                            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold backdrop-blur"
                        >
                            End Session
                        </button>
                    </div>

                    {/* Exercise Push Controls (Simplified for brevity, would map categories) */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-4">Push Exercise</h4>
                        <div className="flex gap-2 mb-4 overflow-x-auto">
                            {Object.values(ExerciseType).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setPushTab(type)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold ${pushTab === type ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400">Select an exercise from the library to push to all connected students.</p>
                        {/* List of exercises would go here based on pushTab */}
                    </div>

                    {/* Live Student Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeSessions.map(session => (
                            <div key={session.studentId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold">{session.studentName}</h4>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Live</span>
                                </div>
                                <div className="text-xs text-slate-500 mb-2">
                                    {session.exerciseType}: {session.exerciseTitle}
                                </div>
                                <div className="bg-slate-50 p-2 rounded border border-slate-100 h-20 overflow-y-auto text-xs font-mono">
                                    {session.userInput || <span className="opacity-40 italic">Typing...</span>}
                                </div>
                            </div>
                        ))}
                        {activeSessions.length === 0 && (
                            <div className="col-span-full text-center py-10 text-slate-400">
                                Waiting for student activity...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderStudentDetail = () => {
        if (!selectedStudent) return null;

        return (
            <div className="h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                        <p className="text-slate-500">{selectedStudent.email}</p>
                    </div>
                    <button 
                        onClick={() => handleAssignClick(selectedStudent)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700"
                    >
                        Assign Homework
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Recent Activity</h3>
                    <div className="space-y-3">
                        {studentResults.length === 0 ? (
                            <p className="text-slate-400 text-sm">No activity recorded.</p>
                        ) : (
                            studentResults.map(result => (
                                <div 
                                    key={result.id} 
                                    onClick={() => setResultDetail(result)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${resultDetail?.id === result.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-700">{result.exercise_title}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${result.score/result.max_score >= 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {result.score}/{result.max_score}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span className="uppercase">{result.exercise_type}</span>
                                        <span>{new Date(result.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {resultDetail && (
                    <div className="mt-6 border-t pt-6 h-1/2 overflow-y-auto">
                        <h4 className="font-bold text-slate-800 mb-4">Attempt Details</h4>
                        <div className="space-y-4">
                            {resultDetail.details.map((detail, idx) => (
                                <div key={idx} className={`p-3 rounded-lg border text-sm ${detail.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200'}`}>
                                    <p className="font-bold text-slate-700 mb-1">{detail.question}</p>
                                    
                                    {detail.audioUrl ? (
                                        <div className="mt-2">
                                            <audio controls src={detail.audioUrl} className="w-full h-8" />
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase">Audio Response</p>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center">
                                            <span className={detail.isCorrect ? 'text-emerald-700' : 'text-rose-600'}>{detail.userAnswer || '(Empty)'}</span>
                                            {!detail.isCorrect && <span className="text-slate-400 text-xs">Correct: {detail.correctAnswer}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <HomeworkModal 
                isOpen={isHomeworkModalOpen}
                studentName={studentToAssign?.name}
                initialStudentId={studentToAssign?.id}
                students={trackedStudents} // For dropdown if no specific student
                onClose={() => setIsHomeworkModalOpen(false)}
                onAssign={async (sid, exercises, date, instr) => {
                    await onAssignHomework(sid, exercises, date, instr);
                    setIsHomeworkModalOpen(false);
                }}
                loading={loading}
            />

            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        Teacher
                    </h2>
                </div>
                
                <nav className="flex-1 p-4 space-y-1">
                    <button 
                        onClick={() => setActiveTab('LIVE_VIEW')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'LIVE_VIEW' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Live View
                        {activeSessions.length > 0 && <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{activeSessions.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('STUDENTS')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'STUDENTS' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        Students
                    </button>
                    <button 
                        onClick={() => setActiveTab('HOMEWORK')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'HOMEWORK' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        Homework
                    </button>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden p-8">
                {activeTab === 'LIVE_VIEW' && renderLiveView()}
                
                {activeTab === 'STUDENTS' && (
                    <div className="grid grid-cols-3 gap-8 h-full">
                        {/* Student List */}
                        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col h-full overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800 mb-2">Tracked Students</h3>
                                <div className="flex gap-2">
                                    <input 
                                        type="email" 
                                        placeholder="Add student email..." 
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                        value={emailInput}
                                        onChange={(e) => setEmailInput(e.target.value)}
                                    />
                                    <button 
                                        onClick={async () => {
                                            if (!emailInput) return;
                                            await onAddStudent(emailInput);
                                            setEmailInput('');
                                        }}
                                        className="bg-indigo-600 text-white px-3 rounded-lg font-bold hover:bg-indigo-700"
                                    >+</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {trackedStudents.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-sm">No students yet.</div>
                                ) : (
                                    trackedStudents.map(student => (
                                        <div 
                                            key={student.id}
                                            onClick={() => setSelectedStudentId(student.id)}
                                            className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-all ${selectedStudentId === student.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-800">{student.name}</span>
                                                {onlineUsers[student.id] && (
                                                    <span className="w-2 h-2 bg-emerald-500 rounded-full" title="Online"></span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">{student.email}</div>
                                            <div className="flex justify-between mt-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onRemoveStudent(student.email); }}
                                                    className="text-xs text-rose-400 hover:text-rose-600"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Student Detail View */}
                        <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-6 overflow-hidden h-full">
                            {selectedStudent ? renderStudentDetail() : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    <p>Select a student to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'HOMEWORK' && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800">Homework Management</h3>
                        <p className="text-slate-500 mb-4">View all assigned homework status across all students.</p>
                        <button 
                            onClick={() => handleAssignClick(null)} 
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700"
                        >
                            Create New Assignment
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherDashboard;