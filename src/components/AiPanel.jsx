import { useState, useEffect, useRef } from 'react';
import { generateAiRouteAnalysis } from '../utils/ai';
import { Send, BrainCircuit, Loader2, Bot } from 'lucide-react';

export default function AiPanel({ settings, startLocation, destination, routeOptions, selectedRouteIndex }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const chatEndRef = useRef(null);

  // Trigger AI route summary analysis when route details change
  useEffect(() => {
    if (!startLocation || !destination || !routeOptions || routeOptions.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: '👋 Hello! I am your AI Cognitive Advisor. Enter a start point and destination in the Navigation tab, and I will analyze the fastest route, weather conditions, and bottlenecks for you.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    const triggerInitialAnalysis = async () => {
      setGeneratingSummary(true);
      setLoading(true);
      try {
        const summary = await generateAiRouteAnalysis({
          provider: settings.aiProvider,
          apiKey: settings.aiKey,
          startLocation,
          destination,
          routeOptions,
          selectedRouteIndex,
          weatherCondition: localStorage.getItem('tf_weather') || 'clear'
        });

        setMessages([
          {
            id: 'welcome',
            sender: 'ai',
            text: '👋 Hello! Here is my real-time cognitive analysis of your calculated routes:',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          {
            id: 'summary',
            sender: 'ai',
            text: summary,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setGeneratingSummary(false);
        setLoading(false);
      }
    };

    triggerInitialAnalysis();
  }, [startLocation, destination, routeOptions, selectedRouteIndex, settings.aiProvider, settings.aiKey]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userMessageText = inputText;
    setInputText('');

    // Append user message
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMessageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Prompt with full context
      const prompt = `You are a real-time AI Traffic Flow and Navigation Consultant.
Current Route Context:
- Starting location: ${startLocation?.name}
- Destination: ${destination?.name}
- Current selected route is Route ${selectedRouteIndex + 1} ("${routeOptions[selectedRouteIndex]?.name}") which has distance "${routeOptions[selectedRouteIndex]?.distance}" and duration "${routeOptions[selectedRouteIndex]?.duration}".
- Weather condition is: ${localStorage.getItem('tf_weather') || 'clear'}

User Question: "${userMessageText}"

Provide a concise, helpful, and localized answer based on their navigation query. (max 150 words)`;

      let aiReplyText = '';
      if (!settings.aiKey) {
        // Mock reply
        aiReplyText = await generateMockChatReply(userMessageText, routeOptions[selectedRouteIndex]);
      } else {
        aiReplyText = await queryCustomAI(settings.aiProvider, settings.aiKey, prompt);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '-reply',
          sender: 'ai',
          text: aiReplyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '-error',
          sender: 'ai',
          text: `⚠️ Error reaching AI cognitive engine: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper query client AI
  const queryCustomAI = async (provider, apiKey, prompt) => {
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      return data.candidates[0].content.parts[0].text;
    } else if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      return data.choices[0].message.content;
    } else {
      // Claude CORS fallback
      throw new Error("Claude direct calls restricted by browser CORS. Using fallback simulation.");
    }
  };

  // Realistic chat responses helper
  const generateMockChatReply = (question, selectedRoute) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const q = question.toLowerCase();
        let reply;

        if (q.includes('rain') || q.includes('weather') || q.includes('fog')) {
          reply = `🌧️ **Weather Impact Analysis**: On your selected route ("${selectedRoute?.name || 'Main Path'}"), rain conditions will impact braking distance. Watch out for hydroplaning on highway entrance ramps, where water accumulation is likely. High visibility headlamps are recommended.`;
        } else if (q.includes('camera') || q.includes('speed') || q.includes('police')) {
          reply = `📸 **Speed Limit & Camera Alerts**: The speed limit along "${selectedRoute?.name || 'the highway'}" is 80 km/h. Automated speed traps are active near the main interchange flyover and near the exit toll booth. Keep cruise control locked at standard speed parameters to ensure safety.`;
        } else if (q.includes('restaurant') || q.includes('food') || q.includes('fuel') || q.includes('petrol')) {
          reply = `⛽ **Amenities Check**: Along "${selectedRoute?.name || 'the route'}", you will find multiple service plazas. There is a Shell Petrol Station with a drive-thru Burger King 4 km ahead, and a major highway eatery hub around 12 km out.`;
        } else {
          reply = `🤖 **Route Assistant**: Good question! Along "${selectedRoute?.name || 'your path'}", the average vehicle velocity is 54 km/h. Flow is stable but bottlenecking remains near local intersections. I advise staying on this route as it is still 5 minutes faster than alternative local routes. Let me know if you need specific details!`;
        }

        resolve(reply);
      }, 1000);
    });
  };

  return (
    <div style={styles.container}>
      {/* AI Header */}
      <div style={styles.aiHeader}>
        <div style={styles.badge}>
          <BrainCircuit size={16} style={{ color: 'var(--primary)' }} />
          <span>Active Cognitive Core: {settings.aiProvider.toUpperCase()}</span>
        </div>
        {!settings.aiKey && (
          <span style={styles.simText}>Simulation Mode</span>
        )}
      </div>

      {/* Messages Window */}
      <div style={styles.chatArea}>
        {messages.map((msg) => {
          const isAi = msg.sender === 'ai';
          return (
            <div
              key={msg.id}
              style={{
                ...styles.messageWrapper,
                justifyContent: isAi ? 'flex-start' : 'flex-end',
              }}
            >
              {isAi && (
                <div style={styles.botAvatar}>
                  <Bot size={14} />
                </div>
              )}
              <div
                style={{
                  ...styles.bubble,
                  backgroundColor: isAi ? 'var(--bg-secondary)' : 'var(--primary)',
                  color: isAi ? 'var(--text-primary)' : '#ffffff',
                  borderTopLeftRadius: isAi ? '4px' : '16px',
                  borderTopRightRadius: isAi ? '16px' : '4px',
                  border: isAi ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                <span style={styles.msgTime}>{msg.time}</span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={styles.messageWrapper}>
            <div style={styles.botAvatar}>
              <Bot size={14} />
            </div>
            <div style={styles.bubbleLoading}>
              <Loader2 size={16} className="spin" style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {generatingSummary ? 'Synthesizing live route telemetry...' : 'AI is processing your query...'}
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSendMessage} style={styles.chatForm}>
        <input
          type="text"
          placeholder={loading ? 'Thinking...' : 'Ask AI about traffic, safety, speed cameras...'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loading || !startLocation || !destination}
          style={styles.chatInput}
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim() || !startLocation || !destination}
          style={{
            ...styles.sendBtn,
            backgroundColor: inputText.trim() ? 'var(--primary)' : 'var(--bg-tertiary)',
            color: inputText.trim() ? '#ffffff' : 'var(--text-muted)',
            cursor: inputText.trim() ? 'pointer' : 'default',
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  aiHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-tertiary)',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  simText: {
    fontSize: '0.65rem',
    backgroundColor: 'var(--accent-glow)',
    color: 'var(--accent)',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  messageWrapper: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    maxWidth: '85%',
  },
  botAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-glow)',
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '4px',
  },
  bubble: {
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '0.85rem',
    lineHeight: '1.45',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  bubbleLoading: {
    padding: '10px 16px',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  msgTime: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    alignSelf: 'flex-end',
    marginTop: '2px',
  },
  chatForm: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    gap: '10px',
    backgroundColor: 'var(--bg-secondary)',
  },
  chatInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-smooth)',
  },
};
