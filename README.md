# OGE English Prep AI

A comprehensive, interactive web application designed to help students prepare for the **OGE (Basic State Exam) in English**. The platform connects students and teachers, offering practice materials for all exam sections with AI-powered feedback.

## 🌟 Key Features

### 🎓 Student Mode
*   **Complete Exam Practice**: Covers all sections of the OGE:
    *   **Listening**: Audio tasks with multiple-choice and gap-fill questions. Includes a sticky audio player and transcript toggle.
    *   **Reading**: Matching headings and True/False/Not Stated exercises.
    *   **Grammar & Vocabulary**: Gap-fill transformation tasks.
    *   **Speaking**: 
        *   *Task 1*: Read Aloud (with timer).
        *   *Task 2*: Telephone Survey (simulated audio interview with recording).
        *   *Task 3*: Monologue (guided speaking with timer).
    *   **Writing**: Email drafting with word count limits and task checklists.
*   **AI Tutor**: Instant explanations for incorrect Grammar and Reading answers powered by **Google Gemini**.
*   **Homework**: View and complete assignments sent by the teacher.
*   **Progress Tracking**: Visual indicators for completed tasks.

### 👨‍🏫 Teacher Mode
*   **Dashboard**: Centralized view to manage students.
*   **Student Tracking**: Add students by email to track their progress.
*   **Analytics**: View detailed statistics (completed tasks, average scores).
*   **Detailed Reports**: Inspect specific student attempts, including listening to their recorded Speaking answers.
*   **Homework Assignment**: Assign specific exercises with due dates and instructions.

### 🛠 Technical Features
*   **Authentication**: Secure email/password login via Supabase Auth.
*   **Role Switching**: Easy toggle between Student and Teacher profiles in Settings.
*   **Real-time Database**: Progress and assignments synced via Supabase.
*   **File Storage**: Audio recordings (Speaking tasks) stored in Supabase Storage.
*   **Responsive Design**: Mobile-friendly UI built with Tailwind CSS.

## 🚀 Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS
*   **Backend & Database**: Supabase (PostgreSQL)
*   **AI Integration**: Google GenAI SDK (Gemini 2.5)
*   **Icons**: Heroicons (via SVG)

## 📦 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd oge-english-prep
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Variables**
    Create a `.env` file in the root directory and add your keys:
    ```env
    # Google Gemini API Key
    VITE_API_KEY=your_gemini_api_key

    # Supabase Configuration
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

## 🗄️ Database Schema

The application requires the following Supabase tables:

*   **`profiles`**: Stores user roles (student/teacher), names, and completed story IDs.
*   **`student_results`**: Stores detailed attempts for exercises (score, answers, audio URLs).
*   **`homework_assignments`**: Links teachers to students with specific tasks and due dates.
*   **Storage Buckets**:
    *   `audio-responses`: For storing student speaking task recordings.

## 🤖 AI Features

The app uses `gemini-2.5-flash` to provide context-aware explanations.
*   **Grammar**: Explains why a specific transformation is required (e.g., Passive Voice, Tense usage).
*   **Reading**: Explains why a specific heading matches a text or why a statement is True/False based on the text context.

## 📝 License

ISC
