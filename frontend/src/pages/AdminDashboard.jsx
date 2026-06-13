import { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../api/index.js';
import { AuthContext } from '../context/AuthContext.jsx';

export default function AdminDashboard() {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    loadSessions();
  }, [user]);

  const loadSessions = async () => {
    try {
      const { data } = await adminAPI.getSessions();
      setSessions(data);
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleForceEnd = async (sessionId) => {
    if (!window.confirm('Are you sure you want to end this session?')) return;

    try {
      await adminAPI.endSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError('Failed to end session');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">AtomQuest Admin</h1>
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
        <h2 className="text-xl font-bold mb-4">All Sessions</h2>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Agent</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Created</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Duration</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-600">
                    No sessions
                  </td>
                </tr>
              ) : (
                sessions.map((session) => {
                  const duration =
                    session.started_at && session.ended_at
                      ? `${Math.floor((session.ended_at - session.started_at) / 60)}m`
                      : session.started_at
                        ? '(ongoing)'
                        : '—';

                  return (
                    <tr key={session.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{session.title}</td>
                      <td className="px-6 py-4 text-sm">{session.agent_id}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            session.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : session.status === 'waiting'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {new Date(session.created_at * 1000).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">{duration}</td>
                      <td className="px-6 py-4 text-sm">
                        {session.status === 'active' && (
                          <button
                            onClick={() => handleForceEnd(session.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                          >
                            Force End
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
