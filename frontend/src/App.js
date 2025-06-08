import React, { useState, useEffect } from 'react';
import './App.css';
import TopicInput from './components/TopicInput';
import DebateChat from './components/DebateChat';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [topic, setTopic] = useState('');
  const [isDebating, setIsDebating] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [eventSource, setEventSource] = useState(null);
  const [useApiMode, setUseApiMode] = useState(false);

  // Generate a new session ID when the component mounts
  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  // Clean up event source when component unmounts
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const handleStartDebate = (newTopic) => {
    if (!newTopic.trim()) return;
    
    setTopic(newTopic);
    setIsDebating(true);
    
    // Add user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: newTopic,
      timestamp: Date.now()
    };
    
    setMessages([userMessage]);
    
    // Determine which endpoint to use based on mode
    const endpoint = useApiMode 
      ? `/.netlify/functions/debate-stream?topic=${encodeURIComponent(newTopic)}&sessionId=${sessionId}`
      : `/.netlify/functions/no-api-debate-stream?topic=${encodeURIComponent(newTopic)}&sessionId=${sessionId}`;
    
    // Create a new EventSource for SSE
    const sse = new EventSource(endpoint);
    
    sse.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'message') {
        setMessages(prevMessages => [...prevMessages, {
          id: Date.now(),
          role: data.role,
          content: data.content,
          timestamp: Date.now()
        }]);
      } else if (data.type === 'done') {
        sse.close();
        setIsDebating(false);
        setEventSource(null);
      }
    };
    
    sse.onerror = (error) => {
      console.error('EventSource error:', error);
      sse.close();
      setIsDebating(false);
      setEventSource(null);
    };
    
    setEventSource(sse);
  };

  const handleStopDebate = () => {
    if (eventSource) {
      // Send stop signal to backend
      const endpoint = useApiMode 
        ? `/.netlify/functions/debate?action=stop&sessionId=${sessionId}`
        : `/.netlify/functions/no-api-debate?action=stop&sessionId=${sessionId}`;
      
      fetch(endpoint, {
        method: 'POST'
      }).catch(error => console.error('Error stopping debate:', error));
      
      // Close the event source
      eventSource.close();
      setEventSource(null);
    }
    
    setIsDebating(false);
  };

  const toggleApiMode = () => {
    if (!isDebating) {
      setUseApiMode(!useApiMode);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Debate Bot</h1>
        <p>Enter a topic and watch two AI bots debate it in real-time</p>
        <div className="mode-toggle">
          <label className="switch">
            <input 
              type="checkbox" 
              checked={useApiMode} 
              onChange={toggleApiMode}
              disabled={isDebating}
            />
            <span className="slider round"></span>
          </label>
          <span className="mode-label">
            {useApiMode ? 'API Mode (requires keys)' : 'Free Mode (no API keys)'}
          </span>
        </div>
      </header>
      
      <main className="App-main">
        <TopicInput 
          onStartDebate={handleStartDebate} 
          onStopDebate={handleStopDebate} 
          isDebating={isDebating} 
        />
        
        <DebateChat 
          messages={messages} 
          isDebating={isDebating} 
        />
      </main>
      
      <footer className="App-footer">
        <p>
          {useApiMode 
            ? 'Powered by OpenAI and Google Gemini' 
            : 'Running in free mode with pre-written responses'}
        </p>
      </footer>
    </div>
  );
}

export default App;
