
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Story, ExerciseType, AttemptDetail, UserProfile, UserRole, HomeworkAssignment, StudentResult } from './types';
import ExerciseCard from './components/ExerciseCard';
import ExerciseView from './components/ExerciseView';
import StudentHomeworkView from './components/StudentHomeworkView';
import HomeworkModal from './components/HomeworkModal';

import { grammarStories } from './data/grammar';
import { vocabStories } from './data/vocabulary';
import { readingStories } from './data/reading';
import { readingTrueFalseStories } from './data/readingTrueFalse';
import { speakingStories } from './data/speaking';
import { oralStories } from './data/oral';
import { monologueStories } from './data/monologue';
import { writingStories } from './data/writing';
import { listeningStories } from './data/listening';

const allReadingStories = [...readingStories, ...readingTrueFalseStories];
const allOralStories = [...oralStories, ...monologueStories];

enum ViewState {
  REGISTRATION,
  FORGOT_PASSWORD,
  ROLE_SELECTION,
  HOME,
  SETTINGS,
  GRAMMAR_LIST,
  VOCAB_LIST,
  READING_LIST,
  LISTENING_LIST,
  SPEAKING_LIST,
  ORAL_LIST,
  WRITING_LIST,
  EXERCISE,
  HOMEWORK_LIST,
  TEACHER_DASHBOARD, 
}

interface TrackedStudent {
    id: string;
    email: string;
    name: string;
    completedCount: number;
    totalTasks: number;
    pendingHomeworkCount?: number;
}

// Improved Error Handling
const getErrorMessage = (error: any) => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
      // Try to find a message property in common API error formats
      if (error.message) return error.message;
      if (error.error_description) return error.error_description;
      return JSON.stringify(error);
  }
  return String(error);
};

function App() {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewState>(ViewState.REGISTRATION);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', email: '', teacherEmail: '' });
  const [completedStories, setCompletedStories] = useState<Set<string>>(new Set());
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedType, setSelectedType] = useState<ExerciseType>(ExerciseType.GRAMMAR);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState(''); 
  const [fullName, setFullName] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Homework & Teacher state
  const [myHomework, setMyHomework] = useState<HomeworkAssignment[]>([]);
  
  // Teacher Dashboard State
  const [trackedStudents, setTrackedStudents] = useState<TrackedStudent[]>([]);
  const [studentEmailInput, setStudentEmailInput] = useState('');
  const [studentAddError, setStudentAddError] = useState<string | null>(null);
  const [selectedStudentForView, setSelectedStudentForView] = useState<TrackedStudent | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [resultDetail, setResultDetail] = useState<StudentResult | null>(null);
  const [studentHomework, setStudentHomework] = useState<HomeworkAssignment[]>([]);
  const [dashboardTab, setDashboardTab] = useState<'HISTORY' | 'HOMEWORK'>('HISTORY');
  
  // Homework Modal (Legacy / Quick assign specific)
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);
  const [studentToAssign, setStudentToAssign] = useState<TrackedStudent | null>(null);
  const [quickAssignTask, setQuickAssignTask] = useState<{title: string, type: ExerciseType} | undefined>(undefined);

  const totalTasks = grammarStories.length + vocabStories.length + allReadingStories.length + listeningStories.length + speakingStories.length + allOralStories.length + writingStories.length;

  useEffect(() => {
    checkSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session) {
           await loadUserProfile(session.user.id, session.user.email!);
           setView(ViewState.SETTINGS); 
           setAuthSuccessMsg("Please set a new password below.");
        }
      }
      
      // Reload profile on sign in
      if (event === 'SIGNED_IN' && session) {
          await loadUserProfile(session.user.id, session.user.email!);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Realtime subscription for Students
  useEffect(() => {
    if (userProfile.role === 'student' && userProfile.id) {
        const channel = supabase
            .channel('public:homework_assignments')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'homework_assignments', filter: `student_id=eq.${userProfile.id}` }, 
                (payload) => {
                    // console.log('Change received!', payload);
                    loadHomework(userProfile.id!); // Refresh homework on any change
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [userProfile.role, userProfile.id]);

  useEffect(() => {
      if (userProfile.role === 'teacher') {
          const saved = localStorage.getItem('tracked_students');
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  refreshStudentStats(parsed);
              } catch (e) {
                  console.error("Failed to parse saved students");
              }
          }
      }
  }, [userProfile.role]);
  
  // Refresh teacher dashboard view when re-entering it
  useEffect(() => {
      if (view === ViewState.TEACHER_DASHBOARD && selectedStudentForView) {
          handleSelectStudentForView(selectedStudentForView);
      }
  }, [view]);

  const checkSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserProfile(session.user.id, session.user.email!);
    } else {
      setView(ViewState.REGISTRATION);
    }
    setLoading(false);
  };

  const loadUserProfile = async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
         console.error('Error loading profile:', error);
      }

      if (data) {
        setUserProfile({
          id: data.id,
          name: data.full_name || '',
          email: userEmail,
          teacherEmail: data.teacher_email || '',
          role: data.role as UserRole,
          completed_stories: data.completed_stories || []
        });
        setCompletedStories(new Set(data.completed_stories || []));
        
        if (!data.role) {
            setView(ViewState.ROLE_SELECTION);
        } else {
            if (view === ViewState.REGISTRATION || view === ViewState.ROLE_SELECTION || view === ViewState.FORGOT_PASSWORD) {
                setView(ViewState.HOME);
            }
            if (data.role === 'student') {
                loadHomework(userId);
            }
        }
      } else {
        setUserProfile({ id: userId, name: '', email: userEmail, teacherEmail: '' });
        setView(ViewState.ROLE_SELECTION);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadHomework = async (studentId: string) => {
      const { data } = await supabase
          .from('homework_assignments')
          .select('*')
          .eq('student_id', studentId);
      
      if (data) {
          setMyHomework(data as HomeworkAssignment[]);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      if (isLoginMode) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Explicitly load profile to ensure view updates before loading stops
        if (data.session) {
            await loadUserProfile(data.session.user.id, data.session.user.email!);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{ id: data.user.id, full_name: fullName, email: email }]);
            
            if (profileError) console.error("Profile creation error:", profileError);

            setAuthSuccessMsg("Registration successful! Please check your email to confirm your account, then sign in.");
            setIsLoginMode(true);
        }
      }
    } catch (error: any) {
      setAuthError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      
      if (error) throw error;
      setAuthSuccessMsg("Password reset link has been sent to your email. Check your spam folder.");
    } catch (error: any) {
      setAuthError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelection = async (role: UserRole) => {
      setLoading(true);
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("No user found");

          const { error } = await supabase
              .from('profiles')
              .upsert({ 
                  id: user.id, 
                  role: role,
                  email: user.email 
              }, { onConflict: 'id' });

          if (error) throw error;

          setUserProfile((prev: UserProfile) => ({ ...prev, id: user.id, role }));
          setView(ViewState.HOME);
      } catch (err: any) {
          setAuthError(getErrorMessage(err));
      } finally {
          setLoading(false);
      }
  };

  // --- Homework & Student Tracking Logic (Teacher) ---

  const refreshStudentStats = async (students: TrackedStudent[]) => {
      const updatedList: TrackedStudent[] = [];
      for (const st of students) {
          const freshData = await fetchStudentData(st.email);
          if (freshData) updatedList.push(freshData);
          else updatedList.push(st); 
      }
      setTrackedStudents(updatedList);
      localStorage.setItem('tracked_students', JSON.stringify(updatedList));
  };

  const fetchStudentData = async (email: string): Promise<TrackedStudent | null> => {
      try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, full_name, completed_stories')
            .eq('email', email)
            .single();
          
          if (error || !profile) return null;

          const { count } = await supabase
            .from('homework_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', profile.id)
            .eq('status', 'pending');

          const completed = Array.isArray(profile.completed_stories) ? profile.completed_stories.length : 0;
          return {
              id: profile.id,
              email: email,
              name: profile.full_name || email.split('@')[0],
              completedCount: completed,
              totalTasks: totalTasks,
              pendingHomeworkCount: count || 0
          };
      } catch (e) {
          console.error("Error fetching student:", e);
          return null;
      }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
      e.preventDefault();
      setStudentAddError(null);
      if (!studentEmailInput) return;

      const emailToAdd = studentEmailInput.trim().toLowerCase();

      if (trackedStudents.find(s => s.email.toLowerCase() === emailToAdd)) {
          setStudentAddError("Student already in your list.");
          return;
      }

      if (emailToAdd === userProfile.email?.toLowerCase()) {
          setStudentAddError("You cannot add yourself.");
          return;
      }

      setLoading(true);
      const studentData = await fetchStudentData(emailToAdd);
      setLoading(false);

      if (studentData) {
          const newList = [...trackedStudents, studentData];
          setTrackedStudents(newList);
          localStorage.setItem('tracked_students', JSON.stringify(newList));
          setStudentEmailInput('');
      } else {
          setStudentAddError("Student not found or email not accessible.");
      }
  };

  const handleRemoveStudent = (emailToRemove: string) => {
      const newList = trackedStudents.filter(s => s.email !== emailToRemove);
      setTrackedStudents(newList);
      localStorage.setItem('tracked_students', JSON.stringify(newList));
      if (selectedStudentForView?.email === emailToRemove) {
          setSelectedStudentForView(null);
          setStudentResults([]);
      }
  };

  const handleSelectStudentForView = async (student: TrackedStudent) => {
      setSelectedStudentForView(student);
      setResultDetail(null);
      // setDashboardTab('HISTORY'); // Keep tab if refreshing
      // setLoading(true); // Don't block UI if refreshing in bg
      
      try {
          const { data: results, error: resError } = await supabase
            .from('student_results')
            .select('*')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false });
          
          if (!resError && results) {
              setStudentResults(results as StudentResult[]);
          }

          await fetchStudentHomework(student.id);

      } catch (err) {
          console.error("Failed to load student data", err);
      } finally {
          // setLoading(false);
      }
  };

  const fetchStudentHomework = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('homework_assignments')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudentHomework(data as HomeworkAssignment[]);
    } catch (err) {
      console.error("Error fetching student homework", err);
    }
  };

  const openAssignHomeworkModal = (student: TrackedStudent | null) => {
    setStudentToAssign(student);
    setQuickAssignTask(undefined);
    setIsHomeworkModalOpen(true);
  };

  // Instant Assign Function
  const assignTaskImmediately = async (storyTitle: string, exerciseType: ExerciseType) => {
      if (!selectedStudentForView) {
          alert("Please select a student from the Dashboard first.");
          return;
      }
      if (!userProfile.id) return;

      // Default due date: 7 days from now
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 7);

      const { error } = await supabase
        .from('homework_assignments')
        .insert({
            teacher_id: userProfile.id,
            student_id: selectedStudentForView.id,
            exercise_title: storyTitle,
            exercise_type: exerciseType,
            due_date: defaultDueDate.toISOString(),
            status: 'pending',
            instructions: 'Please complete this task.'
        });

      if (error) {
          console.error("Assign error", error);
          alert("Failed to assign: " + getErrorMessage(error));
      } else {
          // Refresh background data if needed, though immediate UI update happens in ExerciseCard
          // We can refresh the student stats in background
          refreshStudentStats(trackedStudents);
      }
  };

  // Assign via Modal
  const handleAssignHomework = async (studentId: string, exercises: { title: string; type: ExerciseType }[], dueDate: string, instructions: string) => {
    const targetStudentId = studentId;
    
    if (!targetStudentId || !userProfile.id) return;
    setLoading(true);

    try {
      const assignments = exercises.map(ex => ({
        teacher_id: userProfile.id,
        student_id: targetStudentId,
        exercise_title: ex.title,
        exercise_type: ex.type,
        due_date: new Date(dueDate).toISOString(),
        status: 'pending',
        instructions: instructions
      }));

      const { error } = await supabase
        .from('homework_assignments')
        .insert(assignments);

      if (error) throw error;

      await fetchStudentHomework(targetStudentId);
      refreshStudentStats(trackedStudents); 
      
      alert('Homework assigned successfully!');
      setIsHomeworkModalOpen(false); 
    } catch (err: any) {
      alert('Failed to assign homework: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // --- Student Logic ---

  const checkForHomeworkCompletion = async (title: string, type: ExerciseType, score: number, maxScore: number) => {
      const assignment = myHomework.find(h => 
          h.exercise_title === title && 
          h.exercise_type === type && 
          h.status !== 'completed'
      );

      if (assignment) {
          try {
              const { error } = await supabase
                  .from('homework_assignments')
                  .update({ 
                      status: 'completed',
                      completed_at: new Date().toISOString(),
                      score: score,
                      max_score: maxScore
                  })
                  .eq('id', assignment.id);
              
              if (!error) {
                  // Local update
                  setMyHomework(prev => prev.map(h => 
                      h.id === assignment.id 
                          ? { ...h, status: 'completed', score, maxScore, completed_at: new Date().toISOString() } 
                          : h
                  ));
              }
          } catch (e) {
              console.error("Error updating homework status", e);
          }
      }
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 1. Update Profile Data
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: userProfile.name,
            teacher_email: userProfile.teacherEmail,
            role: userProfile.role 
          }, { onConflict: 'id' });

        if (error) throw error;

        // 2. Update Password if provided
        if (newPassword) {
            const { error: pwdError } = await supabase.auth.updateUser({
                password: newPassword
            });
            if (pwdError) throw pwdError;
            setNewPassword(''); // Clear after success
            alert('Settings and Password updated successfully!');
        } else {
            alert('Settings saved!');
        }
      }
    } catch (error: any) {
      console.error('Failed to save settings remotely: ' + getErrorMessage(error));
      alert('Failed to save settings: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSwitch = async () => {
      if (!userProfile.id) {
          console.error("User ID missing, cannot switch role");
          alert("Please sign in again to switch roles.");
          return;
      }
      
      const currentRole = userProfile.role || 'student';
      const newRole: UserRole = currentRole === 'student' ? 'teacher' : 'student';
      
      if (!window.confirm(`Are you sure you want to switch to ${newRole} mode?`)) {
          return;
      }

      setLoading(true);
      try {
          const { error } = await supabase
          .from('profiles')
          .upsert({ 
              id: userProfile.id,
              role: newRole,
              email: userProfile.email 
           }, { onConflict: 'id' });

          if (error) throw error;
          
          setUserProfile((prev: UserProfile) => ({ ...prev, role: newRole }));
          
          // Redirect to HOME 
          setView(ViewState.HOME); 
      } catch (err: any) {
          console.error("Error switching role:", getErrorMessage(err));
          alert("Failed to switch role. Please try again.");
      } finally {
          setLoading(false);
      }
  };

  const handleStoryComplete = async (title: string, score: number, maxScore: number, details: AttemptDetail[]) => {
    const newSet = new Set(completedStories);
    newSet.add(title);
    setCompletedStories(newSet);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            completed_stories: Array.from(newSet)
          }, { onConflict: 'id' });

        if (selectedStory) {
            await supabase
                .from('student_results')
                .insert({
                    student_id: user.id,
                    exercise_title: title,
                    exercise_type: selectedType,
                    score: score,
                    max_score: maxScore,
                    details: details
                });
            
            await checkForHomeworkCompletion(title, selectedType, score, maxScore);
        }
      }
    } catch (error) {
      console.error('Failed to save progress', error);
    }
  };

  // --- Navigation & View Logic ---

  const startExercise = (story: Story, type: ExerciseType) => {
    setSelectedStory(story);
    setSelectedType(type);
    setView(ViewState.EXERCISE);
  };

  const goHome = () => {
    setView(ViewState.HOME);
    setSelectedStory(null);
  };

  const getBackView = () => {
    switch (selectedType) {
      case ExerciseType.GRAMMAR: return ViewState.GRAMMAR_LIST;
      case ExerciseType.VOCABULARY: return ViewState.VOCAB_LIST;
      case ExerciseType.READING: return ViewState.READING_LIST;
      case ExerciseType.LISTENING: return ViewState.LISTENING_LIST;
      case ExerciseType.SPEAKING: return ViewState.SPEAKING_LIST;
      case ExerciseType.ORAL_SPEECH: return ViewState.ORAL_LIST;
      case ExerciseType.WRITING: return ViewState.WRITING_LIST;
      default: return ViewState.HOME;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView(ViewState.REGISTRATION);
    setCompletedStories(new Set());
    setUserProfile({ name: '', email: '', teacherEmail: '' });
    setTrackedStudents([]);
    setEmail('');
    setPassword('');
    setFullName('');
    setAuthSuccessMsg(null);
  };

  // Stats for the hero section
  const totalCompleted = completedStories.size;
  const progressPercentage = Math.round((totalCompleted / totalTasks) * 100) || 0;
  const pendingHomeworkCount = myHomework.filter(h => h.status === 'pending' || (h.status === 'overdue' && new Date() > new Date(h.due_date))).length;

  const CategoryCard = ({ title, subtitle, count, onClick, colorClass, icon, delay, badge }: any) => {
    let iconBgColor = 'bg-gray-100 text-gray-600';
    if (colorClass.includes('indigo')) iconBgColor = 'bg-indigo-100 text-indigo-600';
    if (colorClass.includes('teal')) iconBgColor = 'bg-teal-100 text-teal-600';
    if (colorClass.includes('amber')) iconBgColor = 'bg-amber-100 text-amber-600';
    if (colorClass.includes('rose')) iconBgColor = 'bg-rose-100 text-rose-600';
    if (colorClass.includes('purple')) iconBgColor = 'bg-purple-100 text-purple-600';
    if (colorClass.includes('blue')) iconBgColor = 'bg-blue-100 text-blue-600';
    if (colorClass.includes('cyan')) iconBgColor = 'bg-cyan-100 text-cyan-600';
    if (colorClass.includes('orange')) iconBgColor = 'bg-orange-100 text-orange-600';

    return (
      <div 
        onClick={onClick}
        className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-slate-100 flex flex-col items-start gap-4 h-full group relative"
        style={{ animationDelay: `${delay}ms` }}
      >
        {badge && (
          <div className="absolute top-4 right-4 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
            {badge}
          </div>
        )}
        <div className={`p-4 rounded-2xl ${iconBgColor} transition-transform group-hover:scale-110`}>
            {icon}
        </div>
        
        <div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight">{title}</h3>
            <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
    );
  };

  const renderRegistration = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-slate-500 mb-8">{isLoginMode ? 'Sign in to continue learning.' : 'Start your learning journey today.'}</p>
        
        {authError && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold">{authError}</div>}
        {authSuccessMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold">{authSuccessMsg}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLoginMode && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
              <input type="text" required className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all font-medium" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
            <input type="email" required className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all font-medium" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
            <input type="password" required minLength={6} className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all font-medium" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-70">
            {loading ? 'Processing...' : (isLoginMode ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 font-medium">
          {isLoginMode ? (
            <>
              Don't have an account? <button onClick={() => { setIsLoginMode(false); setAuthError(null); }} className="text-indigo-600 font-bold hover:underline">Sign Up</button>
              <div className="mt-2"><button onClick={() => setView(ViewState.FORGOT_PASSWORD)} className="text-slate-400 hover:text-slate-600">Forgot Password?</button></div>
            </>
          ) : (
            <>
              Already have an account? <button onClick={() => { setIsLoginMode(true); setAuthError(null); }} className="text-indigo-600 font-bold hover:underline">Sign In</button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderForgotPassword = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset Password</h2>
        <p className="text-slate-500 mb-6 text-sm">Enter your email to receive a reset link.</p>
        
        {authError && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold">{authError}</div>}
        {authSuccessMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold">{authSuccessMsg}</div>}

        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
            <input type="email" required className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all font-medium" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-70">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <button onClick={() => setView(ViewState.REGISTRATION)} className="mt-6 w-full text-center text-sm font-bold text-slate-400 hover:text-slate-600">Back to Login</button>
      </div>
    </div>
  );

  const renderRoleSelection = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-lg border border-slate-100 text-center">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Who are you?</h2>
        <p className="text-slate-500 mb-10">Select your role to get started.</p>
        
        <div className="grid grid-cols-2 gap-6">
            <button onClick={() => handleRoleSelection('student')} disabled={loading} className="group p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🎓</div>
                <div className="font-bold text-slate-700 group-hover:text-indigo-700">Student</div>
            </button>
            <button onClick={() => handleRoleSelection('teacher')} disabled={loading} className="group p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">👨‍🏫</div>
                <div className="font-bold text-slate-700 group-hover:text-emerald-700">Teacher</div>
            </button>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10">
      <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100">
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900">Settings</h2>
            <button onClick={goHome} className="text-slate-400 hover:text-slate-600 font-bold text-sm">Close</button>
        </div>

        {authSuccessMsg && <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl font-bold border border-emerald-100">{authSuccessMsg}</div>}

        <form onSubmit={handleSettingsSave} className="space-y-6">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Name</label>
                <input type="text" required className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} />
            </div>
            
            {userProfile.role === 'student' && (
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Teacher's Email (for homework)</label>
                    <input type="email" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" value={userProfile.teacherEmail} onChange={e => setUserProfile({...userProfile, teacherEmail: e.target.value})} placeholder="teacher@example.com" />
                </div>
            )}

            <div className="pt-6 border-t border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4">Change Password</h3>
                <input type="password" placeholder="New Password (leave empty to keep current)" minLength={6} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>

            <div className="flex items-center justify-between pt-6">
                <div className="flex gap-4">
                    <button type="button" onClick={handleLogout} className="px-6 py-3 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors">Sign Out</button>
                    <button type="button" onClick={handleRoleSwitch} className="px-6 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors" title={`Switch to ${userProfile.role === 'student' ? 'Teacher' : 'Student'} view`}>Switch Role</button>
                </div>
                <button type="submit" disabled={loading} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70">
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
        
        {userProfile.role === 'teacher' && (
             <div className="mt-8 pt-8 border-t border-slate-100">
                 <button onClick={() => setView(ViewState.TEACHER_DASHBOARD)} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all">Go to Teacher Dashboard</button>
             </div>
        )}
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="min-h-screen relative" style={{
        backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(to right, #e2e8f0 1px, transparent 1px)',
        backgroundSize: '24px 24px'
    }}>
      {/* Settings Button */}
      <div className="absolute top-6 right-6 z-10">
         <button 
            onClick={() => setView(ViewState.SETTINGS)}
            className="p-3 bg-white/80 hover:bg-white rounded-full shadow-sm backdrop-blur-sm border border-slate-200 transition-all text-slate-500 hover:text-indigo-600"
            title="Settings"
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
                Подготовка к <span className="text-indigo-600">ОГЭ</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 leading-relaxed mb-8">
                Улучшайте грамматику, словарный запас и произношение.
            </p>

            <div className="inline-flex items-center gap-6 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-full px-6 py-2.5 shadow-sm text-sm text-slate-500 font-medium">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>Completed: <span className="text-slate-900">{totalCompleted}</span></span>
                </div>
                <div className="w-px h-3 bg-slate-300"></div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Progress: <span className="text-slate-900">{progressPercentage}%</span></span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CategoryCard 
                title="Домашнее задание"
                subtitle="Tasks assigned by teacher."
                count={pendingHomeworkCount}
                colorClass="orange"
                delay={0}
                badge={pendingHomeworkCount > 0 ? `${pendingHomeworkCount}` : null}
                onClick={() => setView(ViewState.HOMEWORK_LIST)}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
            />
            {/* Other categories ... */}
            <CategoryCard 
                title="Аудирование"
                subtitle="Понимание на слух."
                count={listeningStories.length}
                colorClass="cyan"
                delay={50}
                onClick={() => setView(ViewState.LISTENING_LIST)}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
            />
            <CategoryCard 
                title="Грамматическая сторона речи"
                subtitle="Времена и формы глаголов."
                count={grammarStories.length}
                colorClass="indigo"
                delay={100}
                onClick={() => setView(ViewState.GRAMMAR_LIST)}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
            />
            <CategoryCard 
                title="Лексическая сторона речи"
                subtitle="Словообразование."
                count={vocabStories.length}
                colorClass="teal"
                delay={200}
                onClick={() => setView(ViewState.VOCAB_LIST)}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>}
            />
            <CategoryCard 
                title="Смысловое чтение"
                subtitle="Понимание текстов."
                count={allReadingStories.length}
                colorClass="amber"
                delay={300}
                onClick={() => setView(ViewState.READING_LIST)}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
            />
            <CategoryCard 
                title="Фонетическая сторона речи"
                subtitle="Чтение вслух."
                count={speakingStories.length}
                colorClass="rose"
                delay={400}
                onClick={() => setView(ViewState.SPEAKING_LIST)}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
            />
            <CategoryCard 
                title="Говорение"
                subtitle="Интервью и Монолог."
                count={allOralStories.length}
                colorClass="purple"
                delay={500}
                onClick={() => setView(ViewState.ORAL_LIST)}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            />
            <CategoryCard 
                title="Письменная речь"
                subtitle="Электронное письмо."
                count={writingStories.length}
                colorClass="blue"
                delay={600}
                onClick={() => setView(ViewState.WRITING_LIST)}
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            />
        </div>
      </div>
    </div>
  );

  const renderList = (stories: Story[], type: ExerciseType) => {
    let title = 'Grammar';
    let subtitle = 'Tenses & Forms';
    if (type === ExerciseType.VOCABULARY) { title = 'Vocabulary'; subtitle = 'Word Formation'; }
    if (type === ExerciseType.READING) { title = 'Reading'; subtitle = 'Text Comprehension'; }
    if (type === ExerciseType.LISTENING) { title = 'Listening'; subtitle = 'Audio Comprehension'; }
    if (type === ExerciseType.SPEAKING) { title = 'Reading Aloud'; subtitle = 'Phonetics'; }
    if (type === ExerciseType.ORAL_SPEECH) { title = 'Speaking'; subtitle = 'Interview & Monologue'; }
    if (type === ExerciseType.WRITING) { title = 'Writing'; subtitle = 'Personal Email'; }

    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center mb-10 pb-6 border-b border-slate-200 justify-between">
          <div className="flex items-center">
            <button 
                onClick={goHome}
                className="mr-6 p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm group"
            >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </button>
            <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
                <p className="text-slate-500 font-medium">{subtitle}</p>
            </div>
          </div>
          
          {userProfile.role === 'teacher' && selectedStudentForView && (
              <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Assigning to: {selectedStudentForView.name}
              </div>
          )}
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((story, idx) => (
            <ExerciseCard 
              key={idx}
              story={story}
              type={type}
              onClick={() => startExercise(story, type)}
              isCompleted={completedStories.has(story.title)}
              onAssign={userProfile.role === 'teacher' ? () => assignTaskImmediately(story.title, type) : undefined}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderTeacherDashboard = () => (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
          {/* Sidebar - Student List */}
          <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
              <div className="p-6 border-b border-slate-100">
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      Students
                  </h2>
                  <div className="mt-4 flex gap-2">
                      <input 
                          type="text" 
                          placeholder="Add email..." 
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                          value={studentEmailInput}
                          onChange={(e) => setStudentEmailInput(e.target.value)}
                      />
                      <button 
                          onClick={handleAddStudent}
                          className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold hover:bg-indigo-700"
                      >
                          +
                      </button>
                  </div>
                  {studentAddError && <div className="text-xs text-red-500 mt-2">{studentAddError}</div>}
              </div>
              
              <div className="flex-1 overflow-y-auto">
                  {trackedStudents.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-sm">No students tracked.</div>
                  ) : (
                      trackedStudents.map((student) => (
                          <div 
                              key={student.id}
                              onClick={() => handleSelectStudentForView(student)}
                              className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors group relative ${selectedStudentForView?.id === student.id ? 'bg-indigo-50 border-indigo-100' : ''}`}
                          >
                              <div className="flex justify-between items-start">
                                  <div>
                                      <div className="font-bold text-slate-800">{student.name}</div>
                                      <div className="text-xs text-slate-400">{student.email}</div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveStudent(student.email); }} className="text-slate-300 hover:text-red-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
                                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{student.completedCount} tasks done</span>
                                  {student.pendingHomeworkCount && student.pendingHomeworkCount > 0 ? (
                                    <span className="bg-amber-100 px-2 py-0.5 rounded text-amber-700 font-bold">{student.pendingHomeworkCount} pending</span>
                                  ) : null}
                              </div>
                          </div>
                      ))
                  )}
              </div>
              
              <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
                  <button onClick={() => setView(ViewState.SETTINGS)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 px-2 py-2 rounded hover:bg-slate-50 transition-colors w-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Back to Settings
                  </button>
                  <button onClick={goHome} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 px-2 py-2 rounded hover:bg-slate-50 transition-colors w-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      Back to Home
                  </button>
              </div>
          </div>

          {/* Main Content - Analytics */}
          <div className="flex-1 overflow-y-auto h-screen p-6 md:p-10">
              {!selectedStudentForView ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      <p className="text-lg">Select a student to view details</p>
                  </div>
              ) : (
                  <div className="max-w-4xl mx-auto">
                      <div className="flex items-center justify-between mb-8">
                          <div>
                              <h1 className="text-3xl font-extrabold text-slate-900">{selectedStudentForView.name}</h1>
                              <p className="text-slate-500">{selectedStudentForView.email}</p>
                          </div>
                          <div className="flex gap-4">
                              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                  <div className="text-2xl font-bold text-indigo-600">{studentResults.length}</div>
                                  <div className="text-xs text-slate-400 uppercase font-bold">Attempts</div>
                              </div>
                              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                  <div className="text-2xl font-bold text-emerald-500">
                                      {studentResults.length > 0 ? Math.round(studentResults.reduce((acc, curr) => acc + (curr.score / curr.max_score), 0) / studentResults.length * 100) : 0}%
                                  </div>
                                  <div className="text-xs text-slate-400 uppercase font-bold">Avg Score</div>
                              </div>
                          </div>
                      </div>

                      {/* TABS */}
                      <div className="flex gap-4 border-b border-slate-200 mb-6">
                        <button 
                          onClick={() => setDashboardTab('HISTORY')}
                          className={`pb-3 px-4 text-sm font-bold transition-all ${dashboardTab === 'HISTORY' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Activity History
                        </button>
                        <button 
                          onClick={() => setDashboardTab('HOMEWORK')}
                          className={`pb-3 px-4 text-sm font-bold transition-all ${dashboardTab === 'HOMEWORK' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Homework
                        </button>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-8">
                          {/* Left Panel: Lists (History or Homework) */}
                          <div>
                              {dashboardTab === 'HISTORY' && (
                                <div className="space-y-3">
                                    {studentResults.map(result => (
                                        <div 
                                            key={result.id}
                                            onClick={() => setResultDetail(result)}
                                            className={`bg-white p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${resultDetail?.id === result.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-indigo-200'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-slate-800">{result.exercise_title}</span>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    (result.score / result.max_score) >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                                                    (result.score / result.max_score) >= 0.5 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {result.score} / {result.max_score}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-slate-400">
                                                <span>{result.exercise_type}</span>
                                                <span>{new Date(result.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {studentResults.length === 0 && <div className="text-slate-400 text-sm">No activity recorded yet.</div>}
                                </div>
                              )}

                              {dashboardTab === 'HOMEWORK' && (
                                <div className="space-y-3">
                                  {/* Assigned Homework List */}
                                  {studentHomework.map(hw => {
                                    const isOverdue = new Date() > new Date(hw.due_date) && hw.status !== 'completed';
                                    return (
                                      <div key={hw.id} className="bg-white p-4 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-bold text-slate-800">{hw.exercise_title}</span>
                                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                            hw.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                            isOverdue ? 'bg-rose-100 text-rose-700' :
                                            'bg-amber-100 text-amber-700'
                                          }`}>
                                            {isOverdue ? 'Overdue' : hw.status}
                                          </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-2">Due: {new Date(hw.due_date).toLocaleDateString()}</div>
                                        {hw.status === 'completed' && hw.score !== undefined && (
                                          <div className="text-xs font-bold text-slate-700">Score: {hw.score} / {hw.max_score}</div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {studentHomework.length === 0 && <div className="text-slate-400 text-sm">No homework assigned yet.</div>}
                                </div>
                              )}
                          </div>

                          {/* Right Panel: Details */}
                          <div>
                              {dashboardTab === 'HISTORY' && (
                                <>
                                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                      Detailed Report
                                  </h3>
                                  
                                  {resultDetail ? (
                                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                                              <h4 className="font-bold text-slate-900">{resultDetail.exercise_title}</h4>
                                              <p className="text-xs text-slate-500 mt-1">Reviewing specific answers</p>
                                          </div>
                                          <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                                              {resultDetail.details && resultDetail.details.map((detail: AttemptDetail, idx: number) => (
                                                  <div key={idx} className={`p-4 rounded-xl border ${detail.isCorrect ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                                                      <div className="flex items-start gap-3">
                                                          <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${detail.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                              {detail.isCorrect ? (
                                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                              ) : (
                                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                              )}
                                                          </div>
                                                          <div className="flex-1">
                                                              <p className="text-sm font-bold text-slate-800 mb-2">{detail.question}</p>
                                                              {detail.context && (
                                                                  <p className="text-xs text-slate-500 mb-3 italic whitespace-pre-line">"{detail.context}"</p>
                                                              )}
                                                              
                                                              <div className="grid grid-cols-2 gap-4 text-sm">
                                                                  <div>
                                                                      <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Student Answer</span>
                                                                      {detail.audioUrl ? (
                                                                        <a href={detail.audioUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors text-xs font-bold">
                                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                                            Listen
                                                                        </a>
                                                                      ) : (
                                                                        <span className={`${detail.isCorrect ? 'text-emerald-700' : 'text-rose-600 font-medium'}`}>
                                                                            {detail.userAnswer || "(Empty)"}
                                                                        </span>
                                                                      )}
                                                                  </div>
                                                                  {!detail.isCorrect && (
                                                                      <div>
                                                                          <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Correct Answer</span>
                                                                          <span className="text-emerald-600 font-medium">
                                                                              {detail.correctAnswer}
                                                                          </span>
                                                                      </div>
                                                                  )}
                                                              </div>
                                                          </div>
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
                                          Select an attempt from the history list to see exactly where the student made mistakes.
                                      </div>
                                  )}
                                </>
                              )}
                              
                              {dashboardTab === 'HOMEWORK' && (
                                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
                                  <p>Select a completed homework item to view details (feature coming soon).</p>
                                  <p className="mt-2 text-xs">For now, check the History tab for recent completions matching the homework.</p>
                                </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}
          </div>
          
          <HomeworkModal 
            isOpen={isHomeworkModalOpen} 
            studentName={studentToAssign?.name} 
            students={trackedStudents}
            preSelectedTask={quickAssignTask}
            onClose={() => setIsHomeworkModalOpen(false)}
            onAssign={handleAssignHomework}
            loading={loading}
          />
      </div>
  );

  // Teacher Mode Dashboard is now handled via ViewState.TEACHER_DASHBOARD
  if (view === ViewState.TEACHER_DASHBOARD) {
      return renderTeacherDashboard();
  }

  // --- Render Functions are now implicitly using updated methods ---
  // We need to ensure `renderList` and others use the new assign method.

  return (
    <div>
      {view === ViewState.REGISTRATION && renderRegistration()}
      {view === ViewState.FORGOT_PASSWORD && renderForgotPassword()}
      {view === ViewState.ROLE_SELECTION && renderRoleSelection()}
      {view === ViewState.HOME && renderHome()}
      {view === ViewState.SETTINGS && renderSettings()}
      {view === ViewState.GRAMMAR_LIST && renderList(grammarStories, ExerciseType.GRAMMAR)}
      {view === ViewState.VOCAB_LIST && renderList(vocabStories, ExerciseType.VOCABULARY)}
      {view === ViewState.READING_LIST && renderList(allReadingStories, ExerciseType.READING)}
      {view === ViewState.LISTENING_LIST && renderList(listeningStories, ExerciseType.LISTENING)}
      {view === ViewState.SPEAKING_LIST && renderList(speakingStories, ExerciseType.SPEAKING)}
      {view === ViewState.ORAL_LIST && renderList(allOralStories, ExerciseType.ORAL_SPEECH)}
      {view === ViewState.WRITING_LIST && renderList(writingStories, ExerciseType.WRITING)}
      {view === ViewState.EXERCISE && selectedStory && (
        <ExerciseView 
          story={selectedStory} 
          type={selectedType} 
          onBack={() => setView(getBackView())}
          onComplete={(score: number, max: number, details: AttemptDetail[]) => handleStoryComplete(selectedStory.title, score, max, details)}
          userProfile={userProfile}
        />
      )}
      {view === ViewState.HOMEWORK_LIST && (
          <StudentHomeworkView 
            assignments={myHomework}
            onBack={goHome}
            onStartExercise={startExercise}
          />
      )}
      
      {/* Teacher Global Modals */}
      {userProfile.role === 'teacher' && isHomeworkModalOpen && (
          <HomeworkModal 
            isOpen={isHomeworkModalOpen} 
            studentName={studentToAssign?.name} 
            students={trackedStudents}
            preSelectedTask={quickAssignTask}
            onClose={() => setIsHomeworkModalOpen(false)}
            onAssign={handleAssignHomework}
            loading={loading}
          />
      )}
    </div>
  );
}

export default App;
