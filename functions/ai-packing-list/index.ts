import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk";
const blink = createClient({
  projectId: "family-ops-dashboard-68kj0g31",
  authRequired: false
});

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { familyId, startDate, endDate, destination: rawDestination, travelers, purpose } = await req.json();

    if (!familyId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: familyId' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const destination = (rawDestination?.toString?.().trim() || 'Trip');

    // Default dates when missing (QA-friendly)
    const startDateStr = startDate || new Date().toISOString().split('T')[0];
    const endDateStr = endDate || new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0];

    // Extract auth token and set it
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      blink.auth.setToken(token);
    }

    // Calculate trip duration
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(duration) || duration < 1) duration = 3;

    // Build traveler info
    const travelerInfo = travelers?.map((t: any) => 
      `${t.type} (age ${t.age})`
    ).join(', ') || 'family travelers';

    // Build AI prompt
    const prompt = `Generate a packing list for a ${purpose || 'vacation'} trip.
    
    Trip details:
    - Destination: ${destination}
    - Duration: ${duration} days (${startDateStr} to ${endDateStr})
    - Travelers: ${travelerInfo}
    - Trip type: ${purpose || 'vacation'}
    
    Return ONLY valid JSON in this exact format:
    {
      "items": [
        {"name": "T-shirts", "qty": "3", "category": "Clothes"},
        {"name": "Toothbrush", "qty": "1", "category": "Toiletries"},
        {"name": "Phone charger", "qty": "1", "category": "Electronics"}
      ]
    }
    
    Categories must be: Clothes, Toiletries, Health, Electronics, Documents, Misc
    Consider the destination, duration, and travelers when suggesting items.
    Be practical and comprehensive but not excessive.`;

    // Generate packing list using AI
    const { text } = await blink.ai.generateText({
      messages: [
        { 
          role: "system", 
          content: "You are a travel packing assistant. Generate practical packing lists in valid JSON format only." 
        },
        { role: "user", content: prompt }
      ],
      maxTokens: 2000
    });

    // Parse the response
    let packingData;
    try {
      // Extract JSON from response if it contains extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      packingData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      packingData = {
        items: [
          { name: 'T-shirts', qty: '3', category: 'Clothes' },
          { name: 'Underwear', qty: '3', category: 'Clothes' },
          { name: 'Socks', qty: '3', category: 'Clothes' },
          { name: 'Toothbrush', qty: '1', category: 'Toiletries' },
          { name: 'Toothpaste', qty: '1', category: 'Toiletries' },
          { name: 'Phone charger', qty: '1', category: 'Electronics' },
          { name: 'Medications', qty: '1', category: 'Health' },
          { name: 'ID/Passports', qty: '1', category: 'Documents' }
        ]
      };
    }

    // Validate response structure; if invalid, fallback
    if (!packingData.items || !Array.isArray(packingData.items) || packingData.items.length === 0) {
      packingData = {
        items: [
          { name: 'T-shirts', qty: '3', category: 'Clothes' },
          { name: 'Underwear', qty: '3', category: 'Clothes' },
          { name: 'Socks', qty: '3', category: 'Clothes' },
          { name: 'Toothbrush', qty: '1', category: 'Toiletries' },
          { name: 'Toothpaste', qty: '1', category: 'Toiletries' },
          { name: 'Phone charger', qty: '1', category: 'Electronics' },
          { name: 'Medications', qty: '1', category: 'Health' },
          { name: 'ID/Passports', qty: '1', category: 'Documents' }
        ]
      };
    }

    console.log('Generated packing list for family:', familyId, 'destination:', destination);
    
    return new Response(JSON.stringify(packingData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('AI packing list error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to generate packing list',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});