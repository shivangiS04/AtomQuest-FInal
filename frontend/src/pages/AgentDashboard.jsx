import { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsAPI } from '../api/index.js';
import { AuthContext } from '../context/AuthContext.jsx';
import SessionCard from '../components/SessionCard.jsx';

export default function AgentDashboard() {
  const [sessions, setSessions] = useState([]);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    try {
      const { data } = await sessionsAPI.getAll();
      setSessions(data);
    } catch (err) {
      setError('Failed to load sessions');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;

    setLoading(true);
    try {
      const { data } = await sessionsAPI.create(newSessionTitle);
      setSessions([data.session, ...sessions]);
      setNewSessionTitle('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">AtomQuest</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {user?.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4 mt-8">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Create New Session</h2>
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          <form onSubmit={handleCreateSession} className="flex gap-2">
            <input
              type="text"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              placeholder="Session title (e.g., Customer Support Call)"
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Your Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-600">No sessions yet. Create one above to get started!</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
