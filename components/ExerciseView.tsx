
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Story, ExerciseType, UserProgress, ValidationState, UserProfile, AttemptDetail } from '../types';
import { getExplanation } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface ExerciseViewProps {
  story: Story;
  type: ExerciseType;
  onBack: () => void;
  onComplete: (score: number, maxScore: number, details: AttemptDetail[]) => void;
  userProfile?: UserProfile;
}

const ExerciseView: React.FC<ExerciseViewProps> = ({ story, type, onBack, onComplete, userProfile }) => {
  const [inputs, setInputs] = useState<UserProgress>({});
  const [validation, setValidation] = useState<ValidationState>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<{[key: string]: string}>({});
  const [checkedSections, setCheckedSections] = useState<{[key: number]: boolean}>({});
  const [showTranscript, setShowTranscript] = useState<{[key: number]: boolean}>({});
  
  // Speaking State - General
  const [speakingPhase, setSpeakingPhase] = useState<'IDLE' | 'PREPARING' | 'RECORDING' | 'FINISHED' | 'UPLOADING'>('IDLE');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Interview Specific State
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false); 
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Listening Sticky Player State
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const stickyAudioRef = useRef<HTMLAudioElement | null>(null);

  // Derive listening audio URL directly from story, independent of type
  const listeningAudioUrl = useMemo(() => {
      // Prioritize parent audioUrl if available (for single-file exams)
      return story.audioUrl || story.subStories?.[0]?.audioUrl || null;
  }, [story]);

  // Audio Recording State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [mimeType, setMimeType] = useState<string>(''); 
  
  // Writing State
  const [emailContent, setEmailContent] = useState('');
  const [wordCount, setWordCount] = useState(0);

  // --- Real-time Broadcasting Logic ---
  const broadcastChannelRef = useRef<any>(null);
  const lastBroadcastRef = useRef<number>(0);

  useEffect(() => {
    // Only broadcast if user is a student and has a profile
    if (userProfile?.role === 'student' && userProfile.id) {
        const channelName = `live_session_${userProfile.id}`;
        const channel = supabase.channel(channelName);
        
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'session_started',
                    payload: {
                        studentId: userProfile.id,
                        studentName: userProfile.name,
                        exerciseTitle: story.title,
                        exerciseType: type,
                        startedAt: new Date().toISOString()
                    }
                });
            }
        });

        broadcastChannelRef.current = channel;

        return () => {
            if (broadcastChannelRef.current) {
                // Best effort to send end event
                broadcastChannelRef.current.send({
                    type: 'broadcast',
                    event: 'session_ended',
                    payload: { studentId: userProfile.id, endedAt: new Date().toISOString() }
                });
                supabase.removeChannel(broadcastChannelRef.current);
            }
        };
    }
  }, [userProfile, story.title, type]);

  const broadcastTyping = (questionId: string, input: string, isCorrect: boolean | null) => {
      if (!broadcastChannelRef.current || !userProfile?.id) return;

      const now = Date.now();
      // Simple throttle: max 1 event per 500ms to avoid flooding
      if (now - lastBroadcastRef.current > 500) {
          // Calculate roughly progress
          const totalQuestions = Object.keys(inputs).length > 0 ? Object.keys(inputs).length : 1; 
          // Note: totalQuestions calculation is approximate here for simplicity
          const progressPercentage = Math.min(100, Math.round((Object.keys(inputs).length / 10) * 10)); 

          broadcastChannelRef.current.send({
              type: 'broadcast',
              event: 'typing',
              payload: {
                  studentId: userProfile.id,
                  questionId,
                  input,
                  isCorrect,
                  timestamp: now,
                  progressPercentage
              }
          });
          lastBroadcastRef.current = now;
      }
  };

  useEffect(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4', 
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    const supported = types.find(t => MediaRecorder.isTypeSupported(t));
    if (supported) {
      setMimeType(supported);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
    };
  }, [type, story, listeningAudioUrl]);

  // Force load audio when URL changes to prevent stale state errors
  useEffect(() => {
      if (stickyAudioRef.current && listeningAudioUrl) {
          stickyAudioRef.current.load();
          setAudioError(null);
          setIsAudioPlaying(false);
      }
  }, [listeningAudioUrl]);

  // --- Sticky Player Logic ---
  
  const handlePlayPause = () => {
      if (!stickyAudioRef.current || !listeningAudioUrl) return;

      if (isAudioPlaying) {
          stickyAudioRef.current.pause();
          setIsAudioPlaying(false);
      } else {
          setAudioError(null);
          const playPromise = stickyAudioRef.current.play();
          if (playPromise !== undefined) {
              playPromise
                .then(() => setIsAudioPlaying(true))
                .catch(error => {
                  console.error("Play failed:", error);
                  setIsAudioPlaying(false);
                  setAudioError("Playback failed. Please try again.");
              });
          }
      }
  };

  const handleSeek = (seconds: number) => {
      if (!stickyAudioRef.current) return;
      const newTime = stickyAudioRef.current.currentTime + seconds;
      // Clamp between 0 and duration
      stickyAudioRef.current.currentTime = Math.max(0, Math.min(newTime, stickyAudioRef.current.duration || Infinity));
  };

  const handleSeekToTime = (time: number) => {
      if (stickyAudioRef.current) {
          stickyAudioRef.current.currentTime = time;
          if (!isAudioPlaying) {
              stickyAudioRef.current.play().then(() => setIsAudioPlaying(true)).catch(e => console.error(e));
          }
      }
  };

  const handleTimeUpdate = () => {
      if (stickyAudioRef.current) {
          setCurrentAudioTime(stickyAudioRef.current.currentTime);
          if (!isNaN(stickyAudioRef.current.duration) && stickyAudioRef.current.duration !== Infinity) {
            setAudioDuration(stickyAudioRef.current.duration);
          }
      }
  };

  const formatAudioTime = (time: number) => {
      if (!time || isNaN(time)) return "0:00";
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleTranscript = (index: number) => {
      setShowTranscript(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // --- Speaking Logic ---

  const startReadAloudPreparation = () => {
    setSpeakingPhase('PREPARING');
    setTimer(90); 
    startTimer(90, () => setSpeakingPhase('IDLE')); 
  };

  const startReadAloudRecording = () => {
    setSpeakingPhase('RECORDING');
    setTimer(120); 
    startTimer(120, finishSpeaking);
  };

  const startMonologuePreparation = () => {
      setSpeakingPhase('PREPARING');
      setTimer(90); 
      startTimer(90, () => setSpeakingPhase('IDLE')); 
  }

  const startMonologueRecordingSession = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const options = mimeType ? { mimeType } : undefined;
          const mediaRecorder = new MediaRecorder(stream, options);
          
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = () => {
              stream.getTracks().forEach(track => track.stop());
              handleAudioUpload();
          };

          mediaRecorder.start();
          setSpeakingPhase('RECORDING');
          setTimer(120); 
          startTimer(120, stopRecording); 

      } catch (err) {
          console.log("Microphone access denied or error.");
          alert("Could not access microphone. Please allow permissions.");
      }
  };

  // Simplified toggle logic for Interview Mode
  const toggleInterviewRecording = async () => {
      // Initial Setup if recorder doesn't exist
      if (!mediaRecorderRef.current) {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const options = mimeType ? { mimeType } : undefined;
              const mediaRecorder = new MediaRecorder(stream, options);
              
              mediaRecorderRef.current = mediaRecorder;
              audioChunksRef.current = [];

              mediaRecorder.ondataavailable = (event) => {
                  if (event.data.size > 0) {
                      audioChunksRef.current.push(event.data);
                  }
              };

              // CRITICAL FIX: Upload ONLY when stop() is called and 'onstop' fires.
              mediaRecorder.onstop = () => {
                  stream.getTracks().forEach(track => track.stop());
                  handleAudioUpload();
              };

              // Start recording immediately
              mediaRecorder.start();
              setIsMicActive(true);
              // setSpeakingPhase('RECORDING'); // We don't strictly need to change phase for UI if we remove the IDLE screen
          } catch (err) {
              console.error("Microphone access error", err);
              alert("Could not access microphone. Please allow permissions.");
          }
          return;
      }

      // Resume/Pause Logic
      if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.pause();
          setIsMicActive(false);
      } else if (mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume();
          setIsMicActive(true);
      }
  };

  const handleFinishInterview = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          // This calls .stop(), which triggers 'onstop', which calls handleAudioUpload.
          mediaRecorderRef.current.stop(); 
          
          if (audioRef.current) {
              audioRef.current.pause();
          }
      } else if (audioChunksRef.current.length > 0) {
          // Fallback if somehow already stopped but not uploaded
          handleAudioUpload();
      } else {
          alert("No recording found to save.");
      }
  };

  const handleAudioUpload = async () => {
      setSpeakingPhase('UPLOADING');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const userIdentifier = userProfile?.email || userProfile?.id || 'anonymous';
      const cleanTitle = story.title.replace(/[^a-zA-Z0-9]/g, '_');
      
      let extension = 'webm';
      if (mimeType.includes('mp4')) extension = 'mp4';
      if (mimeType.includes('wav')) extension = 'wav';
      if (mimeType.includes('ogg')) extension = 'ogg';

      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
      let audioUrl = "";

      if (audioBlob.size > 0) {
          const fileName = `${userIdentifier}/${cleanTitle}/${timestamp}.${extension}`;
          try {
              const uploadContentType = mimeType.split(';')[0] || 'audio/webm';
              const { data, error } = await supabase.storage
                  .from('audio-responses')
                  .upload(fileName, audioBlob, {
                      upsert: true,
                      contentType: uploadContentType
                  });

              if (error) {
                  console.error("Upload failed: " + error.message);
              } else if (data) {
                  const { data: { publicUrl } } = supabase.storage
                      .from('audio-responses')
                      .getPublicUrl(fileName);
                  audioUrl = publicUrl;
              }
          } catch (e: any) {
              console.error("Upload error", e);
          }
      } else {
          console.warn("Audio blob size is 0");
      }

      const taskLabel = story.speakingType === 'monologue' 
        ? `Monologue: ${story.title}` 
        : 'Interview Session';

      let contextText = "";
      if (story.speakingQuestions && story.speakingQuestions.length > 0) {
          contextText = story.speakingQuestions.map((q, i) => `${i + 1}) ${q}`).join('\n');
      }

      const details: AttemptDetail[] = [{
          question: taskLabel,
          userAnswer: audioUrl ? "Recording Saved" : "Recording Failed / Empty",
          correctAnswer: "Teacher Review",
          isCorrect: true,
          audioUrl: audioUrl,
          context: contextText
      }];

      setSpeakingPhase('FINISHED');
      onComplete(10, 10, details);
  };

  const startTimer = (duration: number, onComplete: () => void) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(duration);
    timerRef.current = window.setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop(); 
      } else {
          finishSpeaking(); 
      }
  };

  const finishSpeaking = () => {
    setSpeakingPhase('FINISHED');
    if (timerRef.current) clearInterval(timerRef.current);
    onComplete(10, 10, [{ question: story.title, userAnswer: "Audio Recorded (Simulated)", correctAnswer: "Teacher Review", isCorrect: true }]);
  };

  // --- Input Logic ---
  
  const handleInputChange = (key: string, value: string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    broadcastTyping(key, value, null); // null correctness because we don't know yet
    if (validation[key] !== undefined) {
      setValidation(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleReadingSelection = (key: string, value: string) => {
    handleInputChange(key, value);
  };

  const handleTrueFalseSelection = (questionId: number, optionIndex: number) => {
    handleInputChange(questionId.toString(), (optionIndex + 1).toString());
  };

  const handleEmailChange = (text: string) => {
      setEmailContent(text);
      broadcastTyping("email", text, null);
      const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      setWordCount(count);
  }

  const handleSendEmail = () => {
    if (!userProfile?.teacherEmail) {
      alert("Please configure your Teacher's Email in Settings first.");
      return;
    }
    const subject = story.emailSubject || "OGE Writing Task";
    const body = `From: ${userProfile.email}\nStudent: ${userProfile.name}\n\nTask:\n${story.text}\n\nAnswer:\n${emailContent}`;
    const mailtoLink = `mailto:${userProfile.teacherEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
    onComplete(10, 10, [{ question: 'Email Task', userAnswer: emailContent, correctAnswer: 'See Teacher Email', isCorrect: true }]);
    onBack();
  };

  const checkAnswers = () => {
    if (type === ExerciseType.WRITING) {
        handleSendEmail();
        return;
    }
    if (type === ExerciseType.SPEAKING || type === ExerciseType.ORAL_SPEECH) {
        onComplete(10, 10, []);
        onBack();
        return;
    }

    let correctCount = 0;
    let maxScore = 0;
    const newValidation: ValidationState = {};
    const attemptDetails: AttemptDetail[] = [];

    const checkStory = (s: Story, prefix: string = '') => {
        if (s.texts && s.readingAnswers) {
            maxScore += s.texts.length;
            s.texts.forEach((text) => {
                const key = prefix + text.letter;
                const userChoice = inputs[key];
                const correctAnswers = s.readingAnswers![text.letter];
                const userNum = parseInt(userChoice || "-1");
                const isCorrect = correctAnswers.includes(userNum);
                newValidation[key] = isCorrect;
                if (isCorrect) correctCount++;

                const getHeading = (idx: number) => s.template[idx - 1] || "Unknown";
                attemptDetails.push({
                    question: `Item ${text.letter} (${text.content.substring(0,20)}...)`,
                    userAnswer: userNum > 0 ? `${userNum}. ${getHeading(userNum)}` : "No Answer",
                    correctAnswer: `${correctAnswers[0]}. ${getHeading(correctAnswers[0])}`,
                    isCorrect: isCorrect,
                    context: "Matching Task"
                });
            });
        } 
        else if (s.questions) {
            maxScore += s.questions.length;
            s.questions.forEach(q => {
                const key = prefix + q.id.toString();
                const userVal = parseInt(inputs[key] || "0");
                const isCorrect = userVal === q.answer;
                newValidation[key] = isCorrect;
                if(isCorrect) correctCount++;

                const label = q.options[userVal - 1] || "No Answer";
                const correctLabel = q.options[q.answer - 1] || "";
                attemptDetails.push({
                    question: q.text,
                    userAnswer: label,
                    correctAnswer: correctLabel,
                    isCorrect: isCorrect,
                    context: "Multiple Choice Task"
                });
            });
        }
        else if (s.tasks) {
            maxScore += s.tasks.length;
            s.tasks.forEach((task, index) => {
                const key = prefix + index.toString();
                const userVal = inputs[key]?.trim() || "";
                const correctVal = task.answer;
                const isCorrect = userVal.toLowerCase() === correctVal.toLowerCase();
                newValidation[key] = isCorrect;
                if (isCorrect) correctCount++;

                attemptDetails.push({
                    question: type === ExerciseType.LISTENING ? task.word : `Transform: ${task.word}`,
                    userAnswer: userVal,
                    correctAnswer: correctVal,
                    isCorrect: isCorrect,
                    context: "Gap Fill / Transformation"
                });
            });
        }
    };

    if (story.subStories) {
        story.subStories.forEach((subStory, index) => {
            checkStory(subStory, `section_${index}_`);
        });
    } else {
        checkStory(story);
    }

    setScore(correctCount);
    setValidation(newValidation);
    setShowResults(true);
    
    // Only call onComplete if we are checking everything at the end
    onComplete(correctCount, maxScore, attemptDetails);
  };

  const handleCheckSection = (index: number) => {
      const subStory = story.subStories![index];
      const prefix = `section_${index}_`;
      const newValidation = { ...validation };
      let sectionCorrect = 0;

      // Logic copied/adapted from checkStory
      if (subStory.texts && subStory.readingAnswers) {
          subStory.texts.forEach((text) => {
              const key = prefix + text.letter;
              const userChoice = inputs[key];
              const correctAnswers = subStory.readingAnswers![text.letter];
              const userNum = parseInt(userChoice || "-1");
              const isCorrect = correctAnswers.includes(userNum);
              newValidation[key] = isCorrect;
              if (isCorrect) sectionCorrect++;
          });
      } else if (subStory.questions) {
          subStory.questions.forEach(q => {
              const key = prefix + q.id.toString();
              const userVal = parseInt(inputs[key] || "0");
              const isCorrect = userVal === q.answer;
              newValidation[key] = isCorrect;
              if(isCorrect) sectionCorrect++;
          });
      } else if (subStory.tasks) {
          subStory.tasks.forEach((task, idx) => {
              const key = prefix + idx.toString();
              const userVal = inputs[key]?.trim() || "";
              const correctVal = task.answer;
              const isCorrect = userVal.toLowerCase() === correctVal.toLowerCase();
              newValidation[key] = isCorrect;
              if(isCorrect) sectionCorrect++;
          });
      }

      setValidation(newValidation);
      setCheckedSections(prev => ({ ...prev, [index]: true }));
      
      // Recalculate total score based on all validations
      const totalCorrect = Object.values(newValidation).filter(v => v === true).length;
      setScore(totalCorrect);
  };

  const handleAskAI = async (key: string, storyRef: Story) => {
    setLoadingExplanation(key);
    let explanation = "";
    if (type === ExerciseType.READING && storyRef.questions) {
        const qId = key.replace(/section_\d+_/, '');
        const q = storyRef.questions.find(q => q.id.toString() === qId);
        if (q && storyRef.text) {
            const userVal = parseInt(inputs[key] || "0");
            const options = ["True", "False", "Not Stated"];
            const userLabel = userVal > 0 ? options[userVal-1] : "No Answer";
            const correctLabel = options[q.answer-1];
            const statementStr = `Statement: "${q.text}" | Student chose: ${userLabel}`;
            explanation = await getExplanation(storyRef.text, "True/False Task", statementStr, correctLabel, type);
        }
    } else {
       explanation = await getExplanation("Context not available", "Task", "Incorrect", "Correct", type);
    }
    setExplanations(prev => ({ ...prev, [key]: explanation }));
    setLoadingExplanation(null);
  };

  // --- Rendering Sub-Components ---

  const renderWritingLayout = () => {
      return (
          <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px] lg:h-[calc(100vh-200px)]">
             <div className="lg:w-1/3 order-2 lg:order-1 flex flex-col gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1">
                   <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Task</h3>
                   <div className="prose prose-sm text-slate-600 mb-6">
                      <p className="whitespace-pre-line leading-relaxed">{story.text}</p>
                   </div>
                   <div className="border-t border-slate-100 pt-4">
                      <h4 className="font-bold text-slate-800 text-xs uppercase mb-3">Checklist</h4>
                      <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                             <div className={`w-3 h-3 rounded-full ${wordCount >= 100 && wordCount <= 120 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                             <span className="flex-1">Word count: <span className="font-mono font-bold text-slate-800">{wordCount}</span> / 100-120</span>
                          </div>
                       </div>
                   </div>
                </div>
             </div>

             <div className="lg:w-2/3 order-1 lg:order-2 flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                   <h2 className="text-lg font-bold text-slate-800">{story.emailSubject}</h2>
                   <span className="text-xs text-slate-400">Draft</span>
                </div>
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar p-6">
                   <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-baseline mb-2">
                         <span className="font-bold text-slate-900">{story.emailSender}</span>
                         <span className="text-xs text-slate-400">Today, 10:30 AM</span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-line leading-relaxed">{story.emailBody}</p>
                   </div>

                   <div className="relative group">
                      <div className="mb-2 text-xs text-slate-400 flex justify-between">
                         <span>To: {userProfile?.teacherEmail}</span>
                      </div>
                      <textarea
                         className="w-full min-h-[300px] p-4 text-slate-800 text-lg leading-relaxed outline-none resize-none border-2 border-transparent focus:border-indigo-100 rounded-xl transition-all bg-slate-50 focus:bg-white"
                         placeholder="Write your reply..."
                         value={emailContent}
                         onChange={(e) => handleEmailChange(e.target.value)}
                      />
                   </div>
                </div>
             </div>
          </div>
      )
  };

  const renderSpeaking = () => {
      const subtype = story.speakingType || 'read-aloud';

      if (type === ExerciseType.SPEAKING || subtype === 'read-aloud') {
          return (
              <div className="max-w-3xl mx-auto py-10">
                  <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 mb-8 flex flex-col md:flex-row justify-between items-center gap-8">
                      <div className="flex items-center gap-6">
                          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-[6px] transition-all duration-500 font-mono
                              ${speakingPhase === 'PREPARING' ? 'border-amber-400 text-amber-600 scale-110' :
                                speakingPhase === 'RECORDING' ? 'border-rose-500 text-rose-600 scale-110 animate-pulse' :
                                speakingPhase === 'FINISHED' ? 'border-emerald-400 text-emerald-600' :
                                'border-slate-100 text-slate-300'}
                          `}>
                              {String(Math.floor(timer/60))}:{String(timer%60).padStart(2,'0')}
                          </div>
                          <div>
                              <div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Task 1: Read Aloud</div>
                              <div className="font-bold text-2xl text-slate-800">
                                  {speakingPhase === 'IDLE' && 'Ready to start?'}
                                  {speakingPhase === 'PREPARING' && 'Prepare...'}
                                  {speakingPhase === 'RECORDING' && 'Recording!'}
                                  {speakingPhase === 'FINISHED' && 'Done'}
                              </div>
                          </div>
                      </div>

                      <div className="flex gap-4">
                          {speakingPhase === 'IDLE' && (
                              <button onClick={startReadAloudPreparation} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95">Start Preparation</button>
                          )}
                          {speakingPhase === 'PREPARING' && (
                              <button onClick={() => { setSpeakingPhase('IDLE'); }} className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-6 py-4 rounded-2xl font-bold transition-all">Wait...</button>
                          )}
                          {speakingPhase === 'IDLE' && timer === 0 && (
                              <button onClick={startReadAloudRecording} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95">Start Recording</button>
                          )}
                          {speakingPhase === 'RECORDING' && (
                              <button onClick={finishSpeaking} className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95">Stop Recording</button>
                          )}
                      </div>
                  </div>
                  <div className={`bg-white p-10 md:p-14 rounded-3xl shadow-sm border transition-all duration-500 ${speakingPhase === 'RECORDING' ? 'border-rose-200 ring-4 ring-rose-50' : 'border-slate-100'}`}>
                      <p className="text-xl md:text-2xl leading-[2] text-slate-800 font-medium">{story.text}</p>
                  </div>
              </div>
          );
      }

      if (subtype === 'interview') {
          return (
              <div className="max-w-3xl mx-auto py-10">
                  {/* Exposed Audio Player so user can listen to the question */}
                  {story.audioUrl && (
                      <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                          <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Audio Question</p>
                          <audio ref={audioRef} controls src={story.audioUrl} className="w-full" />
                      </div>
                  )}
                  
                  <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 mb-8 text-center flex flex-col items-center">
                      <h2 className="text-2xl font-bold text-slate-900 mb-4">{story.title}</h2>
                      <p className="text-slate-500 text-sm mb-8 max-w-lg leading-relaxed">
                          Listen to the question above, then press <b>Record</b> to answer. <br/>Press <b>Stop</b> to finish your answer and wait for the next question.
                      </p>

                      {speakingPhase === 'UPLOADING' ? (
                          <div className="animate-pulse py-10 text-slate-500 font-bold">Saving...</div>
                      ) : (
                          <div className="flex flex-col items-center justify-center gap-6 w-full">
                              {/* Status Pill */}
                              {isMicActive && (
                                <div className="animate-pulse bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-rose-100 shadow-sm">
                                    ИДЕТ ЗАПИСЬ
                                </div>
                              )}

                              {/* Main Control Button */}
                              <button 
                                onClick={toggleInterviewRecording} 
                                className={`w-32 h-32 rounded-full flex flex-col items-center justify-center border-[6px] transition-all duration-300 shadow-xl hover:scale-105 active:scale-95 ${
                                    isMicActive 
                                        ? 'bg-rose-500 border-rose-200 shadow-rose-200' 
                                        : 'bg-white border-slate-100 text-rose-500'
                                }`}
                              >
                                  {isMicActive ? (
                                      <div className="flex flex-col items-center gap-1">
                                          <div className="w-8 h-8 bg-white rounded-md shadow-sm"></div>
                                          <span className="text-white font-bold text-[10px] uppercase tracking-widest mt-1">СТОП</span>
                                      </div>
                                  ) : (
                                      <div className="flex flex-col items-center gap-1">
                                          <div className="w-8 h-8 bg-rose-500 rounded-full shadow-sm"></div>
                                          <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">НАЧАТЬ ЗАПИСЬ</span>
                                      </div>
                                  )}
                              </button>

                              {/* Finish Button */}
                              {audioChunksRef.current.length > 0 && !isMicActive && (
                                  <button onClick={handleFinishInterview} className="text-slate-400 hover:text-slate-600 text-sm font-bold underline mt-4">
                                      Finish & Save
                                  </button>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          );
      }

      if (subtype === 'monologue') {
          return (
              <div className="max-w-4xl mx-auto py-10 grid md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <h2 className="text-xl font-bold text-slate-900 mb-4">{story.title}</h2>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <p className="text-slate-700 font-medium mb-4">{story.text}</p>
                          <ul className="space-y-2">
                              {story.speakingQuestions?.map((q, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-slate-700 text-sm">
                                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                                      {q}
                                  </li>
                              ))}
                          </ul>
                      </div>
                  </div>
                  <div className="flex flex-col justify-center gap-6 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
                      <div className="text-4xl font-bold font-mono mb-6">{String(Math.floor(timer/60))}:{String(timer%60).padStart(2,'0')}</div>
                      {speakingPhase === 'IDLE' && (
                          <button onClick={startMonologuePreparation} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg">Start Preparation</button>
                      )}
                      {speakingPhase === 'PREPARING' && (
                          <button onClick={() => setSpeakingPhase('IDLE')} className="bg-emerald-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg">Start Recording</button>
                      )}
                      {speakingPhase === 'IDLE' && timer === 0 && (
                           <button onClick={startMonologueRecordingSession} className="bg-rose-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg">Start Recording</button>
                      )}
                      {speakingPhase === 'RECORDING' && (
                          <button onClick={stopRecording} className="bg-slate-800 text-white px-6 py-4 rounded-2xl font-bold shadow-lg">Finish</button>
                      )}
                  </div>
              </div>
          )
      }
      return null;
  }

  // --- Listening Specific Logic ---

  const renderSingleListeningTask = (subStory: Story, index: number) => {
      const prefix = `section_${index}_`;
      const isSectionChecked = checkedSections[index] || showResults;
      const isTranscriptVisible = showTranscript[index];

      return (
          <div key={index} className={`bg-white rounded-3xl p-8 shadow-sm border mb-10 border-slate-100`} id={`task-${index}`}>
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <div>
                      <h3 className="text-xl font-extrabold text-slate-900">{subStory.title}</h3>
                      <p className="text-slate-500 text-sm mt-1">{subStory.text}</p>
                  </div>
              </div>

              {/* Transcript Section */}
              {subStory.transcript && (
                  <div className="mb-8">
                      <button 
                          onClick={() => toggleTranscript(index)}
                          className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all border border-indigo-100"
                      >
                          <svg className={`w-4 h-4 transition-transform ${isTranscriptVisible ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          {isTranscriptVisible ? "Hide Transcript" : "Show Transcript"}
                      </button>

                      {isTranscriptVisible && (
                          <div className="mt-4 bg-slate-50 rounded-2xl border border-slate-200 p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                              <div className="space-y-6">
                                  {subStory.transcript.items.map((item, iIdx) => (
                                      <div key={iIdx} className="space-y-2">
                                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-200 pb-1">
                                              Part {item.text_id}
                                          </div>
                                          {item.segments.map((seg, sIdx) => {
                                              // Check if this segment is currently active
                                              const isActive = currentAudioTime >= seg.time && 
                                                  (sIdx < item.segments.length - 1 
                                                      ? currentAudioTime < item.segments[sIdx+1].time 
                                                      : currentAudioTime < item.end); // Last segment goes until item end

                                              return (
                                                  <div 
                                                      key={sIdx} 
                                                      onClick={() => handleSeekToTime(seg.time)}
                                                      className={`cursor-pointer transition-colors p-2 rounded-lg text-sm leading-relaxed ${
                                                          isActive 
                                                              ? 'bg-indigo-100 text-indigo-900 font-medium' 
                                                              : 'hover:bg-white text-slate-600'
                                                      }`}
                                                  >
                                                      <span className="text-xs text-slate-400 font-mono mr-2 select-none">
                                                          {formatAudioTime(seg.time)}
                                                      </span>
                                                      <span className={isActive ? '' : ''}>{seg.text}</span>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* 1. Multiple Choice */}
              {subStory.questions && (
                  <div className="grid gap-6">
                      {subStory.questions.map((q) => {
                          const key = prefix + q.id;
                          return (
                              <div key={q.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                  <div className="flex gap-4 mb-4">
                                      <span className="font-bold text-cyan-500 text-lg">{q.id}.</span>
                                      <p className="font-medium text-slate-800">{q.text}</p>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                                      {q.options.map((opt, idx) => {
                                          const isSelected = inputs[key] === (idx + 1).toString();
                                          const isThisCorrectOption = (idx + 1) === q.answer;
                                          let btnClass = "bg-white text-slate-600 border-slate-200 hover:border-cyan-300";
                                          
                                          if (isSectionChecked) {
                                              if (isSelected && isThisCorrectOption) btnClass = "bg-emerald-500 border-emerald-500 text-white";
                                              else if (isSelected) btnClass = "bg-rose-500 border-rose-500 text-white";
                                              else if (isThisCorrectOption) btnClass = "bg-transparent border-2 border-emerald-500 text-emerald-600";
                                              else btnClass = "opacity-50";
                                          } else if (isSelected) {
                                              btnClass = "bg-cyan-50 border-cyan-500 text-cyan-700 ring-1 ring-cyan-200";
                                          }

                                          return (
                                              <button
                                                  key={idx}
                                                  onClick={() => handleInputChange(key, (idx + 1).toString())}
                                                  disabled={isSectionChecked}
                                                  className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 text-left flex items-center gap-3 ${btnClass}`}
                                              >
                                                  <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs opacity-70 shrink-0">
                                                      {idx + 1}
                                                  </span>
                                                  {opt}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

              {/* 2. Matching */}
              {subStory.texts && subStory.readingAnswers && (
                  <div className="flex flex-col lg:flex-row gap-8">
                      <div className="lg:w-1/2">
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 sticky top-4">
                              <h4 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-3">Options</h4>
                              <div className="grid gap-2">
                                  {subStory.template.map((rubric, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700">
                                          <span className="font-bold text-cyan-600 mr-2">{idx + 1}.</span> {rubric}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                      <div className="lg:w-1/2 grid gap-4">
                          {subStory.texts.map((speakerItem) => {
                              const key = prefix + speakerItem.letter;
                              const correctAnswers = subStory.readingAnswers![speakerItem.letter];
                              const isCorrect = validation[key];

                              return (
                                  <div key={speakerItem.letter} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                                      <div className="flex items-center justify-between mb-3">
                                          <div className="font-bold text-slate-800 flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm">
                                                  {speakerItem.letter}
                                              </div>
                                              {speakerItem.content}
                                          </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                          {subStory.template.map((_, idx) => {
                                              const num = (idx + 1).toString();
                                              const isSelected = inputs[key] === num;
                                              const isThisCorrect = correctAnswers.includes(idx + 1);
                                              
                                              let btnClass = "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200";
                                              if (isSectionChecked) {
                                                  if (isSelected && isThisCorrect) btnClass = "bg-emerald-500 text-white border-emerald-500";
                                                  else if (isSelected) btnClass = "bg-rose-500 text-white border-rose-500";
                                                  else if (isThisCorrect && !isSelected) btnClass = "text-emerald-600 border-emerald-500 border-2";
                                                  else btnClass = "opacity-30";
                                              } else if (isSelected) {
                                                  btnClass = "bg-cyan-600 text-white border-cyan-600";
                                              }

                                              return (
                                                  <button
                                                      key={num}
                                                      onClick={() => handleInputChange(key, num)}
                                                      disabled={isSectionChecked}
                                                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${btnClass}`}
                                                  >
                                                      {num}
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              )}

              {/* 3. Table Completion */}
              {subStory.tasks && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50">
                              <tr>
                                  <th className="p-4 font-bold text-slate-600 border-b border-slate-200 w-1/2">Category</th>
                                  <th className="p-4 font-bold text-slate-600 border-b border-slate-200">Your Answer</th>
                              </tr>
                          </thead>
                          <tbody>
                              {subStory.tasks.map((task, idx) => {
                                  const key = prefix + idx.toString();
                                  const isCorrect = validation[key];
                                  return (
                                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                          <td className="p-4 text-slate-800 font-medium">{task.word}</td>
                                          <td className="p-4 relative">
                                              <input
                                                  type="text"
                                                  value={inputs[key] || ''}
                                                  onChange={(e) => handleInputChange(key, e.target.value)}
                                                  disabled={isSectionChecked}
                                                  className={`w-full px-3 py-2 rounded-lg border-2 outline-none font-bold transition-all ${
                                                      isCorrect === true ? 'border-emerald-400 bg-emerald-50 text-emerald-800' :
                                                      isCorrect === false ? 'border-rose-400 bg-rose-50 text-rose-800' :
                                                      'border-slate-200 focus:border-cyan-500 focus:bg-white'
                                                  }`}
                                              />
                                              {isSectionChecked && !isCorrect && (
                                                  <div className="text-xs text-emerald-600 mt-1 font-bold">
                                                      Answer: {task.answer}
                                                  </div>
                                              )}
                                          </td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              )}

              {/* Per-section Check Button */}
              <div className="mt-6 flex justify-end">
                  {!isSectionChecked && (
                      <button 
                          onClick={() => handleCheckSection(index)}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
                      >
                          Check This Section
                      </button>
                  )}
                  {isSectionChecked && !showResults && (
                      <div className="text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                          Section Checked
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderListening = () => {
      return (
          <div className="flex flex-col gap-4 max-w-5xl mx-auto pb-40 relative">
              {/* Sticky Player */}
              {listeningAudioUrl && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-4 z-50">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6 relative">
                        {audioError && (
                            <div className="absolute -top-12 left-0 right-0 bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold text-center border border-red-200 shadow-sm">
                                {audioError}
                            </div>
                        )}
                        
                        <audio 
                            ref={stickyAudioRef} 
                            key={listeningAudioUrl} // Force remount on URL change
                            src={listeningAudioUrl}
                            crossOrigin="anonymous" // Good practice
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={() => setIsAudioPlaying(false)}
                            onLoadedMetadata={handleTimeUpdate}
                            onError={(e) => {
                                const error = e.currentTarget.error;
                                let errorMsg = "Error playing audio.";
                                if (error) {
                                    if (error.code === 1) errorMsg = "Playback aborted.";
                                    if (error.code === 2) errorMsg = "Network error. Check connection.";
                                    if (error.code === 3) errorMsg = "Audio decoding failed.";
                                    if (error.code === 4) errorMsg = "Audio source not supported or not found (404).";
                                    console.error(`Audio Error Code: ${error.code}, Message: ${error.message}`);
                                } else {
                                    console.error("Unknown Audio Error", e);
                                }
                                setAudioError(errorMsg);
                                setIsAudioPlaying(false);
                            }}
                            preload="auto" // Changed from metadata to auto to ensure it tries to verify source
                        />
                        
                        {/* Audio Controls */}
                        <div className="flex items-center gap-4 md:gap-6 order-2 md:order-1">
                            {/* Seek -15s */}
                            <button onClick={() => handleSeek(-15)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-xs flex flex-col items-center gap-1 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                                -15s
                            </button>

                            {/* Seek -5s */}
                            <button onClick={() => handleSeek(-5)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-xs flex flex-col items-center gap-1 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                -5s
                            </button>

                            {/* Play / Pause */}
                            <button onClick={handlePlayPause} className="w-16 h-16 rounded-full bg-slate-900 hover:bg-indigo-600 text-white flex items-center justify-center hover:scale-105 transition-all shadow-lg shrink-0">
                                {isAudioPlaying ? (
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 9v6m4-6v6" /></svg>
                                ) : (
                                    <svg className="w-8 h-8 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                                )}
                            </button>

                            {/* Seek +5s */}
                            <button onClick={() => handleSeek(5)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-xs flex flex-col items-center gap-1 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                +5s
                            </button>

                            {/* Seek +15s */}
                            <button onClick={() => handleSeek(15)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-xs flex flex-col items-center gap-1 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                +15s
                            </button>
                        </div>

                        {/* Progress Bar & Time */}
                        <div className="flex-1 w-full order-1 md:order-2 px-2">
                            <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                                <span>{formatAudioTime(currentAudioTime)}</span>
                                <span>{formatAudioTime(audioDuration)}</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative group cursor-pointer border border-slate-200">
                                <div className="absolute top-0 left-0 bottom-0 bg-indigo-500 transition-all duration-100" style={{ width: `${(currentAudioTime / (audioDuration || 1)) * 100}%` }} />
                                <input type="range" min="0" max={audioDuration || 100} value={currentAudioTime} 
                                    onChange={(e) => { if (stickyAudioRef.current) stickyAudioRef.current.currentTime = Number(e.target.value); }}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
              )}
              
              {/* Render all sub-stories (Tasks) */}
              {story.subStories ? story.subStories.map((sub, idx) => renderSingleListeningTask(sub, idx)) : renderSingleListeningTask(story, 0)}
          </div>
      );
  };

  const renderGrammarTemplate = () => {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 md:p-12 leading-[2.5] text-lg text-slate-800 max-w-4xl mx-auto">
        {story.template.map((sentence, index) => {
          const parts = sentence.split(/\{(\d+)\}/);
          return (
            <span key={index}>
              {parts.map((part, partIndex) => {
                if (partIndex % 2 === 0) {
                  return <span key={partIndex}>{part}</span>;
                } else {
                  const taskIndex = parseInt(part);
                  const task = story.tasks[taskIndex];
                  const taskId = taskIndex.toString();
                  const isCorrect = validation[taskId];
                  const userAnswer = inputs[taskId] || '';
                  const hasValue = userAnswer.length > 0;
                  
                  return (
                    <span key={partIndex} className="inline-block mx-2 relative align-middle group">
                        <span className={`absolute left-0 text-[10px] font-bold tracking-wider text-indigo-500 bg-white px-1 transition-all duration-200 pointer-events-none z-10 ${hasValue ? '-top-3 opacity-100 scale-100' : 'top-2.5 opacity-0 scale-90'}`}>
                            {task.word}
                        </span>
                        <input type="text" value={userAnswer} onChange={(e) => handleInputChange(taskIndex.toString(), e.target.value)} placeholder={hasValue ? '' : task.word}
                            className={`h-10 px-3 min-w-[140px] text-center font-semibold rounded-lg border-2 outline-none transition-all duration-200 placeholder:text-slate-400 placeholder:font-bold placeholder:tracking-wide placeholder:uppercase placeholder:opacity-60 ${isCorrect === true ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : isCorrect === false ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                            disabled={showResults} autoComplete="off" spellCheck="false"
                        />
                        {showResults && !isCorrect && (
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-20 hidden group-hover:block w-48">
                                <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-sm text-center">
                                    <p className="font-bold mb-1 text-emerald-400">{task.answer}</p>
                                    <button onClick={() => handleAskAI(taskId, story)} className="text-[10px] text-slate-400 hover:text-white underline">
                                        {loadingExplanation === taskId ? 'Thinking...' : 'Why?'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </span>
                  );
                }
              })}
              {' '}
            </span>
          );
        })}
      </div>
    );
  };

  const renderReadingMatching = () => {
    return (
      <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
        <div className="lg:w-1/3 order-1 lg:order-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:sticky lg:top-24">
                <h3 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-wider">Headings</h3>
                <div className="grid gap-3">
                    {story.template.map((heading, idx) => (
                        <div key={idx} className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-amber-900 text-sm font-medium">
                            <span className="font-bold mr-2 text-amber-600">{idx + 1}.</span> {heading}
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <div className="lg:w-2/3 order-2 lg:order-1 grid gap-8">
            {story.texts?.map((textItem) => {
                const isCorrect = validation[textItem.letter];
                const correctAnswers = story.readingAnswers![textItem.letter];
                return (
                    <div key={textItem.letter} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 relative group hover:shadow-md transition-shadow">
                        <div className="absolute -left-4 -top-4 w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-lg shadow-lg rotate-3 group-hover:rotate-6 transition-transform">
                            {textItem.letter}
                        </div>
                        <p className="text-slate-700 leading-relaxed text-lg mb-6">{textItem.content}</p>
                        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-50">
                            <span className="text-xs font-bold text-slate-400 uppercase">Match:</span>
                            <div className="flex gap-2 flex-wrap justify-end">
                                {story.template.map((_, idx) => {
                                    const num = (idx + 1).toString();
                                    const isSelected = inputs[textItem.letter] === num;
                                    const isThisCorrect = correctAnswers.includes(idx + 1);
                                    let btnClass = "bg-slate-100 text-slate-500 hover:bg-slate-100 border-2 border-transparent";
                                    if (showResults) {
                                        if (isSelected && isThisCorrect) btnClass = "bg-emerald-500 text-white border-emerald-500";
                                        else if (isSelected) btnClass = "bg-rose-500 text-white border-rose-500";
                                        else if (isThisCorrect && !isSelected) btnClass = "text-emerald-600 border-emerald-500 border-2";
                                        else btnClass = "opacity-30";
                                    } else if (isSelected) {
                                        btnClass = "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200 border-indigo-600";
                                    }
                                    return (
                                        <button key={num} onClick={() => handleReadingSelection(textItem.letter, num)} disabled={showResults} className={`w-10 h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${btnClass}`}>
                                            {num}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    );
  };

  const renderTrueFalse = () => {
      return (
          <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)]">
              <div className="lg:w-1/2 h-full flex flex-col">
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-full overflow-y-auto custom-scrollbar">
                      <div className="prose prose-lg text-slate-700 leading-loose max-w-none">
                          <p className="whitespace-pre-line">{story.text}</p>
                      </div>
                  </div>
              </div>
              <div className="lg:w-1/2 flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-10">
                  {story.questions?.map((q) => {
                      const isCorrect = validation[q.id.toString()];
                      return (
                          <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                              <div className="flex gap-4 mb-4">
                                  <span className="font-bold text-indigo-100 text-xl">{q.id}.</span>
                                  <p className="font-medium text-slate-800 text-lg">{q.text}</p>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                  {q.options.map((opt, idx) => {
                                      const isSelected = inputs[q.id.toString()] === (idx + 1).toString();
                                      const isThisCorrectOption = (idx + 1) === q.answer;
                                      let btnClass = "bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300 hover:bg-white";
                                      if (showResults) {
                                          if (isSelected && isThisCorrectOption) btnClass = "bg-emerald-500 border-emerald-500 text-white shadow-md";
                                          else if (isSelected) btnClass = "bg-rose-500 border-rose-500 text-white shadow-md";
                                          else if (isThisCorrectOption && !isSelected) btnClass = "bg-transparent border-2 border-emerald-500 text-emerald-600 font-bold";
                                          else btnClass = "opacity-50";
                                      } else if (isSelected) {
                                          btnClass = "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-200";
                                      }
                                      return (
                                          <button key={idx} onClick={() => handleTrueFalseSelection(q.id, idx)} disabled={showResults} className={`py-3 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-2 ${btnClass}`}>
                                              {opt}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="pb-20">
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors group px-2 py-1 rounded-lg hover:bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </div>
            <span className="font-bold text-sm">Dashboard</span>
          </button>
          
          <h2 className="font-bold text-slate-800 truncate max-w-[200px] md:max-w-md text-lg">{story.title}</h2>

          <div className="flex items-center gap-4">
             {showResults && (
                 <div className="flex items-center gap-3 bg-slate-50 pl-4 pr-1 py-1 rounded-full border border-slate-100">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score</span>
                     <span className={`text-lg font-bold px-3 py-1 rounded-full ${score === Object.keys(validation).length ? 'bg-emerald-500 text-white' : 'bg-white text-slate-800 shadow-sm border border-slate-100'}`}>
                         {score} / {Object.keys(validation).length}
                     </span>
                 </div>
             )}
             {!showResults && type !== ExerciseType.SPEAKING && type !== ExerciseType.ORAL_SPEECH && (
                <button onClick={checkAnswers} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95">
                    {type === ExerciseType.WRITING ? 'Send to Teacher' : 'Check All Answers'}
                </button>
             )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!showResults && type !== ExerciseType.WRITING && type !== ExerciseType.SPEAKING && type !== ExerciseType.ORAL_SPEECH && type !== ExerciseType.LISTENING && (
            <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 mt-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <h4 className="font-bold text-indigo-900 text-sm mb-1">Instructions</h4>
                    <p className="text-indigo-800/80 text-sm leading-relaxed">
                        {type === ExerciseType.GRAMMAR ? "Transform the words in capital letters to complete the text grammatically." :
                         type === ExerciseType.VOCABULARY ? "Form new words from the capitalized ones to fit the context." :
                         type === ExerciseType.READING ? "Read the text carefully and answer the questions or match headings." :
                         "Follow the task guidelines."}
                    </p>
                </div>
            </div>
        )}
        
        {type === ExerciseType.WRITING && renderWritingLayout()}
        {(type === ExerciseType.SPEAKING || type === ExerciseType.ORAL_SPEECH) && renderSpeaking()}
        
        {(type === ExerciseType.GRAMMAR || type === ExerciseType.VOCABULARY) && renderGrammarTemplate()}
        
        {type === ExerciseType.READING && (
            story.questions ? renderTrueFalse() : renderReadingMatching()
        )}

        {type === ExerciseType.LISTENING && renderListening()}
      </div>
    </div>
  );
};

export default ExerciseView;
