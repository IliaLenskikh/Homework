import React from 'react';
import { Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Story, 
  ExerciseType, 
  UserProfile, 
  HomeworkAssignment, 
  AttemptDetail,
  UserRole,
  LiveSession,
  TrackedStudent,
  OnlineUser
} from '../types';
import ExerciseCard from './ExerciseCard';
import ExerciseView from './ExerciseView';
import StudentHomeworkView from './StudentHomeworkView';
import { TeacherLayout } from './TeacherLayout';
import { StudentDashboard } from './StudentDashboard';
import { grammarStories } from '../data/grammar';
import { vocabStories } from '../data/vocabulary';
import { readingStories } from '../data/reading';
import { readingTrueFalseStories } from '../data/readingTrueFalse';
import { speakingStories } from '../data/speaking';
import { writingStories } from '../data/writing';
import { oralStories } from '../data/oral';
import { monologueStories } from '../data/monologue';
import { listeningStories } from '../data/listening';
import { CategoryCard } from './CategoryCard';
import { ExerciseList } from './ExerciseList';
import { getErrorMessage } from '../utils/errorHandling';

const allReadingStories = [...readingStories, ...readingTrueFalseStories];
const allOralStories = [...oralStories, ...monologueStories];

const allStories = [
  ...grammarStories.map(s => ({ ...s, type: ExerciseType.GRAMMAR })),
  ...vocabStories.map(s => ({ ...s, type: ExerciseType.VOCABULARY })),
  ...allReadingStories.map(s => ({ ...s, type: ExerciseType.READING })),
  ...speakingStories.map(s => ({ ...s, type: ExerciseType.SPEAKING })),
  ...allOralStories.map(s => ({ ...s, type: ExerciseType.ORAL_SPEECH })),
  ...writingStories.map(s => ({ ...s, type: ExerciseType.WRITING })),
  ...listeningStories.map(s => ({ ...s, type: ExerciseType.LISTENING })),
];

interface AppRouterProps {
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile | null) => void;
  loading: boolean;
  
  // Auth props
  authError: string | null;
  authSuccessMsg: string | null;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  newPassword: string;
  setNewPassword: (password: string) => void;
  isLoginMode: boolean;
  setIsLoginMode: (mode: boolean) => void;
  handleAuthSubmit: (e: React.FormEvent) => Promise<void>;
  handlePasswordResetSubmit: (e: React.FormEvent) => Promise<void>;
  handleRoleSelectionSubmit: (role: UserRole) => Promise<void>;
  handleSettingsSave: (e: React.FormEvent) => Promise<void>;
  handleLogoutSubmit: () => Promise<void>;
  handleRoleSwitchSubmit: () => Promise<void>;
  
  // Navigation/Exercise props
  goHome: () => void;
  startExercise: (story: Story, type: ExerciseType, source?: 'CATALOG' | 'HOMEWORK') => void;
  completedStories: Set<string>;
  handleStoryComplete: (title: string, type: ExerciseType, score: number, maxScore: number, details: AttemptDetail[]) => Promise<void>;
  
  // Homework props
  myHomework: HomeworkAssignment[];
  homeworkLoading: boolean;
  loadHomework: (studentId: string) => Promise<void>;
  pendingHomeworkCount: number;
  
  // Teacher Dashboard props
  trackedStudentsWithStatus: TrackedStudent[];
  handleAddStudent: (email: string) => Promise<void>;
  handleRemoveStudent: (email: string) => void;
  liveStudents: Record<string, LiveSession>;
  onlineUsers: Record<string, OnlineUser>;
  startLiveSession: (title: string) => Promise<void>;
  endLiveSession: () => Promise<void>;
  pushExerciseToStudents: (title: string, type: ExerciseType) => Promise<void>;
  liveSessionActive: boolean;
  liveSessionCode: string | null;
  sessionParticipants: string[];
  handleAssignHomework: (studentId: string, exercises: { title: string; type: ExerciseType }[], dueDate: string, instructions: string) => Promise<void>;
  selectedStudentForAssignment: TrackedStudent | null;
  
  // Student Live Session props
  joinedSessionCode: string | null;
  joinSessionInput: string;
  setJoinSessionInput: (input: string) => void;
  joinLiveSession: (code: string) => Promise<void>;
  
  // Stats
  progressPercentage: number;
  totalCompleted: number;
  totalTasks: number;
  
  // Mirrored View
  viewingStudentId: string | null;
  setViewingStudentId: (id: string | null) => void;
  studentCompletedStories: Set<string>;
  studentHomeworkList: HomeworkAssignment[];
}

const ExerciseRouteWrapper: React.FC<AppRouterProps> = (props) => {
  const { type, title } = useParams<{ type: string; title: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const source = location.state?.source || 'CATALOG';

  const decodedTitle = decodeURIComponent(title || '');
  const exerciseType = type as ExerciseType;
  
  const story = allStories.find(s => s.title === decodedTitle && s.type === exerciseType);

  if (!story) return <div className="p-8 text-center text-slate-500">Story not found</div>;

  const exerciseView = (
    <ExerciseView 
      story={story} 
      type={exerciseType}
      onBack={() => {
        if (source === 'HOMEWORK') navigate('/homework');
        else navigate(`/exercise/${type}`);
      }}
      onComplete={(score, maxScore, details) => props.handleStoryComplete(story.title, exerciseType, score, maxScore, details)}
      userProfile={props.userProfile}
      readOnly={!!props.viewingStudentId}
    />
  );

  if (props.viewingStudentId) {
      return (
        <TeacherLayout
            students={props.trackedStudentsWithStatus}
            selectedStudentId={props.viewingStudentId}
            onSelectStudent={props.setViewingStudentId}
            onAddStudent={props.handleAddStudent}
        >
            {exerciseView}
        </TeacherLayout>
      );
  }

  return exerciseView;
};

export const AppRouter: React.FC<AppRouterProps> = (props) => {
  const navigate = useNavigate();
  const {
    userProfile,
    setUserProfile,
    loading,
    authError,
    authSuccessMsg,
    email,
    setEmail,
    password,
    setPassword,
    newPassword,
    setNewPassword,
    isLoginMode,
    setIsLoginMode,
    handleAuthSubmit,
    handlePasswordResetSubmit,
    handleRoleSelectionSubmit,
    handleSettingsSave,
    handleLogoutSubmit,
    handleRoleSwitchSubmit,
    goHome,
    startExercise,
    completedStories,
    handleStoryComplete,
    myHomework,
    homeworkLoading,
    loadHomework,
    pendingHomeworkCount,
    trackedStudentsWithStatus,
    handleAddStudent,
    handleRemoveStudent,
    liveStudents,
    onlineUsers,
    startLiveSession,
    endLiveSession,
    pushExerciseToStudents,
    liveSessionActive,
    liveSessionCode,
    sessionParticipants,
    handleAssignHomework,
    selectedStudentForAssignment,
    joinedSessionCode,
    joinSessionInput,
    setJoinSessionInput,
    joinLiveSession,
    progressPercentage,
    totalCompleted,
    totalTasks,
    viewingStudentId,
    setViewingStudentId,
    studentCompletedStories,
    studentHomeworkList
  } = props;

  const activeCompletedStories = viewingStudentId ? studentCompletedStories : completedStories;
  const activeHomework = viewingStudentId ? studentHomeworkList : myHomework;
  const activeTotalCompleted = viewingStudentId ? studentCompletedStories.size : totalCompleted;
  const activeProgressPercentage = viewingStudentId ? Math.round((activeTotalCompleted / totalTasks) * 100) || 0 : progressPercentage;
  const activePendingHomeworkCount = activeHomework.filter(h => h.status === 'pending' || (h.status === 'overdue' && new Date() > new Date(h.due_date))).length;
  
  const viewingStudent = viewingStudentId ? trackedStudentsWithStatus.find(s => s.id === viewingStudentId) : null;

  const getCategoryStats = (stories: Story[]) => {
      const total = stories.length;
      const completed = stories.filter(s => activeCompletedStories.has(s.title)).length;
      return { completed, total };
  };

  const renderExerciseList = (stories: Story[], type: ExerciseType) => {
    const list = (
      <ExerciseList 
        stories={stories} 
        type={type} 
        completedStories={activeCompletedStories} 
        onStartExercise={startExercise} 
        onGoHome={goHome} 
        readOnly={!!viewingStudentId}
      />
    );

    if (viewingStudentId) {
      return (
        <TeacherLayout
            students={trackedStudentsWithStatus}
            selectedStudentId={viewingStudentId}
            onSelectStudent={setViewingStudentId}
            onAddStudent={handleAddStudent}
        >
            {list}
        </TeacherLayout>
      );
    }
    return list;
  };

  return (
    <Routes>
      <Route path="/auth" element={
        userProfile.id ? <Navigate to="/" /> : (
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome Back</h1>
              <p className="text-slate-500">Sign in to continue your progress</p>
            </div>
            
            {authError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-rose-100">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authError}
              </div>
            )}
            {authSuccessMsg && (
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-emerald-100">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authSuccessMsg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-5">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                </div>
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2V-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                {isLoginMode ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-8 text-center space-y-3">
              <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
                {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </button>
              <div className="block">
                <button onClick={() => navigate('/forgot-password')} className="text-indigo-500 hover:text-indigo-700 text-xs font-bold transition-colors">
                  Forgot Password?
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      } />

      <Route path="/forgot-password" element={
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Reset Password</h1>
              <p className="text-slate-500">Enter your email to receive a reset link</p>
            </div>
            
            {authError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-rose-100">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authError}
              </div>
            )}
            {authSuccessMsg && (
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-emerald-100">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authSuccessMsg}
              </div>
            )}

            <form onSubmit={handlePasswordResetSubmit} className="space-y-5">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                </div>
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Send Reset Link
              </button>
            </form>

            <div className="mt-8 text-center space-y-3">
              <button onClick={() => navigate('/auth')} className="text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      } />

      <Route path="/role-selection" element={
          <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
              <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-lg border border-slate-100 text-center">
                  <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Choose your role</h2>
                  <p className="text-slate-500 mb-10">How will you use this platform?</p>
                  
                  <div className="grid grid-cols-2 gap-6">
                      <button 
                          onClick={() => handleRoleSelectionSubmit('student')}
                          className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group flex flex-col items-center gap-4"
                      >
                          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                          </div>
                          <span className="font-bold text-slate-700 group-hover:text-indigo-700">Student</span>
                      </button>

                      <button 
                          onClick={() => handleRoleSelectionSubmit('teacher')}
                          className="p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group flex flex-col items-center gap-4"
                      >
                          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                          </div>
                          <span className="font-bold text-slate-700 group-hover:text-emerald-700">Teacher</span>
                      </button>
                  </div>
              </div>
          </div>
      } />

      <Route path="/settings" element={
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-lg border border-slate-100">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
                <button onClick={goHome} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            <form onSubmit={handleSettingsSave} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Full Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                />
              </div>
              
              {userProfile.role === 'student' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Teacher's Email (for reports)</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium"
                      value={userProfile.teacherEmail}
                      onChange={(e) => setUserProfile({...userProfile, teacherEmail: e.target.value})}
                    />
                  </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Change Password</label>
                  <input 
                    type="password" 
                    placeholder="New Password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
              </div>

              <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleLogoutSubmit}
                    className="px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors"
                  >
                    Log Out
                  </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <button onClick={handleRoleSwitchSubmit} className="text-xs font-bold text-slate-400 hover:text-indigo-600 underline transition-colors">
                    Switch Role (Debug)
                </button>
            </div>
          </div>
        </div>
      } />

      <Route path="/" element={
        !userProfile.id ? <Navigate to="/auth" /> :
        !userProfile.role ? <Navigate to="/role-selection" /> :
        (
          <>
            {userProfile.role === 'student' ? (
              <div className="max-w-7xl mx-auto px-4 py-8 w-full">
                {!joinedSessionCode && (
                  <div className="mb-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 max-w-3xl mx-auto">
                    <div>
                      <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                        <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                        Join Live Classroom
                      </h3>
                      <p className="text-purple-100 text-sm">Enter the session code from your teacher to join.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <input 
                        type="text"
                        placeholder="CODE (e.g. ABC123)"
                        className="flex-1 md:w-40 px-4 py-3 rounded-xl text-slate-900 font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-white/50"
                        value={joinSessionInput}
                        onChange={(e) => setJoinSessionInput(e.target.value.toUpperCase())}
                      />
                      <button 
                        onClick={() => joinLiveSession(joinSessionInput)}
                        disabled={loading || !joinSessionInput}
                        className="bg-white text-purple-600 px-6 py-3 rounded-xl font-bold hover:bg-purple-50 transition-all disabled:opacity-50"
                      >
                        {loading ? '...' : 'Join'}
                      </button>
                    </div>
                  </div>
                )}
                
                {joinedSessionCode && (
                   <div className="mb-8 bg-indigo-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between max-w-3xl mx-auto animate-fade-in">
                       <div className="flex items-center gap-3">
                           <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                           <span className="font-bold">Live Session Active: {joinedSessionCode}</span>
                       </div>
                       <div className="text-xs opacity-75">Waiting for teacher instructions...</div>
                   </div>
                )}

                <StudentDashboard 
                    userProfile={userProfile}
                    stats={{
                        progressPercentage: activeProgressPercentage,
                        totalCompleted: activeTotalCompleted,
                        totalTasks: totalTasks
                    }}
                    homework={{
                        pendingCount: activePendingHomeworkCount
                    }}
                    onNavigate={{
                        toHomework: () => navigate('/homework'),
                        toCategory: (type) => navigate(`/exercise/${type}`)
                    }}
                />
              </div>
            ) : (
                <TeacherLayout
                    students={trackedStudentsWithStatus}
                    selectedStudentId={viewingStudentId}
                    onSelectStudent={setViewingStudentId}
                    onAddStudent={handleAddStudent}
                >
                    {viewingStudentId ? (
                        <StudentDashboard 
                            userProfile={viewingStudent || userProfile}
                            stats={{
                                progressPercentage: activeProgressPercentage,
                                totalCompleted: activeTotalCompleted,
                                totalTasks: totalTasks
                            }}
                            homework={{
                                pendingCount: activePendingHomeworkCount
                            }}
                            onNavigate={{
                                toHomework: () => navigate('/homework'),
                                toCategory: (type) => navigate(`/exercise/${type}`)
                            }}
                            readOnly={true}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            <p className="text-lg font-medium">Select a student to view their dashboard</p>
                        </div>
                    )}
                </TeacherLayout>
            )}

          </>
        )
      } />

      <Route path="/homework" element={
          viewingStudentId ? (
            <TeacherLayout
                students={trackedStudentsWithStatus}
                selectedStudentId={viewingStudentId}
                onSelectStudent={setViewingStudentId}
                onAddStudent={handleAddStudent}
            >
                <StudentHomeworkView 
                    assignments={activeHomework}
                    onStartExercise={(story, type) => startExercise(story, type, 'HOMEWORK')}
                    onBack={goHome}
                    onRefresh={() => viewingStudentId && loadHomework(viewingStudentId)}
                    loading={homeworkLoading}
                    readOnly={true}
                />
            </TeacherLayout>
          ) : (
            <StudentHomeworkView 
                assignments={activeHomework}
                onStartExercise={(story, type) => startExercise(story, type, 'HOMEWORK')}
                onBack={goHome}
                onRefresh={() => userProfile.id && loadHomework(userProfile.id)}
                loading={homeworkLoading}
            />
          )
      } />

      <Route path="/exercise/grammar" element={renderExerciseList(grammarStories, ExerciseType.GRAMMAR)} />
      <Route path="/exercise/vocabulary" element={renderExerciseList(vocabStories, ExerciseType.VOCABULARY)} />
      <Route path="/exercise/reading" element={renderExerciseList(allReadingStories, ExerciseType.READING)} />
      <Route path="/exercise/listening" element={renderExerciseList(listeningStories, ExerciseType.LISTENING)} />
      <Route path="/exercise/speaking" element={renderExerciseList(speakingStories, ExerciseType.SPEAKING)} />
      <Route path="/exercise/oral" element={renderExerciseList(allOralStories, ExerciseType.ORAL_SPEECH)} />
      <Route path="/exercise/writing" element={renderExerciseList(writingStories, ExerciseType.WRITING)} />

      <Route path="/exercise/:type/:title" element={<ExerciseRouteWrapper {...props} />} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};
