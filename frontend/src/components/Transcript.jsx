import { useState, useEffect, useContext } from "react";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { UserIdContext} from "./UserIdContext";
import { API_BASE } from "../config/api";

const Transcript = () => {
  const [entries, setEntries] = useState([]);
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const {userId} = useContext(UserIdContext);

  // Group entries by journal_date
  const groupEntriesByDate = (entries) => {
    const grouped = {};
    entries.forEach(entry => {
      const date = entry.journal_date || entry.created_at.split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(entry);
    });
    
    // Sort entries within each day by created_at (chronological)
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
    
    // Sort dates in descending order (newest first)
    return Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).reduce((acc, date) => {
      acc[date] = grouped[date];
      return acc;
    }, {});
  };

  // Get entries with timestamps for a day
  const getDayEntriesWithTimestamps = (dayEntries) => {
    return dayEntries
      .map(entry => {
        if (!entry.transcript || entry.transcript.trim() === '') return null;
        const time = new Date(entry.created_at).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return { time, transcript: entry.transcript };
      })
      .filter(entry => entry !== null);
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Fetch all entries
  const fetchEntries = async () => {
    if (!userId || !token) return;

    try {
      setLoading(true);
      const response = await axios.get(
        API_BASE + '/users/' + userId + '/entries',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const entries_data = response.data.data.entries || [];
      setEntries(entries_data);
      
      // Auto-expand today's date (using local timezone)
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setExpandedDays(new Set([today]));
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [userId, token]);

  // Listen for entry creation events to refresh
  useEffect(() => {
    const handleEntryCreated = () => {
      fetchEntries();
    };

    window.addEventListener('entryCreated', handleEntryCreated);
    return () => {
      window.removeEventListener('entryCreated', handleEntryCreated);
    };
  }, [userId, token]);

  const toggleDay = (date) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const groupedEntries = groupEntriesByDate(entries);

  // Count the number of days with entries (not total entries)
  const totalDays = Object.keys(groupedEntries).length;

  return (
    <div className="mt-12">
      <div className="px-2 mb-6 border-b border-white/5 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white font-display uppercase tracking-wide" style={{ textShadow: "0 2px 0 #B31F19" }}>Transcript History</h2>
          <p className="text-sm text-stone-500 font-medium mt-1 font-sans">{totalDays} {totalDays === 1 ? 'day' : 'days'} recorded</p>
        </div>
      </div>
      <div className="">
        {loading ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
              <p className="text-stone-500 font-sans text-sm">Loading history...</p>
            </div>
          </div>
        ) : Object.keys(groupedEntries).length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 bg-white/5 rounded-2xl border border-white/5 border-dashed">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
              <span className="text-3xl">📄</span>
            </div>
            <p className="text-stone-300 font-semibold text-lg font-sans">No transcript history</p>
            <p className="text-sm text-stone-500 mt-2 font-sans">Your recordings will appear here</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedEntries).map((date) => {
              const dayEntries = groupedEntries[date];
              const isExpanded = expandedDays.has(date);
              const entriesWithTimestamps = getDayEntriesWithTimestamps(dayEntries);
              const entryCount = dayEntries.length;

              // Format date header similar to My Journals
              const formatDateHeader = (dateString, entries) => {
                const date = new Date(dateString);
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const yesterdayDate = new Date();
                yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

                let dateText;
                if (dateString === today) {
                  dateText = 'Today';
                } else if (dateString === yesterday) {
                  dateText = 'Yesterday';
                } else {
                  dateText = date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                }

                // Get the time from the first entry of the day
                if (entries && entries.length > 0) {
                  const firstEntry = entries[0];
                  const time = new Date(firstEntry.created_at).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  });
                  return `${dateText} ${time}`;
                }
                return dateText;
              };

              return (
                <div key={date} className="group">
                  <div
                    onClick={() => toggleDay(date)}
                    className="flex items-center gap-3 mb-4 cursor-pointer select-none"
                  >
                    <div className={`text-brand-orange text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                        ▶
                    </div>
                    <h3 className="font-display text-lg text-white uppercase tracking-wide group-hover:text-brand-orange transition-colors">
                        {formatDateHeader(date, dayEntries)}
                    </h3>
                    <div className="h-px bg-white/10 flex-1 ml-2 group-hover:bg-white/20 transition-colors"></div>
                  </div>
                  
                  {isExpanded && (
                    <div className="pl-6 border-l border-white/5 ml-1.5 space-y-4">
                      {/* AI Summary */}
                      {dayEntries[0]?.ai_summary && (
                        <div className="bg-gradient-to-r from-brand-orange/10 to-transparent border-l-2 border-brand-orange pl-4 py-2 pr-4 rounded-r-lg mb-6">
                          <h4 className="text-xs font-bold text-brand-orange mb-1 font-display uppercase tracking-wider">Daily Summary</h4>
                          <p className="text-sm text-stone-300 leading-relaxed font-sans">
                            {dayEntries[0].ai_summary}
                          </p>
                        </div>
                      )}
                      
                      {/* Transcript Entries - Merged like a journal */}
                      <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-orange/50 to-transparent"></div>
                        <div className="pl-6 space-y-4">
                          {entriesWithTimestamps.length > 0 ? (
                            <div className="prose prose-invert max-w-none">
                              {entriesWithTimestamps.map((entry, index) => (
                                <p key={index} className="text-stone-300 leading-relaxed text-base font-sans mb-4">
                                  <span className="text-brand-orange/60 text-xs font-mono mr-2 select-none">[{entry.time}]</span>
                                  {entry.transcript}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-stone-500 text-sm font-sans italic">No transcripts available for this day.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


export default Transcript;
