
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import TeacherDashboard from './components/TeacherDashboard';
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
    setUserProfile
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
  
  // New Teacher Dashboard State
  const [liveStudents, setLiveStudents] = useState<Record<string, LiveSession>>({});

  const [selectedStudentForAssignment, setSelectedStudentForAssignment] = useState<TrackedStudent | null>(null); 

  // Live Session State (Teacher)
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [liveSessionCode, setLiveSessionCode] = useState<string | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<string[]>([]); 
  const [currentPushedExercise, setCurrentPushedExercise] = useState<{title: string, type: ExerciseType} | null>(null);
  const sessionChannelRef = useRef<RealtimeChannel | null>(null); // For participant DB changes
  const liveSessionBroadcastRef = useRef<RealtimeChannel | null>(null); // For pushing exercises (Teacher)

  // Live Session State (Student)
  const [joinedSessionCode, setJoinedSessionCode] = useState<string | null>(null);
  const [joinSessionInput, setJoinSessionInput] = useState('');
  const [incomingExercise, setIncomingExercise] = useState<{title: string, type: ExerciseType} | null>(null);
  const [showExercisePushModal, setShowExercisePushModal] = useState(false);
  const liveSessionChannelRef = useRef<RealtimeChannel | null>(null); // For listening to exercises (Student)

  interface OnlineUser {
    id: string;
    name: string;
    role: string;
    online_at: string;
  }

  // Presence State
  const [onlineUsers, setOnlineUsers] = useState<Record<string, OnlineUser>>({});

  const totalTasks = allStories.length;

  useEffect(() => {
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
    }
    if (liveSessionChannelRef.current) {
      supabase.removeChannel(liveSessionChannelRef.current);
    }
    if (liveSessionBroadcastRef.current) {
      supabase.removeChannel(liveSessionBroadcastRef.current);
    }

    return () => {
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

  useEffect(() => {
    if (authSuccessMsg === "Please set a new password below.") {
      navigate('/settings');
    }
  }, [authSuccessMsg, navigate]);

  useEffect(() => {
    if (isAuthChecking || isProfileLoading) return;

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

  // Presence Subscription (Online Status)
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    if (userProfile.id && userProfile.name) {
        channel = supabase.channel('classroom_global');
        
        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel!.presenceState();
                const users: Record<string, OnlineUser> = {};
                
                Object.values(state).forEach((presences) => {
                    presences.forEach((p: any) => {
                        users[p.id] = p as OnlineUser;
                    });
                });
                
                setOnlineUsers(users);
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await channel?.track({
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

  return (
      <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50 relative overflow-hidden" style={learningBackground}>
          <OnlineStatusBar userProfile={userProfile} onlineUsers={onlineUsers} />
          
          <div className="flex-1 overflow-y-auto relative z-10 flex flex-col">
            <AppRouter
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              loading={loading}
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
