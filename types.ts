


export interface Task {
  word: string;
  answer: string;
}

export interface ReadingText {
  letter: string;
  content: string;
}

export interface TrueFalseQuestion {
  id: number;
  text: string;
  options: string[];
  answer: number; // 1 = True, 2 = False, 3 = Not Stated (or 1,2,3 for A,B,C)
}

// Transcript Types
export interface TranscriptSegment {
  time: number;
  speaker: string;
  text: string;
}

export interface TranscriptItem {
  text_id: string;
  start: number;
  end: number;
  segments: TranscriptSegment[];
}

export interface Transcript {
  id: string;
  title: string;
  items: TranscriptItem[];
  meta?: any;
}

export interface Story {
  title: string;
  template: string[]; // For Reading Matching: List of Headings. For Grammar: Sentences.
  tasks: Task[]; // Grammar/Vocab tasks
  
  // Reading (Matching)
  texts?: ReadingText[];
  readingAnswers?: { [key: string]: number[] };

  // Reading (True/False) and Speaking and Listening
  text?: string; // The main long text or Transcript
  questions?: TrueFalseQuestion[];

  // Listening Transcript Data
  transcript?: Transcript;

  // Speaking Specific
  speakingType?: 'read-aloud' | 'interview' | 'monologue';
  audioUrl?: string; // URL for the audio question (Interview) or Listening track
  speakingQuestions?: string[]; // List of questions/points for Monologue

  // Writing (Email)
  emailSender?: string;
  emailSubject?: string;
  emailBody?: string;

  // Composite Stories (e.g. Full Listening Exam)
  subStories?: Story[];
}

export enum ExerciseType {
  GRAMMAR = 'GRAMMAR',
  VOCABULARY = 'VOCABULARY',
  READING = 'READING',
  LISTENING = 'LISTENING', // New Section
  SPEAKING = 'SPEAKING', // Phonetics (Read Aloud)
  ORAL_SPEECH = 'ORAL_SPEECH', // New Speaking Section (Interview/Monologue)
  WRITING = 'WRITING'
}

export interface UserProgress {
  [key: string]: string; // key is task index/ID, value is user input
}

export interface ValidationState {
  [key: string]: boolean | null; // true = correct, false = incorrect, null = unmatched
}

export type UserRole = 'student' | 'teacher';

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  teacherEmail: string;
  role?: UserRole;
  completed_stories?: string[];
}

// New types for detailed tracking
export interface AttemptDetail {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null; // null for pending review
  context?: string; // For context sentences
  audioUrl?: string; // URL to the recorded audio
  wordCount?: number; // Word count for writing tasks
}

export interface TeacherFeedback {
  id: string;
  attempt_id: string;
  teacher_id: string;
  feedback_text: string;
  audio_score?: number;
  created_at: string;
}

export interface StudentResult {
  id: string;
  student_id: string;
  exercise_title: string;
  exercise_type: ExerciseType;
  score: number;
  max_score: number;
  details: AttemptDetail[];
  created_at: string;
  feedback?: TeacherFeedback; // Optional joined feedback
  student_name?: string; // For dashboard display
  student_email?: string; // For dashboard display
}

export interface HomeworkAssignment {
  id: string;
  teacher_id: string;
  student_id: string;
  exercise_title: string;
  exercise_type: ExerciseType;
  due_date: string;
  status: 'pending' | 'completed' | 'overdue';
  instructions?: string;
  created_at: string;
  completed_at?: string;
  score?: number;
  max_score?: number;
}

export interface LiveSession {
  studentId: string;
  studentName: string;
  exerciseTitle: string;
  exerciseType: ExerciseType;
  currentQuestion: string;
  userInput: string;
  allAnswers: Record<string, string>; // Tracks ALL inputs, not just current one
  isCorrect: boolean | null;
  progressPercentage: number;
  startedAt: string;
  lastActivity: number;
}

export interface OnlineUser {
  id: string;
  name: string;
  role: string;
  online_at: string;
}

export interface TrackedStudent {
  id: string;
  email: string;
  name: string;
  completedCount: number;
  totalTasks: number;
  pendingHomeworkCount?: number;
  isOnline?: boolean;
}

export interface ToastMsg {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
