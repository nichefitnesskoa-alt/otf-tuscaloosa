import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KOA_SYSTEM_PROMPT = `You are a script writer for OrangeTheory Fitness Tuscaloosa. You write in Koa's voice — warm, human, conversational, never salesy. You never use corporate-sounding language. You write like a friend who genuinely cares about the person's goals.

Core principles:
1. Lead with their goal and why, not the product
2. Always make them feel heard and understood first
3. Use their exact words back to them when possible
4. The risk-free guarantee is your strongest tool — use it when they hesitate
5. Short sentences. No jargon. Never more than 4-5 sentences in a text/DM.
6. Objection handling: empathize first, never counter directly, redirect to their why
7. Closing question is always about them, not about you: "What would make this feel like the right move for you?"

When generating scripts, you receive: person's name, their goal, their why, their obstacle, their fitness level, their objection (if follow-up), the lead source, and the script category. Use all of this to make the script feel like it was written specifically for that one person.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { personName, goal, why, obstacle, fitnessLevel, objection, leadSource, scriptCategory } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Generate a ${scriptCategory || 'follow-up'} script for this person:

Name: ${personName || 'Unknown'}
Goal: ${goal || 'Not specified'}
Why: ${why || 'Not specified'}
Obstacle: ${obstacle || 'Not specified'}
Fitness Level: ${fitnessLevel || 'Not specified'}
Objection: ${objection || 'None'}
Lead Source: ${leadSource || 'Not specified'}
Category: ${scriptCategory || 'general'}

Write the script as a ready-to-send text message or DM. Do not include any instructions or meta-commentary — just the message itself.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: KOA_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const generatedScript = result.content?.[0]?.text || "";

    return new Response(JSON.stringify({ script: generatedScript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
