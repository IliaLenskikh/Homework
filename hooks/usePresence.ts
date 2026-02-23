import { useState, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { UserProfile, OnlineUser } from '../types';

export const usePresence = (userProfile: UserProfile) => {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, OnlineUser>>({});

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

  return { onlineUsers };
};
