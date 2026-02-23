import { useState, useRef, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandling';
import { UserProfile, TrackedStudent, LiveSession, ExerciseType } from '../types';

export const useTeacherLiveSession = (userProfile: UserProfile, trackedStudents: TrackedStudent[]) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [liveSessionCode, setLiveSessionCode] = useState<string | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<string[]>([]);
  const [currentPushedExercise, setCurrentPushedExercise] = useState<{title: string, type: ExerciseType} | null>(null);
  const [liveStudents, setLiveStudents] = useState<Record<string, LiveSession>>({});

  const sessionChannelRef = useRef<RealtimeChannel | null>(null);
  const liveSessionBroadcastRef = useRef<RealtimeChannel | null>(null);

  // Cleanup channels on unmount
  useEffect(() => {
    return () => {
      if (sessionChannelRef.current) supabase.removeChannel(sessionChannelRef.current);
      if (liveSessionBroadcastRef.current) supabase.removeChannel(liveSessionBroadcastRef.current);
    };
  }, []);

  // Optimized Live View Subscription for Teachers
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
  }, [userProfile.role, trackedStudents, showToast]);

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

  return {
    liveSessionActive,
    liveSessionCode,
    sessionParticipants,
    currentPushedExercise,
    liveStudents,
    startLiveSession,
    endLiveSession,
    pushExerciseToStudents,
    loading
  };
};
