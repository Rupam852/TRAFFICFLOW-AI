import { useState, useEffect, useRef } from 'react';
import { generateAiRouteAnalysis } from '../utils/ai';
import { Send, BrainCircuit, Loader2, Bot, Sparkles, Zap } from 'lucide-react';

export default function AiPanel({ settings, startLocation, destination, routeOptions, selectedRouteIndex }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [hoveredPromptIdx, setHoveredPromptIdx] = useState(null);
  const chatEndRef = useRef(null);

  // Helper to parse double asterisks (**) and render them as JSX bold tags
  const renderMessageText = (text) => {
    if (!text) return '';
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <strong 
            key={index} 
            style={{ 
              fontWeight: '800', 
              color: settings.theme === 'light' ? '#4f46e5' : '#818cf8',
              background: 'rgba(99, 102, 241, 0.05)',
              padding: '1px 4px',
              borderRadius: '4px'
            }}
          >
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  // Trigger AI route summary analysis when route details change
  useEffect(() => {
    if (!startLocation || !destination || !routeOptions || routeOptions.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: '👋 Hello! I am your AI Cognitive Advisor.\n\nEnter a start point and destination in the Navigation tab, and I will analyze the fastest route, weather conditions, and bottlenecks for you.',
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

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMessageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
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

  const queryCustomAI = async (provider, apiKey, prompt) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || `Gemini API error code ${data.error.code}`);
    }
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    throw new Error('Empty response from Gemini (Verify prompt safety or key restrictions).');
  };


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

  const quickPrompts = [
    { icon: '🌧️', label: 'Weather impact?' },
    { icon: '📸', label: 'Speed cameras?' },
    { icon: '⛽', label: 'Fuel stops?' },
    { icon: '🚦', label: 'Traffic update?' },
  ];

  return (
    <div style={styles.container}>

      {/* Premium AI Header */}
      <div style={styles.aiHeader}>
        <div style={styles.aiHeaderLeft}>
          <div style={styles.aiAvatarLarge}>
            <BrainCircuit size={18} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={styles.aiTitle}>Cognitive Advisor</div>
            <div style={styles.aiSubtitle}>
              <span style={styles.providerDot} />
              {settings.aiProvider.toUpperCase()} Engine · {settings.aiKey ? 'Live Mode' : 'Simulation'}
            </div>
          </div>
        </div>
        {!settings.aiKey && (
          <span style={styles.simBadge}>
            <Zap size={10} />
            DEMO
          </span>
        )}
        {settings.aiKey && (
          <span style={styles.livePillBadge}>
            <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
            LIVE AI
          </span>
        )}
      </div>

      {/* Quick Prompts */}
      {startLocation && destination && messages.length <= 2 && (
        <div style={styles.quickPromptsWrap}>
          <span style={styles.quickPromptsLabel}>Quick Ask</span>
          <div style={styles.quickPrompts}>
            {quickPrompts.map((q, i) => {
              const isHovered = hoveredPromptIdx === i;
              return (
                <button
                  key={i}
                  onClick={() => setInputText(q.label.replace('?', ''))}
                  onMouseEnter={() => setHoveredPromptIdx(i)}
                  onMouseLeave={() => setHoveredPromptIdx(null)}
                  style={{
                    ...styles.quickPromptBtn,
                    borderColor: isHovered ? 'var(--primary)' : 'var(--border-color)',
                    color: isHovered ? 'var(--primary)' : 'var(--text-secondary)',
                    transform: isHovered ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
                    boxShadow: isHovered ? '0 4px 12px var(--border-glow)' : 'var(--shadow-sm)',
                  }}
                  disabled={loading}
                >
                  {q.icon} {q.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages Window */}
      <div style={styles.chatArea} className="panel-content-scroll">
        {messages.map((msg) => {
          const isAi = msg.sender === 'ai';
          return (
            <div
              key={msg.id}
              style={{
                ...styles.messageWrapper,
                justifyContent: isAi ? 'flex-start' : 'flex-end',
                alignSelf: isAi ? 'flex-start' : 'flex-end',
              }}
            >
              {isAi && (
                <div style={styles.botAvatar}>
                  <Bot size={12} />
                </div>
              )}
              <div
                style={{
                  ...styles.bubble,
                  background: isAi
                    ? 'var(--bg-secondary)'
                    : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  color: isAi ? 'var(--text-primary)' : '#ffffff',
                  borderTopLeftRadius: isAi ? '4px' : '16px',
                  borderTopRightRadius: isAi ? '16px' : '4px',
                  border: isAi ? '1px solid var(--border-color)' : 'none',
                  boxShadow: isAi ? 'var(--shadow-sm)' : '0 4px 16px rgba(99,102,241,0.25)',
                }}
              >
                <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                  {isAi ? renderMessageText(msg.text) : msg.text}
                </div>
                <span style={styles.msgTime}>{msg.time}</span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start', alignSelf: 'flex-start' }}>
            <div style={styles.botAvatar}>
              <Bot size={12} />
            </div>
            <div style={styles.bubbleLoading}>
              <div style={styles.typingDots}>
                <span style={{ ...styles.dot, animationDelay: '0ms' }} />
                <span style={{ ...styles.dot, animationDelay: '160ms' }} />
                <span style={{ ...styles.dot, animationDelay: '320ms' }} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {generatingSummary ? 'Synthesizing route telemetry...' : 'Advisor is analyzing...'}
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Premium Chat Input */}
      <form onSubmit={handleSendMessage} style={styles.chatForm}>
        <div style={styles.chatInputWrap}>
          <input
            type="text"
            placeholder={
              !startLocation || !destination
                ? 'Set a route first to ask AI...'
                : loading
                ? 'AI is thinking...'
                : 'Ask about traffic, weather, cameras...'
            }
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
              background: inputText.trim() && !loading
                ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                : 'var(--bg-tertiary)',
              color: inputText.trim() && !loading ? '#fff' : 'var(--text-muted)',
              boxShadow: inputText.trim() && !loading ? '0 4px 12px rgba(99,102,241,0.35)' : 'none',
              cursor: inputText.trim() && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
          </button>
        </div>
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

  // ── AI Header ──
  aiHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.05) 100%)',
  },
  aiHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  aiAvatarLarge: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
    flexShrink: 0,
  },
  aiTitle: {
    fontSize: '0.88rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  aiSubtitle: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    marginTop: '1px',
  },
  providerDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 6px rgba(16,185,129,0.5)',
  },
  simBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.62rem',
    fontWeight: '800',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-glow)',
    border: '1px solid rgba(34,211,238,0.2)',
    padding: '3px 8px',
    borderRadius: '20px',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  livePillBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.62rem',
    fontWeight: '800',
    color: '#10b981',
    backgroundColor: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.25)',
    padding: '3px 8px',
    borderRadius: '20px',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },

  // ── Quick Prompts ──
  quickPromptsWrap: {
    padding: '10px 16px',
    borderBottom: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.015)',
  },
  quickPromptsLabel: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    display: 'block',
    marginBottom: '8px',
  },
  quickPrompts: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  quickPromptBtn: {
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    fontSize: '0.72rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    whiteSpace: 'nowrap',
  },

  // ── Chat Area ──
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  messageWrapper: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    maxWidth: '88%',
    animation: 'fadeIn 0.25s ease',
  },
  botAvatar: {
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '4px',
    boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
  },
  bubble: {
    padding: '12px 14px',
    borderRadius: '16px',
    fontSize: '0.84rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  bubbleLoading: {
    padding: '12px 14px',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  typingDots: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    animation: 'bounce 1.2s infinite ease-in-out',
    display: 'inline-block',
  },
  msgTime: {
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    alignSelf: 'flex-end',
    marginTop: '4px',
    opacity: 0.7,
  },

  // ── Chat Input ──
  chatForm: {
    padding: '12px 14px',
    borderTop: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
  },
  chatInputWrap: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '6px 6px 6px 14px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    transition: 'var(--transition-smooth)',
  },
  chatInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.84rem',
    minWidth: 0,
  },
  sendBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
    flexShrink: 0,
  },
};
