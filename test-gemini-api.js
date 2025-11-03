// Test Gemini API to diagnose empty response issue
import { GoogleGenAI, Modality } from "@google/genai";

async function testGeminiAPI() {
  console.log('Testing Gemini API connection...\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable not set');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    // Test 1: Simple text generation without tools
    console.log('Test 1: Simple text generation...');
    const simpleResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Say 'Hello, API is working!' and nothing else.",
    });

    console.log('✓ Simple response:', {
      hasText: !!simpleResponse.text,
      textLength: simpleResponse.text?.length,
      text: simpleResponse.text?.substring(0, 100),
      finishReason: simpleResponse.candidates?.[0]?.finishReason
    });

    // Test 2: Text generation with Google Search tool
    console.log('\nTest 2: With Google Search tool...');
    const searchResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Search for news about PLDT Philippines from the last 7 days and return a JSON object with one article: {\"title\": \"...\", \"summary\": \"...\"}",
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    console.log('✓ Search response:', {
      hasText: !!searchResponse.text,
      textLength: searchResponse.text?.length,
      text: searchResponse.text?.substring(0, 200),
      finishReason: searchResponse.candidates?.[0]?.finishReason,
      hasGroundingMetadata: !!searchResponse.candidates?.[0]?.groundingMetadata,
      groundingChunksCount: searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks?.length
    });

    // Test 3: Image generation
    console.log('\nTest 3: Image generation...');
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: 'Create a simple red circle on white background. No text.' }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const hasImageData = imageResponse.candidates?.[0]?.content?.parts?.some(
      part => part.inlineData
    );

    console.log('✓ Image response:', {
      hasImageData,
      finishReason: imageResponse.candidates?.[0]?.finishReason,
      partsCount: imageResponse.candidates?.[0]?.content?.parts?.length
    });

    console.log('\n✅ All API tests passed!');

  } catch (error) {
    console.error('\n❌ API test failed:');
    console.error('Error message:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testGeminiAPI();
