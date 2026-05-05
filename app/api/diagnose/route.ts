import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image, symptoms, media_type } = await request.json();

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: media_type || "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: `You are a veterinary expert specializing in small ruminants (goats and sheep) in Kenya. 

Analyze this photo and the following symptoms: "${symptoms}"

Provide a diagnosis in JSON format:
{
  "probable_diseases": [
    {
      "name": "Disease name",
      "confidence": "high|medium|low",
      "symptoms": ["symptom1", "symptom2"],
      "treatment": "Recommended treatment",
      "urgency": "immediate|soon|monitor"
    }
  ],
  "vet_recommended": true/false,
  "general_advice": "General care advice"
}

Focus on common Kenyan small ruminant diseases: PPR, CCPP, Foot Rot, Mastitis, Pneumonia, Coccidiosis, Worms.
If the condition is serious or unclear, recommend veterinary consultation.`,
            },
          ],
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const diagnosis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return NextResponse.json({ diagnosis });
  } catch (error: any) {
    console.error("Diagnosis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}