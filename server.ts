import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy-initialized Gemini API client wrapper
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = "AQ.Ab8RN6LkkaIw8umm1RiJv3NraaUIx5oQbXA13G7aABOchptzpA";
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please add it in the Secrets panel in AI Studio.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Endpoint to generate Khmer lesson plan with Gemini
app.post("/api/generate-lesson", async (req, res) => {
  try {
    const { subject, grade, lessonContent, duration, methodology, file, files } = req.body;

    const hasFiles = (file && file.data && file.mimeType) || (files && Array.isArray(files) && files.length > 0);
    if (!lessonContent && !hasFiles) {
      return res.status(400).json({ error: "Lesson content / topic or uploaded document is required." });
    }

    const ai = getAI();

    // Prepare contents array for multimodal Gemini call
    const parts: any[] = [];

    // Add file inline attachment if present (single file fallback)
    if (file && file.data && file.mimeType) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    }

    // Add multiple files inline attachments if present
    if (files && Array.isArray(files)) {
      files.forEach((f: any) => {
        if (f && f.data && f.mimeType) {
          parts.push({
            inlineData: {
              mimeType: f.mimeType,
              data: f.data
            }
          });
        }
      });
    }

    // Add core detailed instruction text
    const textPrompt = `You are an expert Cambodian school teacher and pedagogical developer. 
Your task is to automatically draft a highly professional Khmer lesson plan (កិច្ចតែងការបង្រៀន) based on the inputs below.
The response must be in Khmer language, follow standard Cambodian teaching guide protocols, and contain professional, beautiful pedagogical language.

Inputs:
- Subject (មុខវិជ្ជា): ${subject || "កុំព្យូទ័រ"}
- Grade (ថ្នាក់ទី): ${grade || "៧"}
- Primary Lesson Content/Topic (ខ្លឹមសារមេរៀន/ប្រធានបទ): ${lessonContent || "ខ្លឹមសារពីឯកសារភ្ជាប់ (Attached document)"}
- Duration (រយៈពេល): ${duration || "៥០នាទី"}
- Methodology (វិធីសាស្ត្រ): ${methodology || "គោលវិធីសិស្សមជ្ឈមណ្ឌល"}

${hasFiles ? `CRITICAL: Input documents / images / PDF containing the lesson materials are attached above. Smartly analyze their contents, extract topics, concepts, equations, text, or structure, and convert them into a beautiful, fully drafted 5-step Cambodian school lesson plan.` : `CRITICAL: Smartly analyze the text input "lessonContent" and translate it into a fully structured, excellent 5-step Cambodian school lesson plan.`}

Pedagogical Structure & Guidelines:
0. Lesson Review (ផ្នែករំឭកមេរៀន): Generate a summary statement or short list of concepts being reviewed from previous lessons to connect to this new lesson (e.g. "គំនូសតាង (Charts) និងការប្តូរប្រាក់រៀល-ដុល្លារ" or similar based on content). Keep it concise.
1. Objectives (វត្ថុបំណង) MUST follow this strict structural ordering (លំដាប់លំដោយរៀបចំវត្ថុបំណង):
   [សកម្មភាពជាមួយខ្លឹមសារ (Active Verb + Lesson Content)] + [កម្រិតលទ្ធផល (Standard of Outcome, e.g. បានត្រឹមត្រូវ)] + [លក្ខខណ្ឌ (Condition, e.g. តាមរយៈការសង្កេតរូបភាព)]

   CRITICAL RULES:
   - Absolutely REMOVE the word "សិស្សនឹងអាច" or "សិស្សអាច" or "សិស្ស" or any student identifier from the objectives completely. Show only the active verb first!
   - Every objective statement must start directly with an active verb.
   - វិជ្ជាសម្បទា (Knowledge): Use verbs like "រៀបរាប់", "បង្ហាញ", "ពណ៌នា", "និយាយ", "កំណត់", "ប្រាប់". Format: "- [សកម្មភាព] [ខ្លឹមសារ] [កម្រិតលទ្ធផល] តាមរយៈ [លក្ខខណ្ឌ]"
     E.g., "- បង្ហាញពីរបៀបគណនាផ្ទៃក្រឡាបានត្រឹមត្រូវតាមរយៈការសង្កេតរូបភាព។" or "- រៀបរាប់ពីសារធាតុចិញ្ចឹមបានច្បាស់លាស់តាមរយៈខ្លឹមសារមេរៀន។"
   - បំណិនសម្បទា (Skills): Use verbs like "រៀបចំ", "ស្វែងយល់", "បកស្រាយ", "ពិភាក្សា", "បែងចែក", "ជ្រើសរើស", "វែកញែក", "បង្ហាញ", "ប្រើប្រាស់", "កំណត់", "ប្រាប់". Format: "- [សកម្មភាព] [ខ្លឹមសារ] [កម្រិតលទ្ធផល] តាមរយៈ [លក្ខខណ្ឌ]"
     E.g., "- ប្រើប្រាស់រូបមន្តដើម្បីដោះស្រាយលំហាត់បានត្រឹមត្រូវតាមរយៈការពិភាក្សាជាក្រុម។" or "- ពិភាក្សាអំពីដំណោះស្រាយបញ្ហាបានច្បាស់លាស់តាមរយៈការអនុវត្តផ្ទាល់។"
   - ចរិយាសម្បទា (Attitude): CRITICAL: Do NOT use the word "បណ្ដុះស្មារតី" at all. Use verbs like "ទទួលស្គាល់", "មានស្មារតី", "ថែរក្សា", "ស្រឡាញ់", "ចូលរួម", "ចាត់ទុក", "យកចិត្តទុកដាក់", "ការពារ", "មានទំនួលខុសត្រូវ", "វិភាគ", "ប្រកាន់ខ្ជាប់". Format: "- [សកម្មភាព] [ខ្លឹមសារ] [កម្រិតលទ្ធផល] តាមរយៈ [លក្ខខណ្ឌ]"
     E.g., "- មានទំនួលខុសត្រូវខ្ពស់ក្នុងការថែរក្សាបរិស្ថានជុំវិញខ្លួនជាប្រចាំតាមរយៈខ្លឹមសារមេរៀន។" or "- ចូលរួមសហការជាមួយមិត្តរួមថ្នាក់យ៉ាងយកចិត្តទុកដាក់តាមរយៈការធ្វើការងារក្រុម។"
2. Teaching Materials (សម្ភារឧបទេស):
   - សម្រាប់គ្រូ (Teacher materials): E.g., Laptop, Slide project, Textbook.
   - សម្រាប់សិស្ស (Student materials): E.g., Notebook, Pen, Textbook.
3. Teaching Steps (៥ ជំហាននៃការបង្រៀន): Give exactly 5 teaching steps:
   - ជំហានទី១៖ រដ្ឋបាលថ្នាក់ (៥នាទី) (Class administrative tasks, greetings, checking attendance/sanitation, class president response).
   - ជំហានទី២៖ រំឭកមេរៀន (៥នាទី) (Recall prior knowledge related to this new topic. CRITICAL: You MUST generate exactly 2 action rows for Step 2. Row 1 MUST be a review question/activity checking previous lesson. Row 2 MUST be "ទំនាក់ទំនងមេរៀនថ្មី" (Connection to the new lesson), where the teacher links the review to the new lesson topic).
   - ជំហានទី៣៖ មេរៀនថ្មី (៣៥នាទី) (Detailed delivery of the content, formulas, steps, group work. CRITICAL: You MUST generate at least 5 distinct action rows/activities for Step 3 to ensure extremely detailed lesson delivery).
   - ជំហានទី៤៖ ពង្រឹងពុទ្ធិ (៣នាទី) (Quick checking of understanding. CRITICAL: You MUST generate at least 2 distinct evaluation/reinforcement questions, resulting in at least 2 action rows/questions for Step 4).
   - ជំហានទី៥៖ កិច្ចការផ្ទះ និងបណ្តាំផ្ញើ (២នាទី) (Assigning household exercises and giving life advice).

CRITICAL FORMATTING FOR BULLETS AND LAYOUT ALIGNMENT:
- For every single generated row inside "rows", the "teacherActivity" (សកម្មភាពគ្រូ) and "studentActivity" (សកម្មភាពសិស្ស) column values MUST be aligned symmetrically to match the "content" (ខ្លឹមសារមេរៀន).
- Symmetrical Alignment rule: If the teacher asks 2 questions in "teacherActivity", the student must have 2 corresponding answers in "studentActivity".
- Every distinct bullet, line, action, or instruction statement inside "teacherActivity" and "studentActivity" MUST start with a hyphen "- " prefix. Ensure that the lines match up one-to-one across columns so that they line up perfectly on a printed page.

Make sure the script/actions are detailed and realistic. Avoid lazy responses. Use actual Cambodian standard educational contexts. Return ONLY a valid JSON.`;

    parts.push({ text: textPrompt });

    // Try generating content with retry and fallback model
    const generateWithRetryAndFallback = async (...modelsToTry: string[]) => {
      let lastError: any = null;

      for (const currentModel of modelsToTry) {
        let delay = 1500;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`Generating with ${currentModel} (Attempt ${attempt}/${maxRetries})...`);
            const response = await ai.models.generateContent({
              model: currentModel,
              contents: { parts },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    lessonReview: { type: Type.STRING, description: "រំឭកមេរៀន (Lesson Review summary statement) in Khmer" },
                    objectives: {
                      type: Type.OBJECT,
                      properties: {
                        knowledge: { type: Type.STRING, description: "វិជ្ជាសម្បទា in Khmer" },
                        skills: { type: Type.STRING, description: "បំណិនសម្បទា in Khmer" },
                        attitude: { type: Type.STRING, description: "ចរិយាសម្បទា in Khmer" }
                      },
                      required: ["knowledge", "skills", "attitude"]
                    },
                    materials: {
                      type: Type.OBJECT,
                      properties: {
                        forTeacher: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: "Teaching materials used by teacher (3-5 items)"
                        },
                        forStudents: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: "Classroom materials used by students (3-4 items)"
                        }
                      },
                      required: ["forTeacher", "forStudents"]
                    },
                    steps: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          stepNumber: { type: Type.INTEGER },
                          stepTitle: { type: Type.STRING, description: "Title e.g. ជំហានទី១៖ រដ្ឋបាលថ្នាក់" },
                          duration: { type: Type.STRING, description: "Duration e.g. ៥នាទី" },
                          rows: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                teacherActivity: { type: Type.STRING, description: "សកម្មភាពគ្រូ" },
                                content: { type: Type.STRING, description: "ខ្លឹមសារមេរៀន" },
                                studentActivity: { type: Type.STRING, description: "សកម្មភាពសិស្ស" }
                              },
                              required: ["teacherActivity", "content", "studentActivity"]
                            }
                          }
                        },
                        required: ["stepNumber", "stepTitle", "duration", "rows"]
                      }
                    }
                  },
                  required: ["lessonReview", "objectives", "materials", "steps"]
                }
              }
            });
            return response;
          } catch (err: any) {
            lastError = err;
            const status = err.status || err.statusCode || 0;
            // Client-side configuration errors like 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found) are non-transient.
            // Any other errors (status 0, 500, 503, network errors, timeouts) are transient and should be retried.
            const isNonTransient = status === 400 || status === 401 || status === 403 || status === 404;
            const isTransient = !isNonTransient;
            
            if (isTransient && attempt < maxRetries) {
              console.warn(`Transient error on ${currentModel} (attempt ${attempt}):`, err.message || err);
              console.log(`Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            } else {
              break; // Try next model if not transient or exceeded retries
            }
          }
        }
      }
      throw lastError;
    };

    const result = await generateWithRetryAndFallback(
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite"
    );

    const parsedData = JSON.parse(result.text || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Error generating lesson plan:", error);
    let errorMessage = error.message || "Failed to generate lesson plan";
    
    // Intercept 503 high demand errors and translate to warm, polite, and helpful instructions
    if (errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("temporary")) {
      errorMessage = "សេវាកម្ម AI កំពុងមានតម្រូវការប្រើប្រាស់ខ្ពស់ខ្លាំងជាបណ្ដោះអាសន្ន (Busy)។ សូមលោកគ្រូ/អ្នកគ្រូ មេត្តារង់ចាំប្រហែល ១៥ ទៅ ៣០វិនាទី រួចចុច 'រៀបចំកិច្ចតែងការ (AI)' ម្ដងទៀត ដើម្បីសាកល្បង ឬលោកគ្រូអាចបញ្ចូលខ្លឹមសារដោយដៃផ្ទាល់តាមរយៈប៊ូតុងកែសម្រួលបានភ្លាមៗ។";
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Configure Vite middleware or static delivery
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
