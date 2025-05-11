import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);

  const fetchMessages = async () => {
    const res = await axios.get('http://localhost:5000/messages');
    setMessages(res.data);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    await axios.post('http://localhost:5000/message', { content: input });
    setInput('');
    fetchMessages();
  };

  return (
    <div className="terminal">
      <h1>Conscious Mirror</h1>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className="message">
            <div className="timestamp">{new Date(msg.timestamp).toLocaleString()}</div>
            <div className="content">{msg.content}</div>
          </div>
        ))}
      </div>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Type or paste your thoughts..."
      ></textarea>
      <button onClick={sendMessage}>Reflect</button>
    </div>
  );
}

export default App;