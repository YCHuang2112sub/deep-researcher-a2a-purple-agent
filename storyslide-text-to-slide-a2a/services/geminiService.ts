
import { GoogleGenAI, Type } from "@google/genai";
import { Slide, SlideDeck } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SLIDE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          bodyText: { type: Type.STRING },
          visualPrompt: { type: Type.STRING, description: "Highly detailed prompt for an illustration in a 'cinematic narrative storybook' style" },
          layout: { 
            type: Type.STRING, 
            enum: ['split-left', 'split-right', 'centered', 'bottom-overlay'] 
          },
          speakerNotes: { 
            type: Type.STRING, 
            description: "YouTube script style: high energy, tension, use words like 'WAIT UNTIL YOU SEE THIS', 'INSANE', 'HUGE REVEAL'. Ensure it covers the research depth but sounds like MrBeast or Veritasium." 
          }
        },
        required: ['id', 'title', 'bodyText', 'visualPrompt', 'layout', 'speakerNotes']
      }
    }
  },
  required: ['topic', 'slides']
};

export const generateSlideData = async (researchText: string): Promise<SlideDeck> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Transform the following deep research into an illustrated slide deck (5-8 slides). 
    The style should be a 'great illustrator narrative' - meaning each slide feels like a page from a high-end graphic novel or storybook.
    The speaker notes must be in the style of a top-tier YouTuber with high tension and hype, but without losing the technical depth.
    
    Research Text:
    ${researchText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: SLIDE_SCHEMA,
    }
  });

  return JSON.parse(response.text) as SlideDeck;
};

export const generateSlideImage = async (prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `A professional, cinematic storybook illustration: ${prompt}. Artistic, high-quality lighting, emotional depth, clean composition.` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return 'https://picsum.photos/1200/675';
};
