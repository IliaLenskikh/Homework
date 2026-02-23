import React from 'react';
import { UserProfile } from '../types';

interface OnlineStatusBarProps {
  userProfile: UserProfile;
  onlineUsers: Record<string, any>;
}

export const OnlineStatusBar: React.FC<OnlineStatusBarProps> = ({ userProfile, onlineUsers }) => {
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
