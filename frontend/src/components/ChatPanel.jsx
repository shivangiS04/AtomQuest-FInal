import { useEffect, useRef, useState } from 'react';
import { filesAPI } from '../api/index.js';

export default function ChatPanel({ messages = [], onSendMessage, onSendFile, sessionId, userName }) {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText);
      setMessageText('');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;

    setIsSending(true);
    try {
      const response = await filesAPI.upload(sessionId, file, userName);
      onSendFile(response.data);
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-80 bg-white rounded-lg shadow flex flex-col h-full">
      <div className="px-4 py-3 border-b font-semibold text-gray-800">Chat</div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 text-sm">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <div className="font-semibold text-blue-700">
                {msg.sender_name}
                <span className="text-xs text-gray-500 ml-2">
                  {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                </span>
              </div>
              {msg.message_type === 'text' ? (
                <p className="text-gray-700 break-words">{msg.content}</p>
              ) : msg.message_type === 'file' && msg.file_id ? (
                <a
                  href={filesAPI.download(msg.file_id)}
                  className="text-blue-600 underline hover:text-blue-800"
                  download
                >
                  📎 {msg.content || 'Download file'}
                </a>
              ) : null}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-3 space-y-2">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type message..."
            className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-600 text-gray-900 bg-white"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Send
          </button>
        </form>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            disabled={isSending}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 disabled:bg-gray-100"
          >
            {isSending ? 'Uploading...' : '📎 Share File'}
          </button>
        </div>
      </div>
    </div>
  );
}
