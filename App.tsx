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
import TeacherDashboard from './components/TeacherDashboard';
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
  const [exerciseSource, setExerciseSource] = useState<'CATALOG' | 'HOMEWORK'>( 'CATALOG');
  
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
  const [studentHomework, setStudentHomework] = useState<HomeworkAssignment[]>([]);
  
  // New Teacher Dashboard State
  const [liveStudents, setLiveStudents] = useState<Record<string, LiveSession>>({});

  const [selectedStudentForAssignment, setSelectedStudentForAssignment] = useState<TrackedStudent | null>(null); 

  // Live Session State (Teacher)
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [liveSessionCode, setLiveSessionCode] = useState<string | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<string[]>([]); 
  const [currentPushedExercise, setCurrentPushedExercise] = useState<{title: string, type: ExerciseType} | null>(null);
  const sessionChannelRef = useRef<any>(null); // For participant DB changes
  const liveSessionBroadcastRef = useRef<any>(null); // For pushing exercises (Teacher)

  // Live Session State (Student)
  const [joinedSessionCode, setJoinedSessionCode] = useState<string | null>(null);
  const [joinSessionInput, setJoinSessionInput] = useState('');
  const [incomingExercise, setIncomingExercise] = useState<{title: string, type: ExerciseType} | null>(null);
  const [showExercisePushModal, setShowExercisePushModal] = useState(false);
  const liveSessionChannelRef = useRef<any>(null); // For listening to exercises (Student)

  // Presence State
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  
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
    checkSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session) {
           await loadUserProfile(session.user.id, session.user.email!);
           setView(ViewState.SETTINGS); 
           setAuthSuccessMsg("Please set a new password below.");
        }
      }
      
      if (event === 'SIGNED_IN' && session) {
          loadUserProfile(session.user.id, session.user.email!).catch(console.error);
      }
      
      if (event === 'SIGNED_OUT') {
          setView(ViewState.REGISTRATION);
          setUserProfile({ name: '', email: '', teacherEmail: '' });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
      }
      if (liveSessionChannelRef.current) {
        supabase.removeChannel(liveSessionChannelRef.current);
      }
      if (liveSessionBroadcastRef.current) {
        supabase.removeChannel(liveSessionBroadcastRef.current);
      }
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

  // Optimized Live View Subscription for Teachers (Single Channel)
  useEffect(() => {
    if (userProfile.role !== 'teacher' || trackedStudents.length === 0) return;
    
    const channel = supabase.channel('live_sessions_all');
    
    trackedStudents.forEach(student => {
      channel
        .on('broadcast', { event: `student_${student.id}_started` }, (payload) => {
          setLiveStudents(prev => ({
            ...prev,
            [student.id]: {
              ...payload.payload,
              currentQuestion: '',
              userInput: '',
              allAnswers: {}, 
              isCorrect: null,
              progressPercentage: 0,
              lastActivity: Date.now()
            }
          }));
          showToast(`${payload.payload.studentName} started working`, 'info');
        })
        .on('broadcast', { event: `student_${student.id}_typing` }, (payload) => {
          setLiveStudents(prev => ({
            ...prev,
            [student.id]: {
              ...prev[student.id],
              ...payload.payload, 
              lastActivity: payload.payload.timestamp
            }
          }));
        })
        .on('broadcast', { event: `student_${student.id}_ended` }, (payload) => {
          setLiveStudents(prev => {
            const updated = { ...prev };
            delete updated[student.id];
            return updated;
          });
        });
    });

    channel.subscribe();
    
    return () => {
      supabase.removeChannel(channel);
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
  
  // LIVE SESSION FUNCTIONS (TEACHER)
  const startLiveSession = async (sessionTitle: string) => {
    if (!userProfile.id) return;
    
    setLoading(true);
    
    try {
      // 1. Check for existing active session to reuse
      const { data: existingSession, error: fetchError } = await supabase
        .from('live_classroom_sessions')
        .select('*')
        .eq('teacher_id', userProfile.id)
        .eq('status', 'active')
        .maybeSingle();

      if (fetchError) throw fetchError;

      let sessionId = '';
      let code = '';

      if (existingSession) {
        // Reuse existing
        sessionId = existingSession.id;
        code = existingSession.session_code;
        showToast(`Reconnected to active session: ${code}`, "success");
      } else {
        // Create new
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: newSession, error: insertError } = await supabase
          .from('live_classroom_sessions')
          .insert({
            teacher_id: userProfile.id,
            session_code: code,
            title: sessionTitle,
            status: 'active' 
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        sessionId = newSession.id;
        showToast(`Live session started! Code: ${code}`, "success");
      }
      
      setLiveSessionCode(code);
      setLiveSessionActive(true);
      
      // Cleanup previous broadcast channel if exists
      if (liveSessionBroadcastRef.current) {
          supabase.removeChannel(liveSessionBroadcastRef.current);
      }

      // Establish persistent broadcast channel
      const broadcastChannel = supabase.channel(`session_${code}`);
      liveSessionBroadcastRef.current = broadcastChannel;
      await broadcastChannel.subscribe(); 

      // Listen for participants
      subscribeToSessionParticipants(sessionId);
      
    } catch (err: any) {
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
          if (liveSessionBroadcastRef.current) {
              await liveSessionBroadcastRef.current.send({
                type: 'broadcast',
                event: 'session_ended',
                payload: {}
              });
          }

          await supabase
            .from('live_classroom_sessions')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('session_code', liveSessionCode);
          
          setLiveSessionActive(false);
          setLiveSessionCode(null);
          setSessionParticipants([]);
          setCurrentPushedExercise(null);
          
          if (liveSessionBroadcastRef.current) {
              supabase.removeChannel(liveSessionBroadcastRef.current);
              liveSessionBroadcastRef.current = null;
          }
          if (sessionChannelRef.current) {
              supabase.removeChannel(sessionChannelRef.current);
              sessionChannelRef.current = null;
          }

          showToast("Session ended", "info");
      } catch (err) {
          console.error(err);
      }
  };

  const subscribeToSessionParticipants = (sessionId: string) => {
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
    }
    
    const channel = supabase.channel(`session_${sessionId}_participants`);
    sessionChannelRef.current = channel;
    
    channel
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` },
        async () => {
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
    if (!liveSessionCode || !liveSessionBroadcastRef.current) {
      showToast("Session not properly initialized. Try restarting.", "error");
      return;
    }
    
    try {
      // Only update current exercise, do not reset status
      await supabase
        .from('live_classroom_sessions')
        .update({
          current_exercise_title: exerciseTitle,
          current_exercise_type: exerciseType,
        })
        .eq('session_code', liveSessionCode);
      
      // Use the persistent channel
      await liveSessionBroadcastRef.current.send({
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
      showToast(`Pushed "${exerciseTitle}" to students`, "success");
      
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const joinLiveSession = async (codeStr: string) => {
    if (!userProfile.id || !codeStr) return;
    setLoading(true);
    
    try {
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

      // Check for existing join record to prevent duplicates
      const { data: existing } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .eq('student_id', userProfile.id)
        .maybeSingle();
      
      if (!existing) {
          await supabase
            .from('session_participants')
            .insert({
              session_id: session.id,
              student_id: userProfile.id,
              status: 'connected'
            });
      }
      
      setJoinedSessionCode(codeStr.toUpperCase());
      showToast(`Joined session: ${session.title}`, "success");
      
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
    if (liveSessionChannelRef.current) {
      supabase.removeChannel(liveSessionChannelRef.current);
    }
    
    const channel = supabase.channel(`session_${sessionCode}`);
    liveSessionChannelRef.current = channel;
    
    channel
      .on('broadcast', { event: 'exercise_pushed' }, (payload) => {
        setIncomingExercise({
          title: payload.payload.exerciseTitle,
          type: payload.payload.exerciseType
        });
        setShowExercisePushModal(true);
      })
      .on('broadcast', { event: 'session_ended' }, () => {
        showToast("Session ended by teacher", "info");
        setJoinedSessionCode(null);
        setIncomingExercise(null);
        setShowExercisePushModal(false);
        if (liveSessionChannelRef.current) {
            supabase.removeChannel(liveSessionChannelRef.current);
            liveSessionChannelRef.current = null;
        }
      })
      .subscribe();
  };

  const handleAcceptPushedExercise = () => {
    if (!incomingExercise) return;
    
    const exercise = allStories.find(s => 
      s.title === incomingExercise.title && 
      s.type === incomingExercise.type
    );
    
    if (exercise) {
      startExercise(exercise, incomingExercise.type, 'CATALOG');
    } else {
        showToast("Exercise not found locally", "error");
    }
    
    setShowExercisePushModal(false);
    setIncomingExercise(null);
  };

  // Auto-accept effect with crash fix
  useEffect(() => {
    let isMounted = true;
    let timer: number | null = null;
    
    if (showExercisePushModal && incomingExercise) {
      timer = window.setTimeout(() => {
        if (isMounted) { 
          handleAcceptPushedExercise();
        }
      }, 1500);
    }
      
    return () => {
        isMounted = false;
        if (timer) clearTimeout(timer);
    };
  }, [showExercisePushModal, incomingExercise]);


  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserProfile(session.user.id, session.user.email!);
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
        setUserProfile({ id: userId, name: '', email: userEmail, teacherEmail: '' });
        setView(ViewState.ROLE_SELECTION);
      }
    } catch (e) {
      console.error("Critical profile load error:", e);
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
        // ✅ Supabase methods are under .auth namespace
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        // ✅ Supabase methods are under .auth namespace
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) throw result.error;

      if (result.data.session) {
          const session = result.data.session;
          try {
              await Promise.race([
                  loadUserProfile(session.user.id, session.user.email!),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Profile load timeout')), 8000))
              ]);
          } catch (timeoutErr) {
              console.warn("Profile load timed out, proceeding to fallback.");
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

          const { count, error: countError } = await supabase
            .from('homework_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', profile.id)
            .eq('teacher_id', userProfile.id) 
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

      if (error && error.code !== '42P01') throw error;
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
    if (exerciseSource === 'HOMEWORK') {
        return ViewState.HOMEWORK_LIST;
    }

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

  const totalCompleted = completedStories.size;
  const progressPercentage = Math.round((totalCompleted / totalTasks) * 100) || 0;
  const pendingHomeworkCount = myHomework.filter(h => h.status === 'pending' || (h.status === 'overdue' && new Date() > new Date(h.due_date))).length;

  const OnlineStatusBar = () => {
      if (userProfile.role === 'teacher') {
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
            const isCompleted = completedStories.has(story.title);

            return (
                <div key={idx} className={`relative rounded-2xl transition-all`}>
                    <ExerciseCard 
                        story={story}
                        type={type}
                        onClick={() => startExercise(story, type, 'CATALOG')}
                        isCompleted={isCompleted}
                    />
                </div>
            );
          })}
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
          
          <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2 animate-fade-in-up ${
                    t.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    t.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                    'bg-white text-slate-700 border-slate-100'
                }`}>
                    {t.type === 'success' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    {t.type === 'error' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                    {t.message}
                </div>
            ))}
          </div>
          
          <div className="flex-1 overflow-y-auto relative z-10 flex flex-col">
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

            {view === ViewState.HOME && userProfile.role === 'teacher' && !selectedStudentForAssignment && (
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

            {view === ViewState.GRAMMAR_LIST && renderList(grammarStories, ExerciseType.GRAMMAR)}
            {view === ViewState.VOCAB_LIST && renderList(vocabStories, ExerciseType.VOCABULARY)}
            {view === ViewState.READING_LIST && renderList([...readingStories, ...readingTrueFalseStories], ExerciseType.READING)}
            {view === ViewState.LISTENING_LIST && renderList(listeningStories, ExerciseType.LISTENING)}
            {view === ViewState.SPEAKING_LIST && renderList(speakingStories, ExerciseType.SPEAKING)}
            {view === ViewState.ORAL_LIST && renderList([...oralStories, ...monologueStories], ExerciseType.ORAL_SPEECH)}
            {view === ViewState.WRITING_LIST && renderList(writingStories, ExerciseType.WRITING)}

            {view === ViewState.EXERCISE && selectedStory && (
              <ExerciseView 
                story={selectedStory} 
                type={selectedType}
                onBack={() => setView(getBackView())}
                onComplete={(score, maxScore, details) => handleStoryComplete(selectedStory.title, score, maxScore, details)}
                userProfile={userProfile}
              />
            )}

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

          {userProfile.role && view !== ViewState.SETTINGS && view !== ViewState.EXERCISE && view !== ViewState.REGISTRATION && view !== ViewState.FORGOT_PASSWORD && view !== ViewState.ROLE_SELECTION && view !== ViewState.HOME && (
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