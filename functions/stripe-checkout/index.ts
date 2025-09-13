import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk";

const blink = createClient({
  projectId: 'family-ops-dashboard-68kj0g31',
  authRequired: false
});

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    blink.auth.setToken(token);
    
    const user = await blink.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const body = await req.json();
    const { plan, familyId, successUrl, cancelUrl } = body;

    if (!plan || !familyId) {
      return new Response(JSON.stringify({ error: 'Plan and familyId required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Price mapping
    const priceIds: Record<string, string> = {
      monthly: Deno.env.get('STRIPE_MONTHLY_PRICE_ID') || 'price_monthly_placeholder',
      annual: Deno.env.get('STRIPE_ANNUAL_PRICE_ID') || 'price_annual_placeholder'
    };

    const priceId = priceIds[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Create Stripe checkout session
    const stripeResponse = await blink.data.fetch({
      url: 'https://api.stripe.com/v1/checkout/sessions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer {{STRIPE_SECRET_KEY}}',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'payment_method_types[0]': 'card',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'mode': 'subscription',
        'success_url': successUrl || `${req.headers.get('origin')}/settings?success=true`,
        'cancel_url': cancelUrl || `${req.headers.get('origin')}/settings`,
        'client_reference_id': familyId,
        'customer_email': user.email,
        'subscription_data[trial_period_days]': '14',
        'subscription_data[metadata][family_id]': familyId,
        'subscription_data[metadata][user_id]': user.id,
        'allow_promotion_codes': 'true'
      })
    });

    if (!stripeResponse.ok) {
      console.error('Stripe API error:', stripeResponse.status);
      return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const session = stripeResponse.body;

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id 
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
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