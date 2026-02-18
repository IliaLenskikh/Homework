
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
    const [resultsLoading, setResultsLoading] = useState(false);
    
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
        setResultsLoading(true);
        try {
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
        } catch (e) {
            console.error("Fetch failed", e);
        } finally {
            setResultsLoading(false);
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
                        {resultsLoading ? (
                            <div className="text-center py-10">
                                <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                        ) : studentResults.length === 0 ? (
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

                {resultDetail && resultDetail.details && (
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
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                        Teacher
                    </h2>
                </div>
                
                <nav className="flex-1 p-4 space-y-1">
                    <button 
                        onClick={() => setActiveTab('LIVE_VIEW')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'LIVE_VIEW' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" /></svg>
                        Live View
                        {activeSessions.length > 0 && <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{activeSessions.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('STUDENTS')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'STUDENTS' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                        Students
                    </button>
                    <button 
                        onClick={() => setActiveTab('HOMEWORK')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'HOMEWORK' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
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
                                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
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
