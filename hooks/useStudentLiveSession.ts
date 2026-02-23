import { useState, useRef, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandling';
import { UserProfile, ExerciseType, Story } from '../types';

export const useStudentLiveSession = (
  userProfile: UserProfile, 
  onAcceptExercise: (title: string, type: ExerciseType) => void
) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [joinedSessionCode, setJoinedSessionCode] = useState<string | null>(null);
  const [joinSessionInput, setJoinSessionInput] = useState('');
  const [incomingExercise, setIncomingExercise] = useState<{title: string, type: ExerciseType} | null>(null);
  const [showExercisePushModal, setShowExercisePushModal] = useState(false);
  
  const liveSessionChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    return () => {
      if (liveSessionChannelRef.current) supabase.removeChannel(liveSessionChannelRef.current);
    };
  }, []);

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

  const handleAcceptPushedExercise = () => {
    if (!incomingExercise) return;
    
    // We delegate the actual starting logic to the parent component
    // because it has access to the router and story data
    onAcceptExercise(incomingExercise.title, incomingExercise.type);
    
    setShowExercisePushModal(false);
    setIncomingExercise(null);
  };

  // Auto-accept effect
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

  return {
    joinedSessionCode,
    joinSessionInput,
    setJoinSessionInput,
    incomingExercise,
    showExercisePushModal,
    joinLiveSession,
    loading
  };
};
