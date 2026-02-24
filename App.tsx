
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePresence } from './hooks/usePresence';
import { useTeacherLiveSession } from './hooks/useTeacherLiveSession';
import { useStudentLiveSession } from './hooks/useStudentLiveSession';
import { isTableNotFoundError } from './services/errorMapper';
import { 
  Story, 
  ExerciseType, 
  UserProfile, 
  StudentResult, 
  HomeworkAssignment, 
  AttemptDetail,
  UserRole,
  LiveSession,
  TrackedStudent
} from './types';
import ExerciseCard from './components/ExerciseCard';
import ExerciseView from './components/ExerciseView';
import StudentHomeworkView from './components/StudentHomeworkView';
import HomeworkModal from './components/HomeworkModal';
import { AppRouter } from './components/AppRouter';
import { grammarStories } from './data/grammar';
import { vocabStories } from './data/vocabulary';
import { readingStories } from './data/reading';
import { readingTrueFalseStories } from './data/readingTrueFalse';
import { speakingStories } from './data/speaking';
import { writingStories } from './data/writing';
import { oralStories } from './data/oral';
import { monologueStories } from './data/monologue';
import { listeningStories } from './data/listening';
import { supabase } from './services/supabaseClient';
import { AuthChangeEvent, Session, RealtimeChannel } from '@supabase/supabase-js';

import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { getErrorMessage } from './utils/errorHandling';
import { CategoryCard } from './components/CategoryCard';
import { OnlineStatusBar } from './components/OnlineStatusBar';
import { ExerciseList } from './components/ExerciseList';

const allReadingStories = [...readingStories, ...readingTrueFalseStories];
const allOralStories = [...oralStories, ...monologueStories];

const allStories: (Story & { type: ExerciseType })[] = [
  ...grammarStories.map(s => ({ ...s, type: ExerciseType.GRAMMAR })),
  ...vocabStories.map(s => ({ ...s, type: ExerciseType.VOCABULARY })),
  ...allReadingStories.map(s => ({ ...s, type: ExerciseType.READING })),
  ...speakingStories.map(s => ({ ...s, type: ExerciseType.SPEAKING })),
  ...allOralStories.map(s => ({ ...s, type: ExerciseType.ORAL_SPEECH })),
  ...writingStories.map(s => ({ ...s, type: ExerciseType.WRITING })),
  ...listeningStories.map(s => ({ ...s, type: ExerciseType.LISTENING })),
];

export default function App() {
  const {
    userProfile: authProfile,
    isAuthChecking,
    isProfileLoading,
    authError,
    authSuccessMsg,
    handleAuth: contextHandleAuth,
    handleLogout: contextHandleLogout,
    handlePasswordReset: contextHandlePasswordReset,
    handleRoleSelection: contextHandleRoleSelection,
    handleRoleSwitch: contextHandleRoleSwitch,
    setAuthError,
    setAuthSuccessMsg,
    setUserProfile,
    profileError,
    retryProfileLoad
  } = useAuth();

  const userProfile = authProfile || { name: '', email: '', teacherEmail: '', role: undefined };

  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [completedStories, setCompletedStories] = useState<Set<string>>(new Set());
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState(''); 
  const [fullName, setFullName] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);

  // Homework & Teacher state
  const [myHomework, setMyHomework] = useState<HomeworkAssignment[]>([]);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  
  // Teacher Dashboard State
  const [trackedStudents, setTrackedStudents] = useState<TrackedStudent[]>([]);
  const [studentHomework, setStudentHomework] = useState<HomeworkAssignment[]>([]);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [studentCompletedStories, setStudentCompletedStories] = useState<Set<string>>(new Set());
  const [studentHomeworkList, setStudentHomeworkList] = useState<HomeworkAssignment[]>([]);

  useEffect(() => {
    if (viewingStudentId) {
      supabase.from('profiles').select('completed_stories').eq('id', viewingStudentId).single().then(({ data }) => {
        if (data) {
          setStudentCompletedStories(new Set(data.completed_stories || []));
        }
      });
      supabase.from('homework_assignments').select('*').eq('student_id', viewingStudentId).then(({ data }) => {
        if (data) {
          setStudentHomeworkList(data as HomeworkAssignment[]);
        }
      });
    }
  }, [viewingStudentId]);
  
  // Live Session Hooks
  const {
    liveSessionActive,
    liveSessionCode,
    sessionParticipants,
    currentPushedExercise,
    liveStudents,
    startLiveSession,
    endLiveSession,
    pushExerciseToStudents,
    loading: teacherLoading
  } = useTeacherLiveSession(userProfile, trackedStudents);

  const [selectedStudentForAssignment, setSelectedStudentForAssignment] = useState<TrackedStudent | null>(null);

  const {
    joinedSessionCode,
    joinSessionInput,
    setJoinSessionInput,
    incomingExercise,
    showExercisePushModal,
    joinLiveSession,
    loading: studentLoading
  } = useStudentLiveSession(userProfile, (title, type) => {
    const exercise = allStories.find(s => s.title === title && s.type === type);
    if (exercise) {
      startExercise(exercise, type, 'CATALOG');
    } else {
      showToast("Exercise not found locally", "error");
    }
  });

  // Presence State
  const { onlineUsers } = usePresence(userProfile);

  const totalTasks = allStories.length;



  useEffect(() => {
    if (authSuccessMsg === "Please set a new password below.") {
      navigate('/settings');
    }
  }, [authSuccessMsg, navigate]);

  useEffect(() => {
    if (isAuthChecking || isProfileLoading || profileError) return;

    const currentPath = location.pathname;

    if (!authProfile) {
      if (currentPath !== '/auth' && currentPath !== '/forgot-password') {
        navigate('/auth');
      }
    } else if (!authProfile.role) {
      if (currentPath !== '/role-selection') {
        navigate('/role-selection');
      }
    } else {
      if (currentPath === '/auth' || currentPath === '/role-selection' || currentPath === '/forgot-password') {
        navigate('/');
      }
    }
  }, [authProfile?.id, authProfile?.role, isAuthChecking, isProfileLoading, navigate, location.pathname]);

  useEffect(() => {
    if (authProfile?.id) {
      setCompletedStories(new Set(authProfile.completed_stories || []));
      if (authProfile.role === 'student') {
        loadHomework(authProfile.id);
      }
    }
  }, [authProfile?.id, authProfile?.role]);



  // Realtime subscription for Students (Homework updates)
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    if (userProfile.role === 'student' && userProfile.id) {
        try {
            channel = supabase
                .channel('public:homework_assignments')
                .on('postgres_changes', 
                    { event: '*', schema: 'public', table: 'homework_assignments', filter: `student_id=eq.${userProfile.id}` }, 
                    () => {
                        loadHomework(userProfile.id!); 
                        showToast("Homework updated!", "info");
                    }
                )
                .subscribe();
        } catch (e) {
            console.error("Realtime subscription error:", e);
        }
    }
    return () => {
        if (channel) supabase.removeChannel(channel);
    };
  }, [userProfile.role, userProfile.id]);



  // Load teacher's student list from local storage
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
  
  // LIVE SESSION FUNCTIONS (TEACHER) - Moved to useTeacherLiveSession



  const loadHomework = async (studentId: string) => {
      setHomeworkLoading(true);
      try {
          const { data, error } = await supabase
              .from('homework_assignments')
              .select('*')
              .eq('student_id', studentId);
          
          if (error) {
              if (isTableNotFoundError(error)) {
                  console.warn("Homework table missing. SQL setup required.");
              }
              return;
          }
          if (data) {
              setMyHomework(data as HomeworkAssignment[]);
          }
      } catch (e) {
          console.error("Homework load failed:", e);
      } finally {
          setHomeworkLoading(false);
      }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    try {
      await contextHandleAuth(email, password, isLoginMode);
    } catch (error: any) {
      // Error is handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleAssignHomework = async (targetStudentId: string, exercises: { title: string; type: ExerciseType }[], dueDate: string, instructions: string) => {
    if (!targetStudentId || !userProfile.id) {
        showToast("Error: Missing student or teacher ID. Try refreshing.", "error");
        return;
    }
    
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

      showToast(`Successfully assigned ${exercises.length} tasks!`, "success");
      
      await fetchStudentHomework(targetStudentId);
      refreshStudentStats(trackedStudents); 

    } catch (err: any) {
      console.error("Assign error:", err);
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await contextHandlePasswordReset(email);
    } catch (error: any) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelectionSubmit = async (role: UserRole) => {
      setLoading(true);
      try {
          await contextHandleRoleSelection(role);
          navigate('/');
      } catch (err: any) {
          // Error handled in context
      } finally {
          setLoading(false);
      }
  };

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

          const { count, error: countError } = await supabase
            .from('homework_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', profile.id)
            .eq('teacher_id', userProfile.id) 
            .eq('status', 'pending');

          if (countError && isTableNotFoundError(countError)) {
              console.warn("Homework table missing");
          }

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
          return null;
      }
  };

  const handleAddStudent = async (emailToAdd: string) => {
      if (!emailToAdd) return;

      if (trackedStudents.find(s => s.email.toLowerCase() === emailToAdd.toLowerCase())) {
          showToast("Student already in list.", "error");
          return;
      }
      if (emailToAdd.toLowerCase() === userProfile.email?.toLowerCase()) {
          showToast("You cannot add yourself.", "error");
          return;
      }

      setLoading(true);
      const studentData = await fetchStudentData(emailToAdd);
      setLoading(false);

      if (studentData) {
          const newList = [...trackedStudents, studentData];
          setTrackedStudents(newList);
          localStorage.setItem('tracked_students', JSON.stringify(newList));
          showToast("Student added successfully", "success");
      } else {
          showToast("Student not found. Ask them to register first.", "error");
      }
  };

  const handleRemoveStudent = (emailToRemove: string) => {
      if(!confirm("Stop tracking this student?")) return;
      const newList = trackedStudents.filter(s => s.email !== emailToRemove);
      setTrackedStudents(newList);
      localStorage.setItem('tracked_students', JSON.stringify(newList));
      showToast("Student removed", "info");
  };

  const fetchStudentHomework = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('homework_assignments')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error && !isTableNotFoundError(error)) throw error;
      if (data) setStudentHomework(data as HomeworkAssignment[]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: userProfile.name,
            teacher_email: userProfile.teacherEmail,
            role: userProfile.role 
          }, { onConflict: 'id' });

        if (error) throw error;

        setUserProfile(prev => prev ? { ...prev, name: userProfile.name, teacherEmail: userProfile.teacherEmail } : null);

        if (newPassword) {
            const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
            if (pwdError) throw pwdError;
            setNewPassword('');
            showToast("Settings and Password updated!", "success");
        } else {
            showToast("Settings saved!", "success");
        }
      }
    } catch (error: any) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSwitchSubmit = async () => {
      setLoading(true);
      try {
          await contextHandleRoleSwitch();
          navigate('/');
          showToast(`Switched mode`, "success");
      } catch (err: any) {
          showToast(getErrorMessage(err), "error");
      } finally {
          setLoading(false);
      }
  };

  const handleStoryComplete = async (title: string, type: ExerciseType, score: number, maxScore: number, details: AttemptDetail[]) => {
    const newSet = new Set(completedStories);
    newSet.add(title);
    setCompletedStories(newSet);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
            id: user.id,
            completed_stories: Array.from(newSet)
        }, { onConflict: 'id' });

        if (title) {
            await supabase.from('student_results').insert({
                student_id: user.id,
                exercise_title: title,
                exercise_type: type,
                score: score,
                max_score: maxScore,
                details: details
            });
            
            const assignment = myHomework.find(h => 
                h.exercise_title === title && 
                h.exercise_type === type && 
                h.status !== 'completed'
            );

            if (assignment) {
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
                    setMyHomework(prev => prev.map(h => 
                        h.id === assignment.id 
                            ? { ...h, status: 'completed', score, maxScore, completed_at: new Date().toISOString() } 
                            : h
                    ));
                    showToast("Homework task completed!", "success");
                }
            }
        }
      }
    } catch (error) {
      console.error('Failed to save progress', error);
    }
  };

  const startExercise = (story: Story, type: ExerciseType, source: 'CATALOG' | 'HOMEWORK' = 'CATALOG') => {
    navigate(`/exercise/${type}/${encodeURIComponent(story.title)}`, { state: { source } });
  };

  const goHome = () => {
    navigate('/');
  };

  const handleLogoutSubmit = async () => {
    await contextHandleLogout();
    navigate('/auth');
    setCompletedStories(new Set());
    setTrackedStudents([]);
    setEmail('');
    setPassword('');
    setFullName('');
  };

  const totalCompleted = completedStories.size;
  const progressPercentage = Math.round((totalCompleted / totalTasks) * 100) || 0;
  const pendingHomeworkCount = myHomework.filter(h => h.status === 'pending' || (h.status === 'overdue' && new Date() > new Date(h.due_date))).length;

  const trackedStudentsWithStatus = useMemo(() => {
      return trackedStudents.map(student => ({
          ...student,
          isOnline: Object.values(onlineUsers).some((u) => u.id === student.id)
      }));
  }, [trackedStudents, onlineUsers]);

  const getCategoryStats = (stories: Story[]) => {
      const total = stories.length;
      const completed = stories.filter(s => completedStories.has(s.title)).length;
      return { completed, total };
  };
  
  const learningBackground = {
    backgroundColor: '#f8fafc',
    backgroundImage: `
      linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px), 
      linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px)
    `,
    backgroundSize: '30px 30px',
    backgroundPosition: 'center center'
  };

  if (isAuthChecking || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" style={learningBackground}>
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-500 font-medium animate-pulse">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" style={learningBackground}>
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-rose-100">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Error</h2>
          <p className="text-slate-500 mb-6">{profileError}</p>
          <button 
            onClick={() => retryProfileLoad()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 w-full"
          >
            Retry Connection
          </button>
          <button 
            onClick={() => contextHandleLogout()}
            className="mt-4 text-slate-400 hover:text-slate-600 text-sm font-medium"
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50 relative overflow-hidden" style={learningBackground}>
          <OnlineStatusBar userProfile={userProfile} onlineUsers={onlineUsers} />
          
          <div className="flex-1 overflow-y-auto relative z-10 flex flex-col">
            <AppRouter
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              loading={loading || teacherLoading || studentLoading}
              authError={authError}
              authSuccessMsg={authSuccessMsg}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              isLoginMode={isLoginMode}
              setIsLoginMode={setIsLoginMode}
              handleAuthSubmit={handleAuthSubmit}
              handlePasswordResetSubmit={handlePasswordResetSubmit}
              handleRoleSelectionSubmit={handleRoleSelectionSubmit}
              handleSettingsSave={handleSettingsSave}
              handleLogoutSubmit={handleLogoutSubmit}
              handleRoleSwitchSubmit={handleRoleSwitchSubmit}
              goHome={goHome}
              startExercise={startExercise}
              completedStories={completedStories}
              handleStoryComplete={handleStoryComplete}
              myHomework={myHomework}
              homeworkLoading={homeworkLoading}
              loadHomework={loadHomework}
              pendingHomeworkCount={pendingHomeworkCount}
              trackedStudentsWithStatus={trackedStudentsWithStatus}
              handleAddStudent={handleAddStudent}
              handleRemoveStudent={handleRemoveStudent}
              liveStudents={liveStudents}
              onlineUsers={onlineUsers}
              startLiveSession={startLiveSession}
              endLiveSession={endLiveSession}
              pushExerciseToStudents={pushExerciseToStudents}
              liveSessionActive={liveSessionActive}
              liveSessionCode={liveSessionCode}
              sessionParticipants={sessionParticipants}
              handleAssignHomework={handleAssignHomework}
              selectedStudentForAssignment={selectedStudentForAssignment}
              joinedSessionCode={joinedSessionCode}
              joinSessionInput={joinSessionInput}
              setJoinSessionInput={setJoinSessionInput}
              joinLiveSession={joinLiveSession}
              progressPercentage={progressPercentage}
              totalCompleted={totalCompleted}
              totalTasks={totalTasks}
              viewingStudentId={viewingStudentId}
              setViewingStudentId={setViewingStudentId}
              studentCompletedStories={studentCompletedStories}
              studentHomeworkList={studentHomeworkList}
            />
          </div>

          {userProfile.role && !location.pathname.includes('/exercise/') && location.pathname !== '/settings' && location.pathname !== '/auth' && location.pathname !== '/forgot-password' && location.pathname !== '/role-selection' && (
             <div className="fixed bottom-6 left-6 z-50">
                 <button 
                    onClick={() => navigate('/settings')}
                    className="w-12 h-12 bg-white/90 backdrop-blur rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all hover:scale-110 active:scale-95"
                    title="Settings"
                 >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>
             </div>
          )}
      </div>
  );
}
