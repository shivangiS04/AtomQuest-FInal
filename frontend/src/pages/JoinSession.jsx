import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function JoinSession() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/invite/${token}`);
      setSession(data.session);
    } catch {
      setError('This invite link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setJoining(true);
    navigate(`/room/${session.id}?customer=${encodeURIComponent(token)}&name=${encodeURIComponent(name.trim())}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center">
        <p className="text-white text-lg">Validating invite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-3">Invalid Invite</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">AtomQuest</h1>
          <p className="text-gray-500">You've been invited to a video support session</p>
        </div>

        {session?.status === 'ended' ? (
          <div className="text-center">
            <p className="text-red-600 font-semibold">This session has already ended.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">Session</p>
              <p className="text-lg font-bold text-gray-800">{session?.title}</p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name to join"
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-blue-600 text-lg"
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                disabled={joining || !name.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {joining ? 'Joining...' : 'Join Session'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
