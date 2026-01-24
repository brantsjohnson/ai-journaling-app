import { useEntryId } from "./EntryIdContext";
import { UserIdContext} from "./UserIdContext";
import { useSelectedentryId } from "./SelectedEntryIdContext";
import { useSelectedEntry } from "./SelectedEntryContext";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { useState, useEffect, useContext, useRef } from "react";
import Audio from "./Audio";
import { API_BASE } from "../config/api";
import { useScript } from "./ScriptContext";
import { supabase } from "../config/supabase";

// Helper function to get local date in YYYY-MM-DD format
const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper function to get local date string from a Date object
const getLocalDateStringFromDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const EntryList = ({ showRecordingControls = false }) => {
    const { userId } = useContext(UserIdContext);
    const { token } = useAuth();
    const [entries, setEntries] = useState([]);
    const [popupActive, setPopupActive] = useState(false);
    const {script, setScript} = useScript();
    const [journalDate, setJournalDate] = useState(getLocalDateString());
    const [recordingData, setRecordingData] = useState({ duration_ms: null, local_path: null });
    const [expandedDays, setExpandedDays] = useState(new Set()); // Track which days are expanded
    const [editingEntryId, setEditingEntryId] = useState(null); // Track which entry's date is being edited
    const [editJournalDate, setEditJournalDate] = useState("");
    const [editingTranscriptId, setEditingTranscriptId] = useState(null); // Track which entry's transcript is being edited
    const [editTranscript, setEditTranscript] = useState("");

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

    // Get merged transcript for a day
    const getMergedTranscript = (dayEntries) => {
        return dayEntries
            .map(entry => entry.transcript || '')
            .filter(t => t.trim() !== '')
            .join('\n\n');
    };

    // Get summary snippet (first line) for a day
    const getSummarySnippet = (dayEntries) => {
        const firstEntry = dayEntries[0];
        if (!firstEntry || !firstEntry.transcript) return 'No transcript available';
        const firstLine = firstEntry.transcript.split('\n')[0];
        return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
    };

    const getEntries = async(userId) => {
        if (!userId || !token) return;

        try {
            // Pass userId as-is (can be UUID or numeric). Backend will use JWT token to identify user.
            const response = await axios.get(
                API_BASE + '/users/' + userId +'/entries',
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            const entries_data = response.data.data.entries;
            setEntries(entries_data);

            // Auto-expand today's date
            const today = getLocalDateString();
            setExpandedDays(new Set([today]));
        } catch (error) {
            console.error('Error fetching entries:', error);
            if (error.response?.status === 404 && error.response?.data?.message?.includes('not found in local database')) {
                console.warn('User not synced to local database yet');
            }
        }
    };

    useEffect(() => {
        getEntries(userId);
    }, [userId]);

    const handleCreateEntry = async(e) => {
        e.preventDefault();
        if (!userId || !token) {
            alert('User not authenticated. Please try logging in again.');
            return;
        }

        if (!script || script.trim() === '') {
            alert('Please record a journal entry first');
            return;
        }

        try {
            // Pass userId as-is (can be UUID or numeric). Backend will use JWT token to identify user.
            const response = await axios.post(
                API_BASE + '/users/' + userId + '/entries',
                {
                    transcript: script,
                    duration_ms: recordingData.duration_ms,
                    local_path: recordingData.local_path,
                    journal_date: journalDate,
                    transcript_id: null,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            const newEntryData = response.data.data.entry;

            // Save transcript to transcripts table if we have a transcript
            // Note: The backend automatically updates the entry with transcript_id, so no need for additional calls
            if (script && script.trim() !== '' && newEntryData.id) {
                try {
                    await axios.post(
                        API_BASE + '/transcripts',
                        {
                            recording_id: newEntryData.id,
                            text: script,
                            language: null, // Can be added later if needed
                            confidence: null, // Can be added later if needed
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                    // Backend already updates the entry with transcript_id, so no need for GET + PATCH
                } catch (transcriptError) {
                    console.error('Error saving transcript:', transcriptError);
                    // Don't fail the whole process if transcript saving fails
                }
            }

            // Refresh entries from server to get the latest data including transcript_id
            await getEntries(userId);
            
            // Dispatch custom event to notify Transcript component to refresh
            window.dispatchEvent(new CustomEvent('entryCreated'));
            
            // Expand the date
            setExpandedDays(prev => new Set([...prev, journalDate]));

            // Reset form
            setScript("");
            setJournalDate(getLocalDateString());
            setRecordingData({ duration_ms: null, local_path: null });

            // Close the popup
            setPopupActive(false);
        } catch (error) {
            console.error('Error creating entry:', error);
            if (error.response?.status === 404 && error.response?.data?.message?.includes('not found in local database')) {
                alert('Your account needs to be synced. Please contact support.');
            } else {
                alert('Failed to save journal entry. Please try again.');
            }
        }
    };

    const handleRecordingComplete = (data) => {
        setRecordingData({
            duration_ms: data.duration_ms,
            local_path: data.local_path,
        });
    };

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

    const handleUpdateJournalDate = async (entryId, newDate) => {
        if (!userId || !token) return;
        try {
            const response = await axios.patch(
                API_BASE + '/users/' + userId + '/entries/' + entryId,
                { journal_date: newDate },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            
            // Refresh entries
            await getEntries(userId);
            setEditingEntryId(null);
        } catch (error) {
            console.error('Error updating date:', error);
            alert('Failed to update journal date');
        }
    };

    const handleUpdateTranscript = async (entryId, newTranscript) => {
        if (!userId || !token) return;
        try {
            const response = await axios.patch(
                API_BASE + '/users/' + userId + '/entries/' + entryId,
                { transcript: newTranscript },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            
            // Refresh entries to update merged transcript
            await getEntries(userId);
            setEditingTranscriptId(null);
        } catch (error) {
            console.error('Error updating transcript:', error);
            alert('Failed to update transcript');
        }
    };

    const groupedEntries = groupEntriesByDate(entries);
    const totalEntries = entries.length;

    return (
        <>
            {/* Top Section - Recording Controls */}
            {showRecordingControls && (
                <div className="bg-brand-dark rounded-xl shadow-lg border border-white/10 overflow-hidden mb-6">
                    <div className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                            <div>
                                <h2 className="text-xl font-bold font-display tracking-wide text-white">Record New Entry</h2>
                                <p className="text-sm text-stone-400 mt-0.5 font-sans">Capture your thoughts for today</p>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-brand-orange/30 transition-colors">
                                <label className="text-sm font-medium text-stone-300 whitespace-nowrap font-sans">
                                    Date:
                                </label>
                                <input
                                    type="date"
                                    value={journalDate}
                                    onChange={(e) => setJournalDate(e.target.value)}
                                    className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer font-sans [color-scheme:dark]"
                                    max={getLocalDateString()}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center py-6 bg-black/20 rounded-xl border border-white/10 border-dashed mb-5">
                            <Audio onRecordingComplete={handleRecordingComplete} showTimer={true} journalDate={journalDate} />
                        </div>

                        {script && (
                            <div className="mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-stone-300 font-sans">Transcript Preview</label>
                                    <span className="text-xs text-brand-orange bg-brand-orange/10 px-2 py-1 rounded-full font-sans border border-brand-orange/20">Auto-generated</span>
                                </div>
                                <div className="p-3 bg-black/20 border border-white/10 rounded-lg shadow-inner max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-transparent">
                                    <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap font-sans">{script}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-1">
                            <button
                                onClick={() => {
                                    if (script && script.trim() !== '') {
                                        handleCreateEntry({ preventDefault: () => {} });
                                    } else {
                                        alert('Please record a journal entry first');
                                    }
                                }}
                                disabled={!script || script.trim() === ''}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-brand-orange to-brand-red text-white rounded-lg font-bold font-sans uppercase text-sm tracking-wide hover:shadow-lg hover:shadow-brand-orange/20 active:transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
                            >
                                <span>Save Entry</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Journal Entries List - Grouped by Date */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-6 px-2">
                    <div>
                        <h2 className="text-2xl font-bold text-white font-display uppercase tracking-wide" style={{ textShadow: "0 2px 0 #B31F19" }}>My Journals</h2>
                        <p className="text-sm text-stone-500 font-medium mt-1 font-sans">{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} total</p>
                    </div>
                    {!showRecordingControls && (
                        <button 
                            onClick={() => setPopupActive(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-red text-white rounded-lg font-bold font-sans hover:shadow-lg hover:shadow-brand-orange/20 transition-all duration-200"
                        >
                            <span className="text-lg">+</span>
                            <span>New Entry</span>
                        </button>
                    )}
                </div>

                {/* Entries List - Grouped by Date */}
                <div className="">
                    {totalEntries === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-12 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                                <span className="text-3xl">📝</span>
                            </div>
                            <p className="text-stone-300 font-semibold text-lg font-sans">No journal entries yet</p>
                            <p className="text-sm text-stone-500 mt-1 font-sans">Record your first entry to get started</p>
                        </div>
                    ) : (
                        Object.keys(groupedEntries).map((date) => {
                            const dayEntries = groupedEntries[date];
                            const isExpanded = expandedDays.has(date);
                            const mergedTranscript = getMergedTranscript(dayEntries);
                            
                            return (
                                <DayGroup
                                    key={date}
                                    date={date}
                                    entries={dayEntries}
                                    isExpanded={isExpanded}
                                    onToggle={() => toggleDay(date)}
                                    mergedTranscript={mergedTranscript}
                                    onEntriesChange={setEntries}
                                    onRefresh={() => getEntries(userId)}
                                    editingEntryId={editingEntryId}
                                    setEditingEntryId={setEditingEntryId}
                                    editJournalDate={editJournalDate}
                                    setEditJournalDate={setEditJournalDate}
                                    onUpdateDate={handleUpdateJournalDate}
                                    editingTranscriptId={editingTranscriptId}
                                    setEditingTranscriptId={setEditingTranscriptId}
                                    editTranscript={editTranscript}
                                    setEditTranscript={setEditTranscript}
                                    onUpdateTranscript={handleUpdateTranscript}
                                    userId={userId}
                                    token={token}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modal for Recording (if not using top section) */}
            {!showRecordingControls && popupActive && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-brand-dark rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 bg-black/40 rounded-t-lg flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-white font-display uppercase">Record Your Journal</h3>
                            <button 
                                onClick={() => setPopupActive(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white"
                            >
                                <span className="text-xl font-bold">×</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-6">
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-stone-300 mb-2 font-sans">
                                    Journal Date
                                </label>
                                <input
                                    type="date"
                                    value={journalDate}
                                    onChange={(e) => setJournalDate(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-white/10 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange bg-black/20 text-white font-sans [color-scheme:dark]"
                                    max={getLocalDateString()}
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-stone-300 mb-2 font-sans">
                                    Record Audio
                                </label>
                                <Audio onRecordingComplete={handleRecordingComplete} journalDate={journalDate} />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-stone-300 mb-2 font-sans">
                                    Transcript Preview
                                </label>
                                <div className="bg-black/20 border border-white/10 rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-600">
                                    {script ? (
                                        <p className="text-stone-300 leading-relaxed whitespace-pre-wrap font-sans">{script}</p>
                                    ) : (
                                        <p className="text-stone-500 italic font-sans">Your transcript will appear here after recording...</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-white/10 bg-white/5 rounded-b-lg flex items-center justify-end gap-3">
                            <button 
                                onClick={() => setPopupActive(false)}
                                className="px-4 py-2 text-stone-300 font-medium rounded-lg hover:bg-white/10 transition-colors border border-white/10 font-sans"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreateEntry}
                                disabled={!script || script.trim() === ''}
                                className="px-6 py-2.5 bg-gradient-to-r from-brand-orange to-brand-red text-white font-bold rounded-lg hover:shadow-lg hover:shadow-brand-orange/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-sans uppercase tracking-wide"
                            >
                                Save Journal Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// Day Group Component
const DayGroup = ({ 
    date, 
    entries, 
    isExpanded, 
    onToggle, 
    mergedTranscript,
    onEntriesChange,
    onRefresh,
    editingEntryId,
    setEditingEntryId,
    editJournalDate,
    setEditJournalDate,
    onUpdateDate,
    editingTranscriptId,
    setEditingTranscriptId,
    editTranscript,
    setEditTranscript,
    onUpdateTranscript,
    userId,
    token,
}) => {
    const formatDateHeader = (dateString, entries) => {
        const date = new Date(dateString);
        const today = getLocalDateString();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = getLocalDateStringFromDate(yesterdayDate);

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

    // Google Drive sync will be implemented here

    return (
        <div className="mb-8">
            {/* Date Header - Minimalist with Line */}
            <div 
                className="flex items-center gap-3 mb-4 cursor-pointer group select-none"
                onClick={onToggle}
            >
                <div className={`text-brand-orange text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                </div>
                <h3 className="font-display text-lg text-white uppercase tracking-wide group-hover:text-brand-orange transition-colors">
                    {formatDateHeader(date, entries)}
                </h3>
                <span className="text-xs text-stone-500 font-sans font-medium">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
                <div className="h-px bg-white/10 flex-1 ml-2 group-hover:bg-white/20 transition-colors"></div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="space-y-3 pl-2">
                    {entries.map((entry) => (
                        <Entry 
                            key={entry.id} 
                            entry={entry} 
                            entries={entries} 
                            onEntriesChange={onEntriesChange}
                            onRefresh={onRefresh}
                            editingEntryId={editingEntryId}
                            setEditingEntryId={setEditingEntryId}
                            editJournalDate={editJournalDate}
                            setEditJournalDate={setEditJournalDate}
                            onUpdateDate={onUpdateDate}
                            editingTranscriptId={editingTranscriptId}
                            setEditingTranscriptId={setEditingTranscriptId}
                            editTranscript={editTranscript}
                            setEditTranscript={setEditTranscript}
                            onUpdateTranscript={onUpdateTranscript}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Entry Component
const Entry = ({ 
    entry, 
    entries, 
    onEntriesChange,
    onRefresh,
    editingEntryId,
    setEditingEntryId,
    editJournalDate,
    setEditJournalDate,
    onUpdateDate,
    editingTranscriptId,
    setEditingTranscriptId,
    editTranscript,
    setEditTranscript,
    onUpdateTranscript
}) => {
    const {entryId, setEntryId} = useEntryId();
    const { token } = useAuth();
    const { userId } = useContext(UserIdContext);
    const {selectedentryId, setSelectedentryId} = useSelectedentryId();
    const { setSelectedEntry } = useSelectedEntry();
    const [audioURL, setAudioURL] = useState(null);
    const [audioError, setAudioError] = useState(null);

    // Load audio file if local_path exists
    useEffect(() => {
        const loadAudio = async () => {
            if (!entry.local_path) {
                setAudioURL(null);
                setAudioError(null);
                return;
            }

            setAudioError(null);

            // Check if it's a full URL (old format) or just a filename (new format)
            if (entry.local_path.startsWith('http://') || entry.local_path.startsWith('https://')) {
                // Old format: public URL (for backwards compatibility)
                let fixedUrl = entry.local_path;
                if (fixedUrl.includes('/audio/audio/')) {
                    fixedUrl = fixedUrl.replace('/audio/audio/', '/audio/');
                }
                setAudioURL(fixedUrl);
            } else {
                // New format: filename only (e.g., "01-24-2026--01--300.mp3")
                // Get public URL from Supabase storage
                try {
                    // Clean the file path - remove any "audio/" prefix if present
                    let filePath = entry.local_path;
                    console.log('Original local_path:', filePath);
                    
                    if (filePath.startsWith('audio/')) {
                        filePath = filePath.replace('audio/', '');
                    }
                    // Remove any double audio/audio/ paths
                    filePath = filePath.replace(/audio\/audio\//g, '');
                    // Remove any leading slashes
                    filePath = filePath.replace(/^\/+/, '');
                    
                    console.log('Cleaned filePath for public URL:', filePath);
                    console.log('Entry ID:', entry.id, 'Entry date:', entry.journal_date);
                    
                    // Get public URL from Supabase storage (bucket is public)
                    const { data: publicUrlData } = supabase.storage
                        .from('audio')
                        .getPublicUrl(filePath);
                    
                    if (publicUrlData?.publicUrl) {
                        console.log('Successfully generated public URL for:', filePath);
                        console.log('Public URL:', publicUrlData.publicUrl);
                        setAudioURL(publicUrlData.publicUrl);
                    } else {
                        console.error('No public URL returned, data:', publicUrlData);
                        setAudioError('Audio file not found');
                        setAudioURL(null);
                    }
                } catch (err) {
                    console.error('Error loading audio:', err);
                    console.error('Error stack:', err.stack);
                    setAudioError('Unable to load audio');
                    setAudioURL(null);
                }
            }
        };

        loadAudio();
    }, [entry.local_path]);

    const deleteEntry = async() => {
        if (!userId || !token || !entry.id) return;
        try {
            await axios.delete(
                API_BASE + '/users/'+ userId + '/entries/' + entry.id,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            onRefresh();
        } catch (error) {
            console.error('Error deleting entry:', error);
            if (error.response?.status === 404) {
                // Entry doesn't exist in backend - refresh list to sync with backend state
                console.log('Entry not found in backend, refreshing list to sync...');
                onRefresh();
            } else {
                alert('Failed to delete entry. Please try again.');
            }
        }
    };

    const handleDeleteEntry = (e) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this entry?')) {
            deleteEntry();
        }
    };

    const handleDivClick = (e) => {
        e.preventDefault();
        setEntryId(entry.id);
        setSelectedentryId(entry.id);
        // Set the full entry object for instant transcript display
        setSelectedEntry(entry);
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (ms) => {
        if (!ms) return 'N/A';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const isSelected = entry.id === selectedentryId;
    const isEditing = editingEntryId === entry.id;

    return (
        <div 
            className={`group rounded-xl p-4 transition-all duration-300 border ${
                isSelected 
                    ? 'bg-brand-orange/5 border-brand-orange/30 shadow-[0_0_20px_rgba(235,116,55,0.05)]' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 hover:shadow-lg hover:shadow-black/20'
            }`}
            onClick={handleDivClick}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                    {/* Entry #, Date, and Time - Inline */}
                    {isEditing ? (
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded border border-brand-orange/20 font-sans">Entry #{entry.id}</span>
                            <span className="text-xs text-stone-500">•</span>
                            <input
                                type="date"
                                value={editJournalDate}
                                onChange={(e) => setEditJournalDate(e.target.value)}
                                className="text-xs px-2 py-1 border border-white/20 rounded focus:ring-2 focus:ring-brand-orange focus:border-brand-orange bg-black/40 text-white font-sans [color-scheme:dark]"
                                max={getLocalDateString()}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-xs text-stone-400 font-medium font-sans">{formatTime(entry.created_at)}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateDate(entry.id, editJournalDate);
                                }}
                                className="text-xs px-2 py-1 bg-brand-orange text-white rounded hover:bg-orange-600 transition-colors font-sans"
                            >
                                Save
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEntryId(null);
                                }}
                                className="text-xs px-2 py-1 bg-stone-700 text-white rounded hover:bg-stone-600 transition-colors font-sans"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded border border-brand-orange/20 font-sans">Entry #{entry.id}</span>
                            <span className="text-xs text-stone-500">•</span>
                            <span className="text-xs text-stone-400 font-medium bg-white/5 px-2 py-0.5 rounded border border-white/10 font-sans">Date: {entry.journal_date || entry.created_at.split('T')[0]} {formatTime(entry.created_at)}</span>
                        </div>
                    )}

                    {/* Transcript - Editable */}
                    {editingTranscriptId === entry.id ? (
                        <div className="mb-3">
                            <textarea
                                value={editTranscript}
                                onChange={(e) => setEditTranscript(e.target.value)}
                                className="w-full text-sm text-white p-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-brand-orange focus:border-brand-orange resize-y min-h-[80px] bg-black/40 font-sans leading-relaxed"
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Enter transcript text..."
                            />
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateTranscript(entry.id, editTranscript);
                                    }}
                                    className="text-xs px-3 py-1.5 bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors font-sans font-medium"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTranscriptId(null);
                                        setEditTranscript("");
                                    }}
                                    className="text-xs px-3 py-1.5 bg-white/10 text-stone-300 rounded-lg hover:bg-white/20 transition-colors font-sans font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-stone-300 leading-relaxed font-sans mb-3">
                            {entry.transcript || 'No transcript available'}
                        </p>
                    )}

                    {/* Audio Playback - Pill Style */}
                    {entry.local_path && (
                        <div 
                            className="bg-white/5 rounded-full p-3 shadow-inner border border-white/10 flex items-center gap-3 max-w-full" 
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <audio 
                                controls 
                                className="w-full h-14 invert opacity-90"
                                src={audioURL}
                                preload="metadata"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onPlay={(e) => e.stopPropagation()}
                                onError={(e) => {
                                    const error = e.target.error;
                                    if (error) {
                                        let errorMsg = 'Unable to play audio';
                                        if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                                            errorMsg = 'Audio format not supported';
                                        } else if (error.code === MediaError.MEDIA_ERR_NETWORK) {
                                            errorMsg = 'Network error loading audio';
                                        } else if (error.code === MediaError.MEDIA_ERR_DECODE) {
                                            errorMsg = 'Audio file corrupted or invalid';
                                        }
                                        setAudioError(errorMsg);
                                        console.error('Audio playback error:', errorMsg, audioURL);
                                    }
                                }}
                                onLoadedMetadata={(e) => {
                                    setAudioError(null);
                                }}
                            >
                                Your browser does not support audio playback.
                            </audio>
                        </div>
                    )}
                    
                    {audioError && (
                        <p className="text-xs text-brand-red italic font-sans mt-1 ml-2">
                            {audioError}
                        </p>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 mt-3">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditingTranscriptId(entry.id);
                        setEditTranscript(entry.transcript || '');
                    }}
                    className="text-xs px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-white rounded font-medium transition-colors font-sans"
                    title="Edit transcript"
                >
                    Edit Transcript
                </button>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditingEntryId(entry.id);
                        setEditJournalDate(entry.journal_date || entry.created_at.split('T')[0]);
                    }}
                    className="text-xs px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-white rounded font-medium transition-colors font-sans"
                    title="Edit date"
                >
                    Edit Date
                </button>
                <button 
                    onClick={handleDeleteEntry}
                    className="text-xs px-3 py-1.5 bg-brand-red/80 hover:bg-brand-red text-white rounded font-medium transition-colors font-sans"
                    title="Delete"
                >
                    Delete
                </button>
            </div>
        </div>
    );
};

export default EntryList;
