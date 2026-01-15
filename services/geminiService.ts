
import { GoogleGenAI, Type } from "@google/genai";
import { ResearchStep, ResearchReport, Source, CritiqueResult } from "../types";

// Text and logic AI
const textAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Dedicated Image AI (to leverage separate quota)
const imageAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_IMAGE_GEN || process.env.GEMINI_API_KEY || '' });

const isQuotaError = (error: any) => {
  const msg = error?.message?.toLowerCase() || "";
  return msg.includes("quota") || msg.includes("429") || msg.includes("resource_exhausted");
};

export const planResearchSteps = async (query: string): Promise<ResearchStep[]> => {
  const response = await textAI.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: `Plan a deep research investigation for the following query: "${query}". 
    Break it down into 3-5 distinct, concrete search objectives.
    For each objective, provide a "researchPlan" which is a brief description (1-2 sentences) of what specifically will be investigated and why.
    Return as a JSON list of objects with "title", "id", and "researchPlan".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            researchPlan: { type: Type.STRING }
          },
          required: ["id", "title", "researchPlan"]
        }
      }
    }
  });

  return JSON.parse(response.text || '[]').map((step: any) => ({
    ...step,
    status: 'pending',
    iteration: 0,
    logs: [],
    findingsHistory: []
  }));
};

export const executeSearch = async (stepTitle: string, refinedQuery?: string, previousFindings?: string): Promise<{ findings: string; sources: Source[] }> => {
  const prompt = refinedQuery
    ? `RESEARCH OBJECTIVE: ${stepTitle}. 
       PREVIOUS FINDINGS: ${previousFindings}
       CRITIQUE FEEDBACK: ${refinedQuery}.
       Perform a deep-dive search specifically to address the missing data points identified in the feedback.`
    : `Investigate this specific research objective: "${stepTitle}". 
       Provide a comprehensive, factual summary of findings based on search results.`;

  const response = await textAI.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const sources: Source[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter(chunk => chunk.web)
    .map(chunk => ({
      title: chunk.web?.title || 'Source',
      uri: chunk.web?.uri || '#'
    })) || [];

  return {
    findings: response.text || "No findings retrieved.",
    sources
  };
};

export const critiqueFindings = async (stepTitle: string, findings: string): Promise<CritiqueResult> => {
  const response = await textAI.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: `You are the Research Quality Auditor. 
    Objective to verify: "${stepTitle}"
    Findings to audit:
    ${findings}
    
    CRITERIA:
    1. Accuracy: Are there specific numbers/dates?
    2. Depth: Is it just surface-level summary?
    3. Missing Links: Is there a logical gap?
    
    If findings are too brief or lack specific evidence, set "sufficient" to false and provide a "refinedQuery" for the Investigator to try again.
    
    Return JSON:`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sufficient: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING },
          refinedQuery: { type: Type.STRING }
        },
        required: ["sufficient", "feedback"]
      }
    }
  });

  return JSON.parse(response.text || '{"sufficient": true, "feedback": "Quality check passed."}');
};

export const designSlide = async (stepTitle: string, findings: string, speakerPersona: string, visualPersona: string): Promise<{ title: string; points: string[]; visualPrompt: string; layout: string }> => {
  try {
    const response = await textAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Design a high-impact presentation slide based on these findings:
      "${findings.substring(0, 1500)}"
      
      The speaker is defined as: ${speakerPersona}
      The visual artist is defined as: ${visualPersona}

      Instructions:
      1. Create a punchy, short TITLE.
      2. Extract 3-4 key bullet POINTS that summarize the core essence.
      3. Describe a cinematic BACKGROUND VISUAL that supports this specific content.
      4. Select the best LAYOUT from: "split-left", "split-right", "bottom-overlay", "centered".
      
      Return as JSON:
      {
        "title": "...",
        "points": ["...", "..."],
        "visualPrompt": "Detailed prompt for DALL-E/Imagen...",
        "layout": "..."
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            points: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualPrompt: { type: Type.STRING },
            layout: { type: Type.STRING, enum: ["split-left", "split-right", "bottom-overlay", "centered"] }
          },
          required: ["title", "points", "visualPrompt", "layout"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Design failed:", error);
    return { title: stepTitle, points: ["Findings synthesis failed."], visualPrompt: "Clean minimal technology background.", layout: "centered" };
  }
};

export const generateSlideScript = async (design: any, persona: string): Promise<string> => {
  try {
    const response = await textAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Write a 30-60 second HIGH-IMPACT speaker script for a slide with this content:
      TITLE: ${design.title}
      POINTS: ${design.points.join(', ')}
      
      The speaker's persona is: ${persona}
      
      Instructions:
      - Talk THROUGH the points, providing context and "wow" factor.
      - Keep it natural, conversational, and energetic.
      - IMPORTANT: STAY 100% GROUNDED in the provided points. Do NOT invent fake data or hallucinate.
      - Return ONLY the spoken text. NO meta-text, NO headers.`,
    });

    return response.text || "No script generated.";
  } catch (error) {
    return "[Script generation error]";
  }
};

export const auditScript = async (script: string, findings: string): Promise<{ authenticityScore: number; hallucinationRisk: 'low' | 'medium' | 'high'; critique: string }> => {
  try {
    const response = await textAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Audit this speaker script for authenticity against the provided research findings.
      
      SCRIPT: "${script}"
      FINDINGS: "${findings.substring(0, 2000)}"
      
      Instructions:
      1. Calculate an Authenticity Score (0-100) based on how many findings are accurately represented.
      2. Identify Hallucination Risk (low, medium, high) based on invented facts or unverified claims.
      3. Provide a brief 1-sentence critique.
      
      Return as JSON:
      {
        "authenticityScore": number,
        "hallucinationRisk": "low" | "medium" | "high",
        "critique": "string"
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            authenticityScore: { type: Type.NUMBER },
            hallucinationRisk: { type: Type.STRING, enum: ["low", "medium", "high"] },
            critique: { type: Type.STRING }
          },
          required: ["authenticityScore", "hallucinationRisk", "critique"]
        }
      }
    });

    return JSON.parse(response.text || '{"authenticityScore": 0, "hallucinationRisk": "high", "critique": "Failed to audit."}');
  } catch (error) {
    return { authenticityScore: 0, hallucinationRisk: 'high', critique: "Audit failed." };
  }
};

export const generateImage = async (visualPrompt: string, visualPersona: string): Promise<string> => {
  try {
    const response = await imageAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `Generate a high-impact, cinematic visual.
      PROMPT: ${visualPrompt}
      STYLE / ARTISTIC DIRECTION: ${visualPersona}
      ASPECT RATIO: EXACTLY 16:9 horizontal aspect ratio.
      IMPORTANT: The image MUST occupy the entire 16:9 horizontal frame. bleed to edges.`,
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart?.inlineData) {
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn("Image Quota Reached for visual prompt.");
      return ""; // Silently fail image and let UI handle placeholder
    }
    console.error("Image generation error:", error);
  }

  return "";
};

export const synthesizeReport = async (originalQuery: string, allFindings: ResearchStep[]): Promise<ResearchReport> => {
  const context = allFindings.map(s => `Objective: ${s.title}\nFinal Integrated Findings: ${s.findings}`).join('\n\n');

  const response = await textAI.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: `Synthesize a comprehensive research report for: "${originalQuery}".
    Based on the following validated investigation vectors:
    ${context}
    
    Structure your response as JSON with:
    - summary: Professional executive summary.
    - detailedAnalysis: Long-form markdown analysis with sections.
    - keyFindings: 5 punchy bullet points.
    - dataPoints: Numerical trends discovered ({label, value}).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          detailedAnalysis: { type: Type.STRING },
          keyFindings: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          dataPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.NUMBER }
              },
              required: ["label", "value"]
            }
          }
        },
        required: ["summary", "detailedAnalysis", "keyFindings", "dataPoints"]
      }
    }
  });

  const parsed = JSON.parse(response.text || '{}');
  const allSources = Array.from(new Set(allFindings.flatMap(s => s.sources || []).map(s => JSON.stringify(s))))
    .map(s => JSON.parse(s));

  return {
    ...parsed,
    sources: allSources
  };
};
