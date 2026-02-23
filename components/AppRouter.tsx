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
import TeacherDashboard from './TeacherDashboard';
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

  return (
    <ExerciseView 
      story={story} 
      type={exerciseType}
      onBack={() => {
        if (source === 'HOMEWORK') navigate('/homework');
        else navigate(`/exercise/${type}`);
      }}
      onComplete={(score, maxScore, details) => props.handleStoryComplete(story.title, exerciseType, score, maxScore, details)}
      userProfile={props.userProfile}
    />
  );
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
    totalTasks
  } = props;

  const getCategoryStats = (stories: Story[]) => {
      const total = stories.length;
      const completed = stories.filter(s => completedStories.has(s.title)).length;
      return { completed, total };
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
            {userProfile.role === 'student' && (
              <div className="max-w-7xl mx-auto px-4 py-8 w-full">
                <div className="mb-12 text-center">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                    Hello, {userProfile.name || 'Student'}!
                  </h1>
                  <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    Ready to master your English skills? Choose a category below or check your homework.
                  </p>
                </div>

                {userProfile.role === 'student' && !joinedSessionCode && (
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

                <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-xl border border-slate-100 mb-12 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * progressPercentage) / 100} className="text-indigo-600 transition-all duration-1000 ease-out" />
                            </svg>
                            <span className="absolute text-xl font-bold text-slate-800">{progressPercentage}%</span>
                        </div>
                        <div>
                            <div className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Total Progress</div>
                            <div className="text-2xl font-extrabold text-slate-900">{totalCompleted} / {totalTasks} Tasks</div>
                        </div>
                    </div>
                    
                    <div 
                      onClick={() => navigate('/homework')}
                      className="flex items-center gap-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    >
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div>
                            <div className="font-bold text-lg">Homework</div>
                            <div className="text-indigo-100 text-sm">{pendingHomeworkCount} tasks pending</div>
                        </div>
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <CategoryCard 
                      title="Grammar" 
                      subtitle="Tenses & Forms" 
                      stats={getCategoryStats(grammarStories)}
                      onClick={() => navigate('/exercise/grammar')}
                      colorClass="text-indigo-600 bg-indigo-50"
                      delay={0}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>}
                  />
                  <CategoryCard 
                      title="Vocabulary" 
                      subtitle="Word Formation" 
                      stats={getCategoryStats(vocabStories)}
                      onClick={() => navigate('/exercise/vocabulary')}
                      colorClass="text-teal-600 bg-teal-50"
                      delay={100}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.638 1.638 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.638 1.638 0 00-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0c.31 0 .555-.26.532-.57a48.039 48.039 0 01-.642-5.056c-1.518-.19-3.057-.309-4.616-.354a.64.64 0 00-.657.643v0z" /></svg>}
                  />
                  <CategoryCard 
                      title="Reading" 
                      subtitle="Comprehension" 
                      stats={getCategoryStats(allReadingStories)}
                      onClick={() => navigate('/exercise/reading')}
                      colorClass="text-amber-600 bg-amber-50"
                      delay={200}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
                  />
                  <CategoryCard 
                      title="Listening" 
                      subtitle="Audio Tasks" 
                      stats={getCategoryStats(listeningStories)}
                      onClick={() => navigate('/exercise/listening')}
                      colorClass="text-cyan-600 bg-cyan-50"
                      delay={250}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>}
                  />
                  <CategoryCard 
                      title="Read Aloud" 
                      subtitle="Phonetics" 
                      stats={getCategoryStats(speakingStories)}
                      onClick={() => navigate('/exercise/speaking')}
                      colorClass="text-rose-600 bg-rose-50"
                      delay={300}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>}
                  />
                  <CategoryCard 
                      title="Speaking" 
                      subtitle="Monologue" 
                      stats={getCategoryStats(allOralStories)}
                      onClick={() => navigate('/exercise/oral')}
                      colorClass="text-purple-600 bg-purple-50"
                      delay={400}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>}
                  />
                  <CategoryCard 
                      title="Writing" 
                      subtitle="Email Task" 
                      stats={getCategoryStats(writingStories)}
                      onClick={() => navigate('/exercise/writing')}
                      colorClass="text-blue-600 bg-blue-50"
                      delay={500}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>}
                  />
                </div>
              </div>
            )}
            {userProfile.role === 'teacher' && !selectedStudentForAssignment && (
                <TeacherDashboard 
                    userProfile={userProfile}
                    trackedStudents={trackedStudentsWithStatus}
                    onAddStudent={handleAddStudent}
                    onRemoveStudent={handleRemoveStudent}
                    liveStudents={liveStudents}
                    onlineUsers={onlineUsers}
                    onStartLiveSession={startLiveSession}
                    onEndLiveSession={endLiveSession}
                    onPushExercise={pushExerciseToStudents}
                    liveSessionActive={liveSessionActive}
                    liveSessionCode={liveSessionCode}
                    sessionParticipants={sessionParticipants}
                    loading={loading}
                    onAssignHomework={handleAssignHomework}
                />
            )}
          </>
        )
      } />

      <Route path="/homework" element={
          <StudentHomeworkView 
              assignments={myHomework}
              onStartExercise={(story, type) => startExercise(story, type, 'HOMEWORK')}
              onBack={goHome}
              onRefresh={() => userProfile.id && loadHomework(userProfile.id)}
              loading={homeworkLoading}
          />
      } />

      <Route path="/exercise/grammar" element={<ExerciseList stories={grammarStories} type={ExerciseType.GRAMMAR} completedStories={completedStories} onStartExercise={startExercise} onGoHome={goHome} />} />
      <Route path="/exercise/vocabulary" element={<ExerciseList stories={vocabStories} type={ExerciseType.VOCABULARY} completedStories={completedStories} onStartExercise={startExercise} onGoHome={goHome} />} />
      <Route path="/exercise/reading" element={<ExerciseList stories={allReadingStories} type={ExerciseType.READING} completedStories={completedStories} onStartExercise={startExercise} onGoHome={goHome} />} />
      <Route path="/exercise/listening" element={<ExerciseList stories={listeningStories} type={ExerciseType.LISTENING} completedStories={completedStories} onStartExercise={startExercise} onGoHome={goHome} />} />
      <Route path="/exercise/speaking" element={<ExerciseList stories={speakingStories} type={ExerciseType.SPEAKING} completedStories={completedStories} onStartExercise={startExercise} onGoHome={goHome} />} />
      <Route path="/exercise/oral" element={<ExerciseList stories={allOralStories} type={ExerciseType.ORAL_SPEECH} completedStories={completedStories} onStartExercise={startExercise} onGoHome={goHome} />} />
      <Route path="/exercise/writing" element={<ExerciseList stories={writingStories} type={ExerciseType.WRITING} completedStories={completedStories} onStartExercise={startExercise} onGoHome={goHome} />} />

      <Route path="/exercise/:type/:title" element={<ExerciseRouteWrapper {...props} />} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};
