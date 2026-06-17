/**
 * Vercel Serverless Function — Supabase Keep-Alive Ping
 * 
 * This public endpoint is called by cron-job.org every few days
 * to keep the Supabase free-tier project from being paused.
 * 
 * cron-job.org URL: https://trafficflowai.vercel.app/api/ping
 * No API keys or headers required from the cron caller.
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      status: 'error',
      message: 'Missing Supabase environment variables on server.',
    });
  }

  try {
    // Ping the Supabase Auth health endpoint with proper authentication
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    const body = await response.text();

    if (response.ok) {
      return res.status(200).json({
        status: 'ok',
        message: '✅ Supabase is alive and healthy!',
        supabase_status: response.status,
        timestamp: new Date().toISOString(),
      });
    } else {
      return res.status(502).json({
        status: 'error',
        message: 'Supabase returned a non-OK response.',
        supabase_status: response.status,
        supabase_body: body,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
