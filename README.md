
# OGE English Prep AI

A comprehensive web application designed to help students prepare for the OGE (Basic State Exam) in English. The app features interactive exercises for Grammar, Vocabulary, Reading, Listening, Speaking, and Writing.

## Features

- **Grammar & Vocabulary**: Interactive gap-fill exercises with instant validation.
- **Reading**: 
  - True/False/Not Stated tasks.
  - Matching Headings tasks.
- **Listening**: Audio comprehension tasks with a custom sticky player.
- **Speaking**:
  - **Read Aloud**: Timer and voice recording.
  - **Monologue**: Guided speaking with timer.
  - **Interview**: Simulated telephone survey with audio prompts and recording.
- **Writing**: Email drafting interface with word count and checklist.
- **Teacher Dashboard**: Track student progress and review attempts (including audio recordings).
- **AI Integration**: Explanations for answers provided by Google Gemini.

## Tech Stack

- **Frontend**: React, Tailwind CSS
- **Backend / Storage**: Supabase
- **AI**: Google GenAI SDK (Gemini)

## Setup

1. Ensure you have the required environment variables set (e.g., `API_KEY` for Gemini).
2. The project relies on Supabase for data persistence and storage. Ensure your Supabase project is configured with the necessary tables (`profiles`, `student_results`) and storage buckets (`audio-responses`, `public_assets`).

## Usage

- **Students**: Log in or register to start practicing. Your progress is saved automatically.
- **Teachers**: Select "Teacher" role during registration to access the dashboard and track your students by email.
