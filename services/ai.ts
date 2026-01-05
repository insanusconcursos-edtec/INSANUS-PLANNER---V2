import { GoogleGenAI, Type } from "@google/genai";
import { Flashcard } from "../types";
import { uuid } from "../constants";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateFlashcardsFromPDF = async (base64Pdf: string): Promise<Flashcard[]> => {
  try {
    // Clean base64 string if it contains metadata header
    const cleanBase64 = base64Pdf.replace(/^data:application\/pdf;base64,/, "");

    // Using gemini-3-flash-preview for efficiency and compliance with guidelines for basic text tasks
    const modelName = "gemini-3-flash-preview"; 

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: cleanBase64,
            },
          },
          {
            text: `Você é um especialista em concursos públicos e pedagogia.
              Analise o documento PDF fornecido.
              Crie uma lista de Flashcards (Perguntas e Respostas) que ajudem na revisão ativa deste conteúdo.
              Foque nos conceitos mais importantes, prazos, exceções e regras gerais que costumam cair em provas.
              As perguntas devem ser diretas e as respostas explicativas porém concisas.
              Gere entre 5 a 15 flashcards, dependendo da densidade do conteúdo.
              Retorne APENAS o JSON conforme o schema.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: "A pergunta do flashcard, deve estimular a memória ativa.",
              },
              answer: {
                type: Type.STRING,
                description: "A resposta correta e concisa.",
              },
            },
            propertyOrdering: ["question", "answer"],
          },
        },
      },
    });

    // The GenerateContentResponse features a .text property
    const jsonText = response.text;
    if (!jsonText) {
        throw new Error("Não foi possível gerar flashcards (resposta vazia).");
    }

    const rawCards = JSON.parse(jsonText.trim()) as { question: string; answer: string }[];

    // Map to internal Flashcard type with UUIDs
    return rawCards.map(card => ({
      id: uuid(),
      question: card.question,
      answer: card.answer
    }));

  } catch (error) {
    console.error("Erro ao gerar flashcards com Gemini:", error);
    throw new Error("Falha ao processar o arquivo com IA. Verifique se o PDF contém texto selecionável.");
  }
};