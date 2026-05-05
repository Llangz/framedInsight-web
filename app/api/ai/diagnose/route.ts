import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '@/lib/ai/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Define the expected output structure using Zod
const diagnosisSchema = z.object({
  diseaseName: z.string().describe('The name of the disease or pest identified.'),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']).describe('The assessed severity of the condition.'),
  confidence: z.number().min(0).max(100).describe('Confidence score of the prediction (0-100).'),
  affectedPercentage: z.number().min(0).max(100).describe('Estimated percentage of the plant/animal affected.'),
  recommendedTreatment: z.string().describe('Brief recommended immediate action or treatment.'),
  aiReasoning: z.string().describe('A short explanation of why the AI made this diagnosis based on visual cues.'),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Secure Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Input Validation
    const body = await req.json();
    const { imageUrl, enterpriseType } = body; // enterpriseType: 'coffee', 'dairy', 'sheep_goat'

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // 3. System Prompt Customization
    let systemPrompt = 'You are an expert agricultural AI. You diagnose diseases from images.';
    if (enterpriseType === 'coffee') {
      systemPrompt += ' You specialize in Coffee plants (e.g., Coffee Berry Disease, Leaf Rust).';
    } else if (enterpriseType === 'dairy' || enterpriseType === 'sheep_goat') {
      systemPrompt += ' You specialize in livestock health and veterinary diagnosis (e.g., Mastitis, Foot Rot).';
    }

    // 4. Generate AI Diagnosis using Vercel AI SDK
    const model = getLanguageModel('openai'); // Defaults to OpenAI gpt-4o

    const { object } = await generateObject({
      model,
      schema: diagnosisSchema,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: 'Please diagnose the condition in this image and provide a recommended treatment.' },
            { type: 'image', image: new URL(imageUrl) }
          ] 
        }
      ],
    });

    // 5. Return structured diagnosis
    return NextResponse.json({ success: true, diagnosis: object });

  } catch (error: any) {
    console.error('AI Diagnosis Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI diagnosis', details: error.message }, 
      { status: 500 }
    );
  }
}
