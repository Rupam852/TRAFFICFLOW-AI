// API Usage Quota Tracker for TrafficFlow AI

const LIMITS = {
  googleMaps: 100, // Google Maps API standard daily limit allowance
  mapbox: 3000,    // Mapbox free daily quota limit
  tomtom: 2500,    // TomTom developer daily free API quota limit
  openWeather: 1000, // OpenWeatherMap free daily API quota limit
  ai: 1500         // AI requests standard RPM/RPD daily free ceiling
};

export const getApiUsage = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const saved = localStorage.getItem('tf_api_usage');
  let usageObj = saved ? JSON.parse(saved) : null;
  
  if (!usageObj || usageObj.date !== todayStr) {
    usageObj = {
      date: todayStr,
      googleMaps: 0,
      mapbox: 0,
      tomtom: 0,
      openWeather: 0,
      ai: 0
    };
    localStorage.setItem('tf_api_usage', JSON.stringify(usageObj));
  }
  return usageObj;
};

export const incrementApiUsage = (provider) => {
  try {
    const usage = getApiUsage();
    if (usage && usage[provider] !== undefined) {
      usage[provider] += 1;
      localStorage.setItem('tf_api_usage', JSON.stringify(usage));
      // Dispatch custom event to notify components that API usage has changed
      window.dispatchEvent(new CustomEvent('api-usage-updated'));
    }
  } catch (err) {
    console.error('Failed to increment API usage tracker:', err);
  }
};

export const getApiLimits = () => LIMITS;
