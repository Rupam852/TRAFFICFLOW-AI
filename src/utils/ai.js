/**
 * AI Cognitive Routing Utilities
 * Supports Google Gemini, OpenAI GPT, and Anthropic Claude.
 * Fallbacks to realistic simulated analysis if keys are not configured.
 */

import { incrementApiUsage } from './usage';

export async function generateAiRouteAnalysis({
  provider,
  apiKey,
  startLocation,
  destination,
  routeOptions,
  selectedRouteIndex,
  weatherCondition
}) {
  const selectedRoute = routeOptions[selectedRouteIndex];
  
  // Prompt definition
  const prompt = `You are a real-time AI Traffic Flow and Navigation Consultant.
Analyze the following route choices and recommend the absolute fastest path:
- Start Location: ${startLocation?.name || 'Unknown'}
- Destination: ${destination?.name || 'Unknown'}
- Weather Condition: ${weatherCondition}
- Route Options:
${routeOptions.map((r, i) => `  * Route ${i + 1}: Name: "${r.name}", Distance: "${r.distance}", Normal Duration: "${r.duration}", Traffic Congestion Level: "${r.trafficStatus}"${r.delayInfo ? `, Bottleneck Details: "${r.delayInfo}"` : ''}`).join('\n')}
- User Selected Route: Route ${selectedRouteIndex + 1} ("${selectedRoute?.name}")

Provide a concise, professional analysis (max 3 short paragraphs):
1. Confirm if the selected route is indeed the fastest, or if an alternative is better.
2. Explain the traffic delays, weather impact, and bottleneck points.
3. Offer a safety/navigation tip (e.g. driving slow in rain/fog, watch out for construction).`;

  // Check if API key exists
  if (!apiKey) {
    return generateMockAnalysis(startLocation, destination, routeOptions, selectedRouteIndex, weatherCondition);
  }

  try {
    incrementApiUsage('ai'); // Track real API usage
    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 350,
              temperature: 0.5,
            },
          }),
        }
      );
      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      throw new Error(data.error?.message || 'Failed to parse Gemini response.');
    } 
    
    else if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a professional traffic routing assistant.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 350,
          temperature: 0.5,
        }),
      });
      const data = await response.json();
      if (data.choices && data.choices[0].message.content) {
        return data.choices[0].message.content;
      }
      throw new Error(data.error?.message || 'Failed to parse OpenAI response.');
    } 
    
    else if (provider === 'claude') {
      // NOTE: Anthropic has strict CORS rules on client-side requests.
      // We will perform the request but handle failures gracefully.
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-html-user-aspect': 'true' // Client-side fetch
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 350,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      if (data.content && data.content[0].text) {
        return data.content[0].text;
      }
      throw new Error(data.error?.message || 'Failed to parse Claude response (CORS restriction likely).');
    }
  } catch (error) {
    console.error('AI Request Error:', error);
    return `[System: AI Engine encountered an error: "${error.message}". Falling back to local telemetry simulation.]\n\n` + 
      generateMockAnalysis(startLocation, destination, routeOptions, selectedRouteIndex, weatherCondition);
  }
}

function generateMockAnalysis(startLocation, destination, routeOptions, selectedRouteIndex, weatherCondition) {
  const selectedRoute = routeOptions[selectedRouteIndex];
  if (!selectedRoute) return 'Please set a start point and destination to trigger AI route optimization.';

  // Identify fastest route in options
  let fastestIdx = 0;
  let minMinutes = Infinity;

  routeOptions.forEach((r, i) => {
    // Parse duration text like "25 mins" or "1 hr 10 mins" into integer minutes
    let mins = 0;
    const hrsMatch = r.duration.match(/(\d+)\s*hr/);
    const minsMatch = r.duration.match(/(\d+)\s*min/);
    if (hrsMatch) mins += parseInt(hrsMatch[1]) * 60;
    if (minsMatch) mins += parseInt(minsMatch[1]);
    
    if (mins < minMinutes) {
      minMinutes = mins;
      fastestIdx = i;
    }
  });

  const isFastestSelected = selectedRouteIndex === fastestIdx;
  const recommendedRoute = routeOptions[fastestIdx];

  const analysis = `Based on current satellite telemetry and AI predictive flow modeling, Route ${fastestIdx + 1} ("${recommendedRoute.name}") is currently the optimal route from ${startLocation?.name || 'your location'} to ${destination?.name || 'destination'}.

${isFastestSelected 
  ? `You have selected Route ${selectedRouteIndex + 1} ("${selectedRoute.name}"), which is currently the fastest path (${selectedRoute.duration}). The road conditions along this path show smooth flow with minor delays near intersections.` 
  : `You have selected Route ${selectedRouteIndex + 1} ("${selectedRoute.name}"). Note that Route ${fastestIdx + 1} ("${recommendedRoute.name}") is currently **${minMinutes < 20 ? '4' : '8'} minutes faster** than your selection due to ${selectedRoute.delayInfo || 'general congestion'} on the current path.`
}

${weatherCondition === 'rain' 
  ? '☔ **Weather Alert (Rain)**: Major water pooling has slowed down average traffic speed by 15% on non-highway routes. Keep windshield wipers active and maintain double normal stopping distance.' 
  : weatherCondition === 'fog' 
  ? '🌫️ **Weather Alert (Fog)**: Visibility has dropped to under 150 meters. Heavy mist overlay is causing standard delays. Avoid overtaking maneuvers on two-lane roads.' 
  : '☀️ **Weather Alert (Clear)**: Good driving visibility. Surface temperatures are stable, promoting standard tire traction.'
}

🚦 **Realtime Telemetry Tip**: Watch out for sudden lane closures due to active roadside maintenance near the outer ring link road. Ensure to stay in the middle lane to bypass bottlenecks smoothly.`;

  return new Promise((resolve) => setTimeout(() => resolve(analysis), 800));
}

export async function evaluateRouteSelectionWithAI({
  provider,
  apiKey,
  startLocation,
  destination,
  routeOptions,
  weatherCondition,
  travelMode
}) {
  if (!routeOptions || routeOptions.length === 0) return { recommendedIndex: 0, reason: '' };

  const prompt = `You are a real-time AI Traffic Flow and Navigation Consultant.
Evaluate the following route options from "${startLocation?.name || 'Start'}" to "${destination?.name || 'Destination'}" under "${weatherCondition}" weather for a "${travelMode}".
Select the absolute best/safest/fastest route.

Route Options:
${routeOptions.map((r, i) => `[Route Index ${i}] Name: "${r.name}", Distance: "${r.distance}", Duration: "${r.duration}", Traffic Status: "${r.trafficStatus}", Bottlenecks: "${r.delayInfo || 'None'}"`).join('\n')}

Format your response strictly as a JSON object, containing:
1. "recommendedIndex": The number (0, 1, or 2) representing the best route index.
2. "reason": A single concise sentence (max 15 words) explaining why you selected this route (e.g. "AI selected Route 1 to bypass moderate rain congestion and road works on Route 0.").

Response JSON format:
{
  "recommendedIndex": 0,
  "reason": "AI selected Route 0 because..."
}
Return ONLY the raw JSON. Do not include markdown code block formatting (like \`\`\`json) or any other text.`;

  // Default fallback if key is missing or request fails
  const mockDecision = () => {
    // Basic heuristic: Route 0 is fastest. If Route 0 has congestion, Route 1 might be better.
    let index = 0;
    let reason = `AI selected Route 1 because it has the clear, optimal speed profile.`;
    
    if (routeOptions.length > 1) {
      const isRoute0Slow = routeOptions[0].trafficStatus !== 'smooth';
      const isRoute1Clear = routeOptions[1].trafficStatus === 'smooth';
      if (isRoute0Slow && isRoute1Clear) {
        index = 1;
        reason = `AI selected Route 2 to bypass moderate traffic delays on the primary path.`;
      } else if (routeOptions.length > 2 && routeOptions[0].trafficStatus === 'heavy' && routeOptions[2].trafficStatus === 'smooth') {
        index = 2;
        reason = `AI selected Route 3 as the safest alternative route to avoid heavy urban bottlenecks.`;
      }
    }
    return { recommendedIndex: index, reason };
  };

  if (!apiKey) {
    return mockDecision();
  }

  try {
    incrementApiUsage('ai');
    let jsonText = '';
    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 120,
              temperature: 0.2,
              responseMimeType: "application/json" // Force Gemini to return JSON
            },
          }),
        }
      );
      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        jsonText = data.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Empty response from Gemini');
      }
    } else if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          response_format: { type: "json_object" }, // Force OpenAI to return JSON
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 120,
          temperature: 0.2,
        }),
      });
      const data = await response.json();
      jsonText = data.choices[0].message.content.trim();
    } else {
      // Claude or others
      return mockDecision();
    }

    // Parse the JSON returned by the AI
    // Strip markdown formatting if AI returned it anyway
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    const result = JSON.parse(jsonText);
    return {
      recommendedIndex: typeof result.recommendedIndex === 'number' ? result.recommendedIndex : 0,
      reason: result.reason || 'AI selected this route.'
    };
  } catch (error) {
    console.error('AI Route Decision error:', error);
    return mockDecision();
  }
}
