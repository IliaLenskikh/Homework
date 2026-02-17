
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Story, 
  ExerciseType, 
  UserProfile, 
  StudentResult, 
  HomeworkAssignment, 
  AttemptDetail,
  UserRole,
  LiveSession
} from './types';
import ExerciseCard from './components/ExerciseCard';
import ExerciseView from './components/ExerciseView';
import StudentHomeworkView from './components/StudentHomeworkView';
import HomeworkModal from './components/HomeworkModal';
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
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

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
    isOnline?: boolean;
}

// Toast Notification Type
interface ToastMsg {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Improved Error Handling
const getErrorMessage = (error: any) => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
      if (error.code === '42P01') return "Database Error: Table not found. Please run the SQL schema script.";
      if (error.message) return error.message;
      if (error.error_description) return error.error_description;
      return JSON.stringify(error);
  }
  return String(error);
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewState>(ViewState.REGISTRATION);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', email: '', teacherEmail: '' });
  const [completedStories, setCompletedStories] = useState<Set<string>>(new Set());
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedType, setSelectedType] = useState<ExerciseType>(ExerciseType.GRAMMAR);
  // Track where the user came from to handle "Back" button correctly
  const [exerciseSource, setExerciseSource] = useState<'CATALOG' | 'HOMEWORK'>('CATALOG');
  
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
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  
  // Teacher Dashboard State
  const [trackedStudents, setTrackedStudents] = useState<TrackedStudent[]>([]);
  const [studentEmailInput, setStudentEmailInput] = useState('');
  const [studentAddError, setStudentAddError] = useState<string | null>(null);
  const [selectedStudentForView, setSelectedStudentForView] = useState<TrackedStudent | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [resultDetail, setResultDetail] = useState<StudentResult | null>(null);
  const [studentHomework, setStudentHomework] = useState<HomeworkAssignment[]>([]);
  
  // New Teacher Dashboard State
  const [dashboardTab, setDashboardTab] = useState<'LIVE_VIEW' | 'STUDENTS' | 'HOMEWORK' | 'ANALYTICS'>('STUDENTS');
  const [liveStudents, setLiveStudents] = useState<Record<string, LiveSession>>({});
  const [checkedHomework, setCheckedHomework] = useState<any[]>([]); // List of all completed homework for teacher
  const [selectedStudentForAssignment, setSelectedStudentForAssignment] = useState<TrackedStudent | null>(null); // For assignment flow

  // Live Session State (Teacher)
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [liveSessionCode, setLiveSessionCode] = useState<string | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<string[]>([]); // Student IDs
  const [currentPushedExercise, setCurrentPushedExercise] = useState<{title: string, type: ExerciseType} | null>(null);
  const [liveSessionPushTab, setLiveSessionPushTab] = useState<ExerciseType>(ExerciseType.GRAMMAR);

  // Live Session State (Student)
  const [joinedSessionCode, setJoinedSessionCode] = useState<string | null>(null);
  const [joinSessionInput, setJoinSessionInput] = useState('');
  const [incomingExercise, setIncomingExercise] = useState<{title: string, type: ExerciseType} | null>(null);
  const [showExercisePushModal, setShowExercisePushModal] = useState(false);

  // Presence State
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  
  // Homework Modal
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);
  const [studentToAssign, setStudentToAssign] = useState<TrackedStudent | null>(null);
  const [quickAssignTask, setQuickAssignTask] = useState<{title: string, type: ExerciseType} | undefined>(undefined);

  // Toast State
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const totalTasks = allStories.length;

  // Add Toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    // Initial check
    checkSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session) {
           await loadUserProfile(session.user.id, session.user.email!);
           setView(ViewState.SETTINGS); 
           setAuthSuccessMsg("Please set a new password below.");
        }
      }
      
      // On SIGNED_IN, we might be already handling it in handleAuth, 
      // but this acts as a backup for session restoration.
      if (event === 'SIGNED_IN' && session) {
          // Do not await here to avoid blocking UI if this triggers unexpectedly
          loadUserProfile(session.user.id, session.user.email!).catch(console.error);
      }
      
      if (event === 'SIGNED_OUT') {
          setView(ViewState.REGISTRATION);
          setUserProfile({ name: '', email: '', teacherEmail: '' });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Presence Subscription (Online Status)
  useEffect(() => {
    let channel: any;

    if (userProfile.id && userProfile.name) {
        channel = supabase.channel('classroom_global');
        
        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const users: Record<string, any> = {};
                
                // Flatten state
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        users[p.id] = p;
                    });
                });
                
                setOnlineUsers(users);
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        id: userProfile.id,
                        name: userProfile.name,
                        role: userProfile.role,
                        online_at: new Date().toISOString(),
                    });
                }
            });
    }

    return () => {
        if (channel) {
            supabase.removeChannel(channel);
        }
    };
  }, [userProfile.id, userProfile.name, userProfile.role]);

  // Realtime subscription for Students (Homework updates)
  useEffect(() => {
    let channel: any;
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

  // Live View Subscription for Teachers
  useEffect(() => {
    if (userProfile.role !== 'teacher' || trackedStudents.length === 0) return;
    
    // Create subscriptions for each tracked student
    const channels = trackedStudents.map(student => {
      const channel = supabase.channel(`live_session_${student.id}`);
      
      channel
        .on('broadcast', { event: 'session_started' }, (payload) => {
          setLiveStudents(prev => ({
            ...prev,
            [payload.payload.studentId]: {
              ...payload.payload,
              currentQuestion: '',
              userInput: '',
              isCorrect: null,
              progressPercentage: 0,
              lastActivity: Date.now()
            }
          }));
          showToast(`${payload.payload.studentName} started working`, 'info');
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          setLiveStudents(prev => ({
            ...prev,
            [payload.payload.studentId]: {
              ...prev[payload.payload.studentId],
              ...payload.payload, // Updates questionId, input, isCorrect, progress
              lastActivity: payload.payload.timestamp
            }
          }));
        })
        .on('broadcast', { event: 'session_ended' }, (payload) => {
          setLiveStudents(prev => {
            const updated = { ...prev };
            delete updated[payload.payload.studentId];
            return updated;
          });
        })
        .subscribe();
      
      return channel;
    });
    
    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [userProfile.role, trackedStudents]);

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
  
  // Load All Checked Homework for Teacher Dashboard
  const fetchAllCheckedHomework = async () => {
      if (userProfile.role !== 'teacher' || !userProfile.id) return;
      
      try {
          const { data, error } = await supabase
              .from('homework_assignments')
              .select('*, profiles:student_id(full_name, email)')
              .eq('teacher_id', userProfile.id)
              .eq('status', 'completed')
              .order('completed_at', { ascending: false });
              
          if (error) throw error;
          
          if (data) {
              // Map profile data to flatten structure if needed, or use as is
              const formatted = data.map((hw: any) => ({
                  ...hw,
                  studentName: hw.profiles?.full_name || 'Unknown',
                  studentEmail: hw.profiles?.email || ''
              }));
              setCheckedHomework(formatted);
          }
      } catch (e) {
          console.error("Error fetching checked homework:", e);
      }
  };

  // Fetch checked homework when tab changes to HOMEWORK
  useEffect(() => {
      if (dashboardTab === 'HOMEWORK' && userProfile.role === 'teacher') {
          fetchAllCheckedHomework();
      }
  }, [dashboardTab, userProfile.role]);

  // LIVE SESSION FUNCTIONS (TEACHER)
  const startLiveSession = async (sessionTitle: string) => {
    if (!userProfile.id) return;
    setLoading(true);
    // Generate unique 6-character code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      // Note: Assuming 'live_classroom_sessions' table exists as per instruction
      const { data, error } = await supabase
        .from('live_classroom_sessions')
        .insert({
          teacher_id: userProfile.id,
          session_code: code,
          title: sessionTitle,
          status: 'active' // Active immediately
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setLiveSessionCode(code);
      setLiveSessionActive(true);
      showToast(`Live session started! Code: ${code}`, "success");
      
      // Subscribe to participant joins
      subscribeToSessionParticipants(data.id);
      
    } catch (err: any) {
       // Graceful degradation if table doesn't exist yet
       if (err.code === '42P01') {
           showToast("Database not setup for Live Sessions. Run SQL script.", "error");
       } else {
           showToast(getErrorMessage(err), "error");
       }
    } finally {
        setLoading(false);
    }
  };

  const endLiveSession = async () => {
      if (!liveSessionCode) return;
      try {
          await supabase
            .from('live_classroom_sessions')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('session_code', liveSessionCode);
          
          setLiveSessionActive(false);
          setLiveSessionCode(null);
          setSessionParticipants([]);
          setCurrentPushedExercise(null);
          showToast("Session ended", "info");
      } catch (err) {
          console.error(err);
      }
  };

  const subscribeToSessionParticipants = (sessionId: string) => {
    const channel = supabase.channel(`session_${sessionId}_participants`);
    
    channel
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` },
        async () => {
          // Refresh participant list
          const { data } = await supabase
            .from('session_participants')
            .select('student_id, profiles!student_id(full_name)')
            .eq('session_id', sessionId)
            .eq('status', 'connected');
          
          if (data) {
            setSessionParticipants(data.map(p => p.student_id));
          }
        }
      )
      .subscribe();
  };

  const pushExerciseToStudents = async (exerciseTitle: string, exerciseType: ExerciseType) => {
    if (!liveSessionCode) {
      showToast("No active session", "error");
      return;
    }
    
    try {
      // Update session with current exercise
      await supabase
        .from('live_classroom_sessions')
        .update({
          current_exercise_title: exerciseTitle,
          current_exercise_type: exerciseType,
          status: 'active'
        })
        .eq('session_code', liveSessionCode);
      
      // Broadcast to all students via Supabase Realtime
      const channel = supabase.channel(`session_${liveSessionCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'exercise_pushed',
        payload: {
          exerciseTitle,
          exerciseType,
          teacherName: userProfile.name,
          pushedAt: Date.now()
        }
      });
      
      setCurrentPushedExercise({ title: exerciseTitle, type: exerciseType });
      showToast(`Pushed "${exerciseTitle}" to ${sessionParticipants.length} students`, "success");
      
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  // LIVE SESSION FUNCTIONS (STUDENT)
  const joinLiveSession = async (codeStr: string) => {
    if (!userProfile.id) return;
    if (!codeStr) return;
    setLoading(true);
    
    try {
      // Verify session exists and is active
      const { data: session, error: sessionError } = await supabase
        .from('live_classroom_sessions')
        .select('*')
        .eq('session_code', codeStr.toUpperCase())
        .in('status', ['waiting', 'active'])
        .single();
      
      if (sessionError || !session) {
        showToast("Invalid or ended session code", "error");
        setLoading(false);
        return;
      }
      
      // Add student to participants
      await supabase
        .from('session_participants')
        .insert({
          session_id: session.id,
          student_id: userProfile.id,
          status: 'connected'
        });
      
      setJoinedSessionCode(codeStr.toUpperCase());
      showToast(`Joined session: ${session.title}`, "success");
      
      // Subscribe to exercise pushes
      subscribeToExercisePushes(codeStr.toUpperCase());
      
    } catch (err: any) {
        if (err.code === '42P01') {
           showToast("Database not setup for Live Sessions.", "error");
       } else {
           showToast(getErrorMessage(err), "error");
       }
    } finally {
        setLoading(false);
    }
  };

  const subscribeToExercisePushes = (sessionCode: string) => {
    const channel = supabase.channel(`session_${sessionCode}`);
    
    channel
      .on('broadcast', { event: 'exercise_pushed' }, (payload) => {
        // Show notification and open exercise
        setIncomingExercise({
          title: payload.payload.exerciseTitle,
          type: payload.payload.exerciseType
        });
        setShowExercisePushModal(true);
        
        // Auto-open exercise after 3 seconds if not dismissed
        // But for better UX, let's just rely on the modal or immediate switch
      })
      .subscribe();
  };

  const handleAcceptPushedExercise = () => {
    if (!incomingExercise) return;
    
    // Find the exercise in the catalog
    const exercise = allStories.find(s => 
      s.title === incomingExercise.title && 
      s.type === incomingExercise.type
    );
    
    if (exercise) {
      startExercise(exercise, incomingExercise.type, 'CATALOG');
      setShowExercisePushModal(false);
    } else {
        showToast("Exercise not found locally", "error");
    }
  };

  // Effect to auto-accept for seamless experience (optional, but requested "immediately opens")
  useEffect(() => {
      if (showExercisePushModal && incomingExercise) {
          const timer = setTimeout(() => {
              handleAcceptPushedExercise();
          }, 1500); // Small delay to let user see "Incoming..."
          return () => clearTimeout(timer);
      }
  }, [showExercisePushModal, incomingExercise]);


  const checkSession = async () => {
    // Silent check, don't show global loading
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserProfile(session.user.id, session.user.email!);
    } else {
      // Stay on Registration view
    }
  };

  const loadUserProfile = async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
         // If table not found, just log and continue to let user in (fallback mode)
         if (error.code === '42P01') {
             console.warn("Profiles table missing. Running in limited mode.");
         } else {
             console.error('Error loading profile:', error);
         }
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
        
        // Navigation Logic
        if (!data.role) {
            setView(ViewState.ROLE_SELECTION);
        } else {
            if ([ViewState.REGISTRATION, ViewState.FORGOT_PASSWORD, ViewState.ROLE_SELECTION].includes(view)) {
                setView(ViewState.HOME);
            }
            if (data.role === 'student') {
                loadHomework(userId);
            }
        }
      } else {
        // No profile found in DB, temporary profile state
        setUserProfile({ id: userId, name: '', email: userEmail, teacherEmail: '' });
        setView(ViewState.ROLE_SELECTION);
      }
    } catch (e) {
      console.error("Critical profile load error:", e);
      // Fail-safe: allow user to retry or see role selection
      setView(ViewState.ROLE_SELECTION);
    }
  };

  const loadHomework = async (studentId: string) => {
      setHomeworkLoading(true);
      try {
          const { data, error } = await supabase
              .from('homework_assignments')
              .select('*')
              .eq('student_id', studentId);
          
          if (error) {
              if (error.code === '42P01') {
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    setAuthError(null);
    
    try {
      let result;
      if (isLoginMode) {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) throw result.error;

      if (result.data.session) {
          const session = result.data.session;
          // Fail-safe: Use Promise.race to prevent hanging if DB is slow
          try {
              await Promise.race([
                  loadUserProfile(session.user.id, session.user.email!),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Profile load timeout')), 8000))
              ]);
          } catch (timeoutErr) {
              console.warn("Profile load timed out, proceeding to fallback.");
              // Force entry if timeout happens
              setView(ViewState.ROLE_SELECTION);
              setUserProfile({ 
                  id: session.user.id, 
                  email: session.user.email!, 
                  name: '', 
                  teacherEmail: '' 
              });
          }
      } else if (!isLoginMode && result.data.user && !result.data.session) {
          setAuthSuccessMsg("Registration successful! Please check your email to confirm your account.");
          setIsLoginMode(true);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      setAuthError(getErrorMessage(error));
    } finally {
      // Must ensure loading is turned off
      setLoading(false);
    }
  };

  const handleAssignHomework = async (targetStudentId: string, exercises: { title: string; type: ExerciseType }[], dueDate: string, instructions: string) => {
    if (!targetStudentId || !userProfile.id) {
        showToast("Error: Missing student or teacher ID. Try refreshing.", "error");
        console.error("Assignment Failed. StudentID:", targetStudentId, "TeacherID:", userProfile.id);
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

      // Batch insert for efficiency ("EdTech standard")
      const { error } = await supabase
        .from('homework_assignments')
        .insert(assignments);

      if (error) throw error;

      showToast(`Successfully assigned ${exercises.length} tasks!`, "success");
      setIsHomeworkModalOpen(false); 
      setQuickAssignTask(undefined);
      // Clear assignment mode if we were in it
      setSelectedStudentForAssignment(null);
      
      // Refresh data in background
      await fetchStudentHomework(targetStudentId);
      refreshStudentStats(trackedStudents); 

    } catch (err: any) {
      console.error("Assign error:", err);
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  // Other Helper Functions ... 
  
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
      setAuthSuccessMsg("Password reset link sent.");
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

          // Check if homework table exists before querying
          const { count, error: countError } = await supabase
            .from('homework_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', profile.id)
            .eq('teacher_id', userProfile.id) // Only count tasks assigned by THIS teacher
            .eq('status', 'pending');

          if (countError && countError.code === '42P01') {
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

  const handleAddStudent = async (e: React.FormEvent) => {
      e.preventDefault();
      setStudentAddError(null);
      if (!studentEmailInput) return;

      const emailToAdd = studentEmailInput.trim().toLowerCase();
      if (trackedStudents.find(s => s.email.toLowerCase() === emailToAdd)) {
          setStudentAddError("Student already in list.");
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
          showToast("Student added successfully", "success");
      } else {
          setStudentAddError("Student not found. Ask them to register first.");
      }
  };

  const handleRemoveStudent = (emailToRemove: string) => {
      if(!confirm("Stop tracking this student?")) return;
      const newList = trackedStudents.filter(s => s.email !== emailToRemove);
      setTrackedStudents(newList);
      localStorage.setItem('tracked_students', JSON.stringify(newList));
      if (selectedStudentForView?.email === emailToRemove) {
          setSelectedStudentForView(null);
          setStudentResults([]);
      }
      showToast("Student removed", "info");
  };

  const handleSelectStudentForView = async (student: TrackedStudent) => {
      setSelectedStudentForView(student);
      setResultDetail(null);
      try {
          const { data: results } = await supabase
            .from('student_results')
            .select('*')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false });
          
          if (results) setStudentResults(results as StudentResult[]);
          await fetchStudentHomework(student.id);
      } catch (err) {
          console.error(err);
      }
  };

  const fetchStudentHomework = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('homework_assignments')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error && error.code !== '42P01') throw error;
      if (data) setStudentHomework(data as HomeworkAssignment[]);
    } catch (err) {
      console.error(err);
    }
  };

  const openAssignHomeworkModal = (student: TrackedStudent | null) => {
    setStudentToAssign(student);
    setQuickAssignTask(undefined);
    setIsHomeworkModalOpen(true);
  };

  const startAssignmentFlow = (student: TrackedStudent) => {
      setSelectedStudentForAssignment(student);
      // Fetch this student's homework to color code buttons
      fetchStudentHomework(student.id);
      setView(ViewState.HOME); // Go to main catalog
      showToast(`Assigning to ${student.name}. Select exercises.`, "info");
  };

  const assignTaskImmediately = async (storyTitle: string, exerciseType: ExerciseType) => {
      if (!selectedStudentForAssignment) {
          showToast("Select a student from the dashboard first.", "error");
          return;
      }
      // Re-use the main assignment function for consistency
      const exercises = [{ title: storyTitle, type: exerciseType }];
      // Default 7 days
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      
      await handleAssignHomework(
          selectedStudentForAssignment.id,
          exercises,
          defaultDate.toISOString().split('T')[0], // YYYY-MM-DD
          "Quick assigned task"
      );
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

  const handleRoleSwitch = async () => {
      if (!userProfile.id) return;
      const currentRole = userProfile.role || 'student';
      const newRole: UserRole = currentRole === 'student' ? 'teacher' : 'student';
      
      if (!window.confirm(`Switch to ${newRole} mode?`)) return;

      setLoading(true);
      try {
          const { error } = await supabase
          .from('profiles')
          .upsert({ id: userProfile.id, role: newRole, email: userProfile.email }, { onConflict: 'id' });

          if (error) throw error;
          setUserProfile((prev: UserProfile) => ({ ...prev, role: newRole }));
          setView(ViewState.HOME);
          showToast(`Switched to ${newRole} mode`, "success");
      } catch (err: any) {
          showToast(getErrorMessage(err), "error");
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
        await supabase.from('profiles').upsert({
            id: user.id,
            completed_stories: Array.from(newSet)
        }, { onConflict: 'id' });

        if (selectedStory) {
            await supabase.from('student_results').insert({
                student_id: user.id,
                exercise_title: title,
                exercise_type: selectedType,
                score: score,
                max_score: maxScore,
                details: details
            });
            
            // Check for homework completion
            const assignment = myHomework.find(h => 
                h.exercise_title === title && 
                h.exercise_type === selectedType && 
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

  // Tracking source for navigation
  const startExercise = (story: Story, type: ExerciseType, source: 'CATALOG' | 'HOMEWORK' = 'CATALOG') => {
    setSelectedStory(story);
    setSelectedType(type);
    setExerciseSource(source);
    setView(ViewState.EXERCISE);
  };

  const goHome = () => {
    setView(ViewState.HOME);
    setSelectedStory(null);
  };

  const getBackView = () => {
    // If we came from homework, go back to homework list
    if (exerciseSource === 'HOMEWORK') {
        return ViewState.HOMEWORK_LIST;
    }

    // Otherwise standard behavior
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

  // -- Teacher Analytics (Correctly placed at top level) --
  const performanceData = useMemo(() => {
      if (!studentResults || studentResults.length === 0) return [];
      
      const stats: Record<string, { totalScore: number, maxScore: number, count: number }> = {};
      
      studentResults.forEach(res => {
          if (!stats[res.exercise_type]) {
              stats[res.exercise_type] = { totalScore: 0, maxScore: 0, count: 0 };
          }
          stats[res.exercise_type].totalScore += res.score;
          stats[res.exercise_type].maxScore += res.max_score;
          stats[res.exercise_type].count += 1;
      });

      return Object.keys(stats).map(type => {
          const data = stats[type];
          const percentage = data.maxScore > 0 ? Math.round((data.totalScore / data.maxScore) * 100) : 0;
          return { type: type as ExerciseType, percentage, count: data.count };
      });
  }, [studentResults]);

  // -- Render Components -- 
  
  const ToastContainer = () => (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2 animate-slide-in-right ${
          t.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          t.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
          'bg-slate-50 text-slate-700 border-slate-200'
        }`}>
          {t.type === 'success' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
          {t.type === 'error' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
          {t.message}
        </div>
      ))}
    </div>
  );

  // Online Status Bar Component - UPDATED to be a top block element
  const OnlineStatusBar = () => {
      // Filter online users based on current user role
      if (userProfile.role === 'teacher') {
          // Show students
          const onlineStudents = Object.values(onlineUsers).filter((u: any) => u.role === 'student');
          if (onlineStudents.length === 0) return null;
          
          return (
              <div className="w-full bg-emerald-600 text-white text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 shadow-sm z-50">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-100"></span>
                  </span>
                  <span>Students Online: {onlineStudents.map((s: any) => s.name).join(', ')}</span>
              </div>
          );
      } else if (userProfile.role === 'student') {
          // Show if teacher is online
          const teacherOnline = Object.values(onlineUsers).some((u: any) => u.role === 'teacher');
          if (!teacherOnline) return null;

          return (
              <div className="w-full bg-indigo-600 text-white text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 shadow-sm z-50">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-100"></span>
                  </span>
                  <span>Teacher is Online</span>
              </div>
          );
      }
      return null;
  };

  // Enhance students list with online status for modal
  const trackedStudentsWithStatus = useMemo(() => {
      return trackedStudents.map(student => ({
          ...student,
          isOnline: Object.values(onlineUsers).some((u: any) => u.id === student.id)
      }));
  }, [trackedStudents, onlineUsers]);

  const CategoryCard = ({ title, subtitle, count, onClick, colorClass, icon, delay, badge, stats }: any) => {
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
        <div className="absolute top-4 right-4 flex items-center gap-2">
            {stats && (
                <div className="bg-white border border-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${stats.completed === stats.total && stats.total > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    {stats.completed}/{stats.total}
                </div>
            )}
            {badge && (
              <div className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce shadow-sm">
                {badge}
              </div>
            )}
        </div>

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

  const getCategoryStats = (stories: Story[]) => {
      const total = stories.length;
      const completed = stories.filter(s => completedStories.has(s.title)).length;
      return { completed, total };
  };
  
  // ... Render Functions ...

  const renderList = (stories: Story[], type: ExerciseType) => {
    let title = 'Grammar';
    let subtitle = 'Tenses & Forms';
    if (type === ExerciseType.VOCABULARY) { title = 'Vocabulary'; subtitle = 'Word Formation'; }
    if (type === ExerciseType.READING) { title = 'Reading'; subtitle = 'Text Comprehension'; }
    if (type === ExerciseType.LISTENING) { title = 'Listening'; subtitle = 'Audio Tasks'; }
    if (type === ExerciseType.SPEAKING) { title = 'Read Aloud'; subtitle = 'Phonetics'; }
    if (type === ExerciseType.ORAL_SPEECH) { title = 'Speaking'; subtitle = 'Interview & Monologue'; }
    if (type === ExerciseType.WRITING) { title = 'Writing'; subtitle = 'Personal Email'; }

    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        {selectedStudentForAssignment && (
            <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl mb-6 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    <span className="font-bold">Assigning Homework to: {selectedStudentForAssignment.name}</span>
                </div>
                <button 
                    onClick={() => {
                        setSelectedStudentForAssignment(null);
                        setStudentHomework([]); // Clear context
                        goHome();
                    }}
                    className="text-indigo-200 hover:text-white text-xs font-bold uppercase tracking-wider"
                >
                    Cancel Assignment Mode
                </button>
            </div>
        )}

        {/* Teacher Warning: No Student Selected */}
        {userProfile.role === 'teacher' && !selectedStudentForAssignment && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 shadow-sm animate-fade-in">
                <div className="p-1.5 bg-amber-100 rounded-full shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-sm font-medium">Select a student from Teacher Dashboard to enable quick homework assignment.</span>
            </div>
        )}

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
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((story, idx) => {
            // Determine status for styling if in assignment mode
            let isAssigned = false;
            let isCompleted = false;
            
            if (selectedStudentForAssignment) {
                const hw = studentHomework.find(h => h.exercise_title === story.title && h.exercise_type === type);
                if (hw) {
                    isAssigned = true;
                    if (hw.status === 'completed') isCompleted = true;
                }
            } else {
                isCompleted = completedStories.has(story.title);
            }

            return (
                <div key={idx} className={`relative rounded-2xl transition-all ${isAssigned && !isCompleted ? 'ring-2 ring-indigo-400 bg-indigo-50' : isCompleted && selectedStudentForAssignment ? 'ring-2 ring-emerald-400 bg-emerald-50 opacity-75' : ''}`}>
                    <ExerciseCard 
                        story={story}
                        type={type}
                        onClick={() => startExercise(story, type, 'CATALOG')}
                        isCompleted={isCompleted}
                        isTeacher={userProfile.role === 'teacher'}
                        onAssign={
                            selectedStudentForAssignment 
                            ? () => assignTaskImmediately(story.title, type) 
                            : undefined
                        }
                    />
                    {isAssigned && !isCompleted && (
                        <div className="absolute top-2 right-2 bg-indigo-500 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-md shadow-sm">
                            Assigned
                        </div>
                    )}
                </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTeacherDashboard = () => {
      const activeSessions = Object.values(liveStudents);

      const allCategoriesForPush = [
        { type: ExerciseType.GRAMMAR, stories: grammarStories, label: 'Grammar' },
        { type: ExerciseType.VOCABULARY, stories: vocabStories, label: 'Vocabulary' },
        { type: ExerciseType.READING, stories: [...readingStories, ...readingTrueFalseStories], label: 'Reading' },
        { type: ExerciseType.LISTENING, stories: listeningStories, label: 'Listening' },
        { type: ExerciseType.SPEAKING, stories: speakingStories, label: 'Read Aloud' },
        { type: ExerciseType.ORAL_SPEECH, stories: [...oralStories, ...monologueStories], label: 'Speaking' },
        { type: ExerciseType.WRITING, stories: writingStories, label: 'Writing' },
      ];

      return (
      <div className="flex-1 flex flex-col md:flex-row h-full">
          <div className="w-full md:w-64 bg-white/95 backdrop-blur-sm border-r border-slate-200 flex flex-col h-full sticky top-0">
              <div className="p-6 border-b border-slate-100">
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      Teacher
                  </h2>
              </div>
              
              <div className="flex-1 flex flex-col gap-1 p-3">
                  <button 
                    onClick={() => setDashboardTab('LIVE_VIEW')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${dashboardTab === 'LIVE_VIEW' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Live View
                      {activeSessions.length > 0 && <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{activeSessions.length}</span>}
                  </button>
                  <button 
                    onClick={() => setDashboardTab('STUDENTS')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${dashboardTab === 'STUDENTS' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      Students
                  </button>
                  <button 
                    onClick={() => setDashboardTab('HOMEWORK')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${dashboardTab === 'HOMEWORK' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      Homework
                  </button>
                  <button 
                    onClick={() => setDashboardTab('ANALYTICS')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${dashboardTab === 'ANALYTICS' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      Analytics
                  </button>
              </div>

              <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
                  <button onClick={() => setView(ViewState.SETTINGS)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 px-2 py-2 rounded hover:bg-slate-50 transition-colors w-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Settings
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-10">
              
              {dashboardTab === 'LIVE_VIEW' && (
                  <div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-6">Live Classroom</h2>
                      
                      {/* Session Control Header */}
                      {!liveSessionActive ? (
                        <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-slate-200 text-center mb-8">
                          <h3 className="text-xl font-bold text-slate-800 mb-4">Start Live Classroom Session</h3>
                          <p className="text-slate-500 mb-6">Push exercises to students in real-time and monitor their progress</p>
                          <button 
                            onClick={() => startLiveSession("Live Class " + new Date().toLocaleTimeString())}
                            disabled={loading}
                            className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                          >
                            {loading ? "Starting..." : "Start Live Session"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6 mb-8">
                          {/* Active Session Banner */}
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-2xl shadow-xl">
                            <div className="flex justify-between items-center">
                              <div>
                                <h3 className="text-2xl font-bold mb-2">Live Session Active</h3>
                                <p className="text-indigo-100">Session Code: <span className="font-mono text-2xl font-black tracking-wider bg-white/20 px-2 py-1 rounded ml-2">{liveSessionCode}</span></p>
                                <p className="text-indigo-100 text-sm mt-1">{sessionParticipants.length} students connected</p>
                              </div>
                              <button 
                                onClick={endLiveSession}
                                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold backdrop-blur"
                              >
                                End Session
                              </button>
                            </div>
                          </div>

                          {/* Exercise Browser with Push Buttons */}
                          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                Push Exercise to Students
                            </h4>
                            
                            {/* Category Tabs */}
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                {allCategoriesForPush.map(cat => (
                                    <button
                                        key={cat.type}
                                        onClick={() => setLiveSessionPushTab(cat.type)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                            liveSessionPushTab === cat.type 
                                            ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' 
                                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* Exercise Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                              {allCategoriesForPush.find(c => c.type === liveSessionPushTab)?.stories.map((story, idx) => (
                                <div key={idx} className="border border-slate-100 rounded-xl p-3 hover:border-indigo-300 transition-all group bg-slate-50/50 hover:bg-white">
                                  <h5 className="font-bold text-sm text-slate-800 mb-1 line-clamp-1">{story.title}</h5>
                                  <p className="text-[10px] text-slate-400 mb-2 line-clamp-1">{story.text?.substring(0, 40) || story.template?.[0]?.substring(0, 40) || "Exercise..."}</p>
                                  <button 
                                    onClick={() => pushExerciseToStudents(story.title, liveSessionPushTab)}
                                    className="w-full bg-white border border-indigo-200 text-indigo-600 py-1.5 rounded-lg text-xs font-bold mt-1 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    Push Now
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Live Monitoring Grid */}
                      <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Student Activity</h4>
                      {activeSessions.length === 0 ? (
                          <div className="text-center py-12 bg-white/50 backdrop-blur rounded-3xl border-2 border-dashed border-slate-200">
                              <div className="text-4xl mb-4 text-slate-300">📡</div>
                              <h3 className="text-lg font-bold text-slate-400">Waiting for activity...</h3>
                              <p className="text-slate-400 text-sm mt-1">Students progress will appear here.</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {activeSessions.map(session => {
                                  const isIdle = Date.now() - session.lastActivity > 120000;
                                  const isStuck = session.isCorrect === false && session.userInput.length > 5;
                                  
                                  return (
                                      <div key={session.studentId} className={`bg-white p-6 rounded-2xl shadow-sm border-2 transition-all ${isStuck ? 'border-rose-300 bg-rose-50' : isIdle ? 'border-amber-300 bg-amber-50' : 'border-emerald-300'}`}>
                                          <div className="flex justify-between items-start mb-4">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                      {session.studentName.substring(0,2).toUpperCase()}
                                                  </div>
                                                  <div>
                                                      <h4 className="font-bold text-slate-800 leading-none">{session.studentName}</h4>
                                                      <span className="text-xs text-slate-500">{session.exerciseType}</span>
                                                  </div>
                                              </div>
                                              <div className={`w-3 h-3 rounded-full ${isIdle ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`}></div>
                                          </div>
                                          
                                          <div className="mb-4">
                                              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Current Task</div>
                                              <div className="text-sm font-medium text-slate-800 line-clamp-1">{session.exerciseTitle}</div>
                                          </div>

                                          <div className="mb-4">
                                              <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                                                  <span>Progress</span>
                                                  <span>{session.progressPercentage}%</span>
                                              </div>
                                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                                  <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${session.progressPercentage}%` }}></div>
                                              </div>
                                          </div>

                                          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Live Input</div>
                                              <div className="flex items-center gap-2">
                                                  <span className="font-mono text-sm text-slate-800 flex-1 truncate">{session.userInput || 'Typing...'}</span>
                                                  {session.isCorrect === true && <span className="text-emerald-500 text-lg">✓</span>}
                                                  {session.isCorrect === false && <span className="text-rose-500 text-lg">✗</span>}
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              )}

              {dashboardTab === 'STUDENTS' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Student List */}
                      <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-100px)]">
                          <div className="p-4 border-b border-slate-100">
                              <h3 className="font-bold text-slate-800 mb-2">Tracked Students</h3>
                              <div className="flex gap-2">
                                  <input 
                                      type="text" 
                                      placeholder="Add email..." 
                                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                      value={studentEmailInput}
                                      onChange={(e) => setStudentEmailInput(e.target.value)}
                                  />
                                  <button onClick={handleAddStudent} className="bg-indigo-600 text-white px-3 rounded-lg font-bold hover:bg-indigo-700">+</button>
                              </div>
                              {studentAddError && <p className="text-xs text-rose-500 mt-1">{studentAddError}</p>}
                          </div>
                          <div className="flex-1 overflow-y-auto">
                              {trackedStudents.length === 0 ? (
                                  <div className="p-6 text-center text-slate-400 text-sm">No students tracked yet.</div>
                              ) : (
                                  trackedStudents.map(student => (
                                      <div 
                                          key={student.id}
                                          onClick={() => handleSelectStudentForView(student)}
                                          className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-all ${selectedStudentForView?.id === student.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                                      >
                                          <div className="flex justify-between items-center mb-1">
                                              <span className="font-bold text-slate-800">{student.name}</span>
                                              {Object.values(onlineUsers).some((u:any) => u.id === student.id) && (
                                                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                              )}
                                          </div>
                                          <div className="text-xs text-slate-500">{student.email}</div>
                                          
                                          {/* Quick Actions */}
                                          <div className="flex gap-2 mt-3">
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); startAssignmentFlow(student); }}
                                                  className="bg-white border border-indigo-200 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors"
                                              >
                                                  Assign Homework
                                              </button>
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); handleRemoveStudent(student.email); }}
                                                  className="text-slate-300 hover:text-rose-400 px-2"
                                              >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                              </button>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>

                      {/* Student Details */}
                      <div className="lg:col-span-2">
                          {selectedStudentForView ? (
                              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full min-h-[500px]">
                                  <div className="flex justify-between items-start mb-6">
                                      <div>
                                          <h2 className="text-2xl font-extrabold text-slate-900">{selectedStudentForView.name}</h2>
                                          <p className="text-slate-500">{selectedStudentForView.email}</p>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-2xl font-bold text-indigo-600">{studentResults.length}</div>
                                          <div className="text-xs text-slate-400 uppercase font-bold">Total Attempts</div>
                                      </div>
                                  </div>

                                  <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Recent Activity</h3>
                                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                      {studentResults.length === 0 ? (
                                          <p className="text-slate-400 text-sm">No activity recorded.</p>
                                      ) : (
                                          studentResults.map(res => (
                                              <div key={res.id} onClick={() => setResultDetail(res)} className="p-3 rounded-xl border border-slate-100 hover:border-indigo-200 cursor-pointer transition-all bg-slate-50 hover:bg-white group">
                                                  <div className="flex justify-between items-center mb-1">
                                                      <span className="font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">{res.exercise_title}</span>
                                                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${res.score / res.max_score >= 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {res.score}/{res.max_score}
                                                      </span>
                                                  </div>
                                                  <div className="flex justify-between text-xs text-slate-400">
                                                      <span>{res.exercise_type}</span>
                                                      <span>{new Date(res.created_at).toLocaleDateString()}</span>
                                                  </div>
                                              </div>
                                          ))
                                      )}
                                  </div>
                                  
                                  {/* Result Detail Modal/Panel */}
                                  {resultDetail && (
                                      <div className="mt-6 border-t border-slate-100 pt-6 animate-fade-in">
                                          <h4 className="font-bold text-slate-800 mb-4">Attempt Details: {resultDetail.exercise_title}</h4>
                                          <div className="space-y-4">
                                              {resultDetail.details?.map((det, idx) => (
                                                  <div key={idx} className={`p-3 rounded-lg border text-sm ${det.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                                      <p className="font-bold text-slate-700 mb-1">{det.question}</p>
                                                      <div className="flex justify-between items-center">
                                                          <span className={det.isCorrect ? 'text-emerald-600' : 'text-rose-600'}>{det.userAnswer || '(Empty)'}</span>
                                                          {!det.isCorrect && <span className="text-slate-400 text-xs">Correct: {det.correctAnswer}</span>}
                                                      </div>
                                                      {det.audioUrl && (
                                                          <audio controls src={det.audioUrl} className="mt-2 w-full h-8" />
                                                      )}
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ) : (
                              <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                                  <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                  <p>Select a student to view details</p>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {dashboardTab === 'HOMEWORK' && (
                  <div>
                      <div className="flex justify-between items-center mb-6">
                          <h2 className="text-2xl font-bold text-slate-900">Checked Homework</h2>
                      </div>
                      
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                          {checkedHomework.length === 0 ? (
                              <div className="p-10 text-center text-slate-400">
                                  No completed homework assignments found.
                              </div>
                          ) : (
                              <div className="divide-y divide-slate-100">
                                  {checkedHomework.map((hw) => (
                                      <div key={hw.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                          <div className="flex items-center gap-4">
                                              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                              </div>
                                              <div>
                                                  <div className="font-bold text-slate-800">{hw.exercise_title}</div>
                                                  <div className="text-xs text-slate-500 flex gap-2">
                                                      <span>Student: <span className="font-semibold text-indigo-600">{hw.studentName}</span></span>
                                                      <span>•</span>
                                                      <span>{new Date(hw.completed_at).toLocaleDateString()}</span>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="text-right">
                                              <div className="text-lg font-bold text-emerald-600">
                                                  {hw.score} <span className="text-slate-400 text-sm font-normal">/ {hw.max_score}</span>
                                              </div>
                                              <button 
                                                  className="text-xs text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                                  onClick={() => {
                                                      // Assuming we have a way to view details, for now just reuse the logic
                                                      // Could set resultDetail if we fetch the result object
                                                  }}
                                              >
                                                  View Details
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {dashboardTab === 'ANALYTICS' && (
                  <div className="text-center py-20">
                      <div className="text-6xl mb-4">📊</div>
                      <h2 className="text-2xl font-bold text-slate-800">Analytics Dashboard</h2>
                      <p className="text-slate-500 mt-2">Detailed class performance metrics coming soon.</p>
                  </div>
              )}
          </div>
      </div>
      );
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

  return (
      <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50 relative overflow-hidden" style={learningBackground}>
          <OnlineStatusBar />
          <HomeworkModal 
            isOpen={isHomeworkModalOpen} 
            studentName={studentToAssign?.name} 
            initialStudentId={studentToAssign?.id}
            students={trackedStudentsWithStatus}
            preSelectedTask={quickAssignTask}
            onClose={() => setIsHomeworkModalOpen(false)}
            onAssign={handleAssignHomework}
            loading={loading}
          />
          <ToastContainer />
          
          <div className="flex-1 overflow-y-auto relative z-10 flex flex-col">
            {/* Main Content Area - Shows categories when not in a specific view */}
            {view === ViewState.HOME && userProfile.role === 'student' && !selectedStory && (
              <div className="max-w-7xl mx-auto px-4 py-8 w-full">
                <div className="mb-12 text-center">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                    Hello, {userProfile.name || 'Student'}!
                  </h1>
                  <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    Ready to master your English skills? Choose a category below or check your homework.
                  </p>
                </div>

                {/* Live Session Join (Student) */}
                {userProfile.role === 'student' && !joinedSessionCode && (
                  <div className="mb-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 max-w-3xl mx-auto">
                    <div>
                      <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                        <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
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
                
                {/* Live Session Active Banner (Student) */}
                {joinedSessionCode && (
                   <div className="mb-8 bg-indigo-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between max-w-3xl mx-auto animate-fade-in">
                       <div className="flex items-center gap-3">
                           <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                           <span className="font-bold">Live Session Active: {joinedSessionCode}</span>
                       </div>
                       <div className="text-xs opacity-75">Waiting for teacher instructions...</div>
                   </div>
                )}

                {/* Progress Overview */}
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
                    
                    {/* Homework Alert */}
                    <div 
                      onClick={() => setView(ViewState.HOMEWORK_LIST)}
                      className="flex items-center gap-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    >
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div>
                            <div className="font-bold text-lg">Homework</div>
                            <div className="text-indigo-100 text-sm">{pendingHomeworkCount} tasks pending</div>
                        </div>
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <CategoryCard 
                      title="Grammar" 
                      subtitle="Tenses & Forms" 
                      stats={getCategoryStats(grammarStories)}
                      onClick={() => setView(ViewState.GRAMMAR_LIST)}
                      colorClass="text-indigo-600 bg-indigo-50"
                      delay={0}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                  />
                  <CategoryCard 
                      title="Vocabulary" 
                      subtitle="Word Formation" 
                      stats={getCategoryStats(vocabStories)}
                      onClick={() => setView(ViewState.VOCAB_LIST)}
                      colorClass="text-teal-600 bg-teal-50"
                      delay={100}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>}
                  />
                  <CategoryCard 
                      title="Reading" 
                      subtitle="Comprehension" 
                      stats={getCategoryStats(allReadingStories)}
                      onClick={() => setView(ViewState.READING_LIST)}
                      colorClass="text-amber-600 bg-amber-50"
                      delay={200}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                  />
                  <CategoryCard 
                      title="Listening" 
                      subtitle="Audio Tasks" 
                      stats={getCategoryStats(listeningStories)}
                      onClick={() => setView(ViewState.LISTENING_LIST)}
                      colorClass="text-cyan-600 bg-cyan-50"
                      delay={250}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
                  />
                  <CategoryCard 
                      title="Read Aloud" 
                      subtitle="Phonetics" 
                      stats={getCategoryStats(speakingStories)}
                      onClick={() => setView(ViewState.SPEAKING_LIST)}
                      colorClass="text-rose-600 bg-rose-50"
                      delay={300}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
                  />
                  <CategoryCard 
                      title="Speaking" 
                      subtitle="Monologue" 
                      stats={getCategoryStats(allOralStories)}
                      onClick={() => setView(ViewState.ORAL_LIST)}
                      colorClass="text-purple-600 bg-purple-50"
                      delay={400}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
                  />
                  <CategoryCard 
                      title="Writing" 
                      subtitle="Email Task" 
                      stats={getCategoryStats(writingStories)}
                      onClick={() => setView(ViewState.WRITING_LIST)}
                      colorClass="text-blue-600 bg-blue-50"
                      delay={500}
                      icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                  />
                </div>
              </div>
            )}

            {/* Conditional Views based on State */}
            {view === ViewState.REGISTRATION && (
              <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
                <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome Back</h1>
                    <p className="text-slate-500">Sign in to continue your progress</p>
                  </div>
                  
                  {authError && (
                    <div className="bg-rose-50 text-rose-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-rose-100">
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {authError}
                    </div>
                  )}
                  {authSuccessMsg && (
                    <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-emerald-100">
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {authSuccessMsg}
                    </div>
                  )}

                  <form onSubmit={handleAuth} className="space-y-5">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
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
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2V-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
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
                      <button onClick={() => setView(ViewState.FORGOT_PASSWORD)} className="text-indigo-500 hover:text-indigo-700 text-xs font-bold transition-colors">
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === ViewState.FORGOT_PASSWORD && (
              <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
                <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 text-center">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset Password</h2>
                  <p className="text-slate-500 mb-8 text-sm">Enter your email to receive a reset link</p>
                  
                  {authSuccessMsg ? (
                      <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 text-sm border border-emerald-100">
                          {authSuccessMsg}
                      </div>
                  ) : (
                      <form onSubmit={handlePasswordReset} className="space-y-4">
                          <input 
                              type="email" 
                              placeholder="Email" 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                          />
                          <button 
                              type="submit" 
                              disabled={loading}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all"
                          >
                              {loading ? 'Sending...' : 'Send Reset Link'}
                          </button>
                      </form>
                  )}
                  <button onClick={() => setView(ViewState.REGISTRATION)} className="mt-6 text-slate-400 hover:text-slate-600 text-sm font-bold">
                      Back to Login
                  </button>
                </div>
              </div>
            )}

            {view === ViewState.ROLE_SELECTION && (
                <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
                    <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-lg border border-slate-100 text-center">
                        <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Choose your role</h2>
                        <p className="text-slate-500 mb-10">How will you use this platform?</p>
                        
                        <div className="grid grid-cols-2 gap-6">
                            <button 
                                onClick={() => handleRoleSelection('student')}
                                className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group flex flex-col items-center gap-4"
                            >
                                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                </div>
                                <span className="font-bold text-slate-700 group-hover:text-indigo-700">Student</span>
                            </button>

                            <button 
                                onClick={() => handleRoleSelection('teacher')}
                                className="p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group flex flex-col items-center gap-4"
                            >
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                </div>
                                <span className="font-bold text-slate-700 group-hover:text-emerald-700">Teacher</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === ViewState.SETTINGS && (
              <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
                      <button onClick={goHome} className="text-slate-400 hover:text-slate-600">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                          onClick={handleLogout}
                          className="px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors"
                        >
                          Log Out
                        </button>
                    </div>
                  </form>

                  <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                      <button onClick={handleRoleSwitch} className="text-xs font-bold text-slate-400 hover:text-indigo-600 underline transition-colors">
                          Switch Role (Debug)
                      </button>
                  </div>
                </div>
              </div>
            )}

            {/* Teacher Dashboard View */}
            {view === ViewState.HOME && userProfile.role === 'teacher' && !selectedStudentForAssignment && renderTeacherDashboard()}

            {/* Exercise Lists */}
            {view === ViewState.GRAMMAR_LIST && renderList(grammarStories, ExerciseType.GRAMMAR)}
            {view === ViewState.VOCAB_LIST && renderList(vocabStories, ExerciseType.VOCABULARY)}
            {view === ViewState.READING_LIST && renderList([...readingStories, ...readingTrueFalseStories], ExerciseType.READING)}
            {view === ViewState.LISTENING_LIST && renderList(listeningStories, ExerciseType.LISTENING)}
            {view === ViewState.SPEAKING_LIST && renderList(speakingStories, ExerciseType.SPEAKING)}
            {view === ViewState.ORAL_LIST && renderList([...oralStories, ...monologueStories], ExerciseType.ORAL_SPEECH)}
            {view === ViewState.WRITING_LIST && renderList(writingStories, ExerciseType.WRITING)}

            {/* Exercise View */}
            {view === ViewState.EXERCISE && selectedStory && (
              <ExerciseView 
                story={selectedStory} 
                type={selectedType}
                onBack={() => setView(getBackView())}
                onComplete={(score, maxScore, details) => handleStoryComplete(selectedStory.title, score, maxScore, details)}
                userProfile={userProfile}
              />
            )}

            {/* Student Homework View */}
            {view === ViewState.HOMEWORK_LIST && (
                <StudentHomeworkView 
                    assignments={myHomework}
                    onStartExercise={(story, type) => startExercise(story, type, 'HOMEWORK')}
                    onBack={goHome}
                    onRefresh={() => userProfile.id && loadHomework(userProfile.id)}
                    loading={homeworkLoading}
                />
            )}
          </div>

          {/* Teacher Settings Shortcut - Moved to Bottom Left */}
          {userProfile.role && view !== ViewState.SETTINGS && view !== ViewState.EXERCISE && view !== ViewState.REGISTRATION && view !== ViewState.FORGOT_PASSWORD && view !== ViewState.ROLE_SELECTION && (
             <div className="fixed bottom-6 left-6 z-50">
                 <button 
                    onClick={() => setView(ViewState.SETTINGS)}
                    className="w-12 h-12 bg-white/90 backdrop-blur rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all hover:scale-110 active:scale-95"
                    title="Settings"
                 >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>
             </div>
          )}
      </div>
  );
}
