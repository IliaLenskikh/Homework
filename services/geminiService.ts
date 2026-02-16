import { GoogleGenAI } from "@google/genai";
import { ExerciseType } from '../types';

let aiClient: GoogleGenAI | null = null;

// Initialize the client safely
try {
  if (process.env.API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is missing. AI features will be disabled.");
  }
} catch (error) {
  console.error("Failed to initialize Gemini client:", error);
}

export const getExplanation = async (
  contextSentence: string,
  baseWord: string,
  userAnswer: string,
  correctAnswer: string,
  taskType: ExerciseType
): Promise<string> => {
  if (!aiClient) {
    return "API Key not configured. Please check your environment variables.";
  }

  let prompt = "";

  if (taskType === ExerciseType.READING) {
    // Check if it's a True/False task (baseWord will be "True/False Task")
    if (baseWord === "True/False Task") {
         prompt = `
      You are an expert English teacher helping a student with a Reading Comprehension task (True / False / Not Stated).
      
      The text provided: "${contextSentence}"
      
      The Statement: "${userAnswer}" (This is the statement the student evaluated)
      The Student's Answer: The student thought this was ${userAnswer.split('|')[1]} (Incorrect).
      The Correct Answer: This statement is actually ${correctAnswer}.
      
      Explain briefly why the correct answer is ${correctAnswer} based on the text. 
      If it is "False", cite the contradiction. 
      If it is "Not Stated", explain that the text does not contain this specific information.
      If it is "True", quote the supporting sentence.
    `;
    } else {
        // Matching Headings
        prompt = `
        You are an expert English teacher helping a student with a Reading Comprehension task (Matching Headings).
        
        The student incorrectly matched a heading to a text.
        
        The Text Paragraph: "${contextSentence}"
        The Heading the student chose (Incorrect): "${userAnswer}"
        The Correct Heading: "${correctAnswer}"
        
        Explain briefly why the Correct Heading fits this text better than the one the student chose. Point out specific keywords or synonyms in the text that link to the correct heading.
        `;
    }
  } else {
    prompt = `
      You are an expert English teacher. 
      The student is doing a ${taskType.toLowerCase()} exercise.
      
      Context sentence: "${contextSentence}"
      Base word to transform: "${baseWord}"
      Student's incorrect answer: "${userAnswer}"
      Correct answer: "${correctAnswer}"

      Please explain briefly (in 1-2 sentences) why "${correctAnswer}" is correct and why "${userAnswer}" is incorrect. 
      Focus on the specific grammar rule or word formation rule.
      Be encouraging but direct.
    `;
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Could not generate explanation.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I couldn't connect to the AI tutor right now.";
  }
};