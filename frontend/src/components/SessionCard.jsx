import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

export default function SessionCard({ session }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const inviteUrl = `${FRONTEND_URL}/join/${session.invite_token}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy this invite link:', inviteUrl);
    }
  };

  const statusColors = {
    waiting: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    ended: 'bg-gray-100 text-gray-600',
  };

  const durationStr = () => {
    if (!session.started_at) return '—';
    const end = session.ended_at || Math.floor(Date.now() / 1000);
    const sec = end - session.started_at;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="bg-white rounded-xl shadow hover:shadow-md transition p-5 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <h3 className="text-base font-bold text-gray-800 leading-tight">{session.title}</h3>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColors[session.status] || 'bg-gray-100 text-gray-600'}`}>
          {session.status.toUpperCase()}
        </span>
      </div>

      <div className="text-xs text-gray-500 space-y-0.5">
        <p>Created: {new Date(session.created_at * 1000).toLocaleString()}</p>
        {session.started_at && <p>Duration: {durationStr()}</p>}
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={handleCopyInvite}
          className="w-full py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-semibold transition"
        >
          {copied ? '✓ Copied!' : '🔗 Copy Invite Link'}
        </button>

        {session.status !== 'ended' && (
          <button
            onClick={() => navigate(`/call/${session.id}`)}
            className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition"
          >
            Join Call
          </button>
        )}
      </div>
    </div>
  );
}
