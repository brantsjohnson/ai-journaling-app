import { useState, useEffect } from "react";
import MicRecorder from "mic-recorder-to-mp3";
import axios from "axios";
import { useScript } from "./ScriptContext";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE } from "../config/api";

// #region agent log - Only in development
// Disable ALL debug calls in production - they trigger browser local network popups
const isDevelopment = import.meta.env.DEV && !import.meta.env.PROD && import.meta.env.MODE === 'development';
const DEBUG_INGEST = 'http://127.0.0.1:7242/ingest/763f5855-a7cf-4b2d-abed-e04d96151c45';
const dbg = (payload) => {
  // Completely disabled in production to prevent localhost connection attempts
  if (isDevelopment) {
    fetch(DEBUG_INGEST, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }) }).catch(() => {});
  }
};
// #endregion

//bitRate option is set to 128, which means the audio recorder will use a bit rate of 128 kbps (kilobits per second) when encoding the recorded audio into an MP3 file.
//Bit rate refers to the number of bits (binary digits) that are processed or transmitted per unit of time. In the context of audio recording, the bit rate determines the quality and size of the recorded audio file.

// Initialize recorder
// Bitrate set to 56 kbps to support 60-minute recordings (~25MB) while staying within OpenAI's 25MB limit
const recorder = new MicRecorder({ 
  bitRate: 56,
  encoder: 'mp3',
});

const AudioRecording = ({ onRecordingComplete, showTimer = false, entryId = null, onRetryTranscription = null, journalDate = null }) => {
  const { script,setScript } = useScript();
  const { token } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [blobURL, setBlobURL] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(null);
  const [savedAudioPath, setSavedAudioPath] = useState(null);
  const [wakeLock, setWakeLock] = useState(null);
  

  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          // Request audio with echo cancellation and noise suppression
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
            } 
          });
          console.log("Permission Granted");
          setMediaStream(stream);
          setIsBlocked(false);
          // Stop the stream immediately - we'll create a new one when recording
          stream.getTracks().forEach(track => track.stop());
        } else {
          const getUserMedia =
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia;

          if (getUserMedia) {
            getUserMedia(
              { 
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                } 
              },
              (stream) => {
                console.log("Permission Granted");
                setMediaStream(stream);
                setIsBlocked(false);
                stream.getTracks().forEach(track => track.stop());
              },
              () => {
                console.log("Permission Denied");
                setIsBlocked(true);
              }
            );
          } else {
            console.log("getUserMedia is not supported in this browser.");
          }
        }
      } catch (error) {
        console.error("Error checking permission:", error);
        setIsBlocked(true);
      }
    };

    checkPermission();

    // Check for emergency recording on mount
    const checkEmergencyRecording = () => {
      const emergencyData = localStorage.getItem('emergency_recording');
      if (emergencyData) {
        try {
          const data = JSON.parse(emergencyData);
          const timestamp = new Date(data.timestamp);
          const timeAgo = Date.now() - data.timestamp;
          
          // Only show if it's from the last session (within 1 hour)
          if (timeAgo < 3600000) {
            const shouldRestore = window.confirm(
              `An emergency recording was saved ${Math.round(timeAgo / 1000 / 60)} minutes ago when you left the page. Would you like to restore it?`
            );
            
            if (shouldRestore) {
              // Convert base64 back to blob
              fetch(data.audio)
                .then(res => res.blob())
                .then(blob => {
                  const file = new File([blob], "emergency_recording.mp3", { type: "audio/mpeg" });
                  setAudioFile(file);
                  setBlobURL(URL.createObjectURL(blob));
                  setDuration(data.duration);
                  console.log('Emergency recording restored');
                });
            }
            
            // Clear emergency recording
            localStorage.removeItem('emergency_recording');
          } else {
            // Old emergency recording, remove it
            localStorage.removeItem('emergency_recording');
          }
        } catch (err) {
          console.error('Error parsing emergency recording:', err);
          localStorage.removeItem('emergency_recording');
        }
      }
    };

    checkEmergencyRecording();

    // Restore audio state from localStorage on mount
    const restoreAudioState = () => {
      try {
        const storedBlobURL = localStorage.getItem('audio_blob_url');
        const storedAudioFile = localStorage.getItem('audio_file');
        const storedDuration = localStorage.getItem('audio_duration');
        
        if (storedBlobURL && storedAudioFile) {
          try {
            // Restore blob URL
            setBlobURL(storedBlobURL);
            
            // Restore audio file from base64
            const audioData = JSON.parse(storedAudioFile);
            fetch(audioData.dataURL)
              .then(res => res.blob())
              .then(blob => {
                const file = new File([blob], audioData.name || "audio.mp3", {
                  type: audioData.type || "audio/mpeg",
                  lastModified: audioData.lastModified || Date.now(),
                });
                setAudioFile(file);
                if (storedDuration) {
                  setDuration(parseInt(storedDuration, 10));
                }
                console.log('Audio state restored from localStorage');
              })
              .catch(err => {
                console.error('Error restoring audio file:', err);
                // Clear invalid data
                localStorage.removeItem('audio_blob_url');
                localStorage.removeItem('audio_file');
                localStorage.removeItem('audio_duration');
              });
          } catch (err) {
            console.error('Error parsing stored audio:', err);
            localStorage.removeItem('audio_blob_url');
            localStorage.removeItem('audio_file');
            localStorage.removeItem('audio_duration');
          }
        }
      } catch (err) {
        console.error('Error restoring audio state:', err);
      }
    };

    restoreAudioState();

    // Cleanup on unmount
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      // Release Wake Lock if still active
      if (wakeLock) {
        wakeLock.release().catch(err => console.error('Error releasing Wake Lock on unmount:', err));
      }
    };
  }, [wakeLock]);

  // Listen for clearAudio event to clear audio when transcript is deleted
  useEffect(() => {
    const handleClearAudio = () => {
      if (blobURL) {
        URL.revokeObjectURL(blobURL);
      }
      setBlobURL('');
      setAudioFile(null);
      setDuration(0);
    };
    window.addEventListener('clearAudio', handleClearAudio);
    return () => window.removeEventListener('clearAudio', handleClearAudio);
  }, [blobURL]);

  // Handle recording interruption (page navigation, tab switch, screen lock, etc.)
  useEffect(() => {
    if (!isRecording) return;

    const handleBeforeUnload = (e) => {
      // If recording is in progress, try to save it
      if (isRecording && recorder) {
        e.preventDefault();
        e.returnValue = 'You are currently recording. Are you sure you want to leave?';
        
        // Try to stop and save recording
        try {
          recorder.stop().getMp3().then(async ([buffer, blob]) => {
            const recordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;
            const file = new File(buffer, "audio_emergency_save.mp3", {
              type: blob.type,
              lastModified: Date.now(),
            });
            
            // Store in localStorage as emergency backup
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result;
              localStorage.setItem('emergency_recording', JSON.stringify({
                audio: base64data,
                duration: recordingDuration,
                timestamp: Date.now(),
              }));
            };
            reader.readAsDataURL(blob);
          }).catch(err => {
            console.error('Error saving emergency recording:', err);
          });
        } catch (err) {
          console.error('Error in emergency save:', err);
        }
      }
      return e.returnValue;
    };

    const handleVisibilityChange = async () => {
      // If page becomes hidden (tab switch, minimize, screen lock) and recording is active
      if (document.hidden && isRecording) {
        console.log('Page hidden during recording - recording continues in background');
        
        // Try to reacquire Wake Lock if it was released
        if (!wakeLock && 'wakeLock' in navigator) {
          try {
            const lock = await navigator.wakeLock.request('screen');
            setWakeLock(lock);
            console.log('Wake Lock reacquired');
            
            lock.addEventListener('release', () => {
              console.log('Wake Lock released');
              setWakeLock(null);
            });
          } catch (err) {
            console.warn('Could not reacquire Wake Lock:', err);
          }
        }
        
        // Don't stop recording - just log that it's continuing
        // The recording will continue as long as the browser allows
      } else if (!document.hidden && isRecording) {
        // Page is visible again - ensure Wake Lock is active
        if (!wakeLock && 'wakeLock' in navigator) {
          try {
            const lock = await navigator.wakeLock.request('screen');
            setWakeLock(lock);
            console.log('Wake Lock reacquired after page visible');
            
            lock.addEventListener('release', () => {
              console.log('Wake Lock released');
              setWakeLock(null);
            });
          } catch (err) {
            console.warn('Could not reacquire Wake Lock:', err);
          }
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRecording, recordingStartTime, mediaStream, wakeLock]);

  const start = async () => {
    if (isBlocked) {
      console.log("Permission Denied");
      return;
    }

    try {
      // Clear any previous audio playback to prevent echo
      if (blobURL) {
        URL.revokeObjectURL(blobURL);
        setBlobURL("");
      }

      // Request Wake Lock to keep device awake during recording
      if ('wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
          console.log('Wake Lock acquired - device will stay awake during recording');
          
          // Handle Wake Lock release (e.g., when user manually locks screen)
          lock.addEventListener('release', () => {
            console.log('Wake Lock released');
            setWakeLock(null);
          });
        } catch (err) {
          console.warn('Wake Lock not available:', err);
          // Continue recording even if Wake Lock fails
        }
      }

      // Get a fresh MediaStream with echo cancellation for recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          // Additional constraint to prevent feedback
          googEchoCancellation: true,
          googNoiseSuppression: true,
          googAutoGainControl: true,
        } 
      });

      // Start recorder - MicRecorder will use the active stream
      await recorder.start();
      
      const startTime = Date.now();
      setRecordingStartTime(startTime);
      setElapsedTime(0);
      setIsRecording(true);
      setMediaStream(stream);
      
      // Store recording state in localStorage for recovery
      localStorage.setItem('recording_active', 'true');
      localStorage.setItem('recording_start_time', startTime.toString());
      
      // Start timer interval if showTimer is true
      if (showTimer) {
        // Clear any existing interval
        if (window.recordingTimerInterval) {
          clearInterval(window.recordingTimerInterval);
        }
        
        const timerInterval = setInterval(() => {
          const currentTime = Date.now();
          setElapsedTime(currentTime - startTime);
        }, 100);
        
        // Store interval ID to clear it later
        window.recordingTimerInterval = timerInterval;
      }
    } catch (e) {
      console.error("Error starting recording:", e);
      alert("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stop = () => {
    // Release Wake Lock
    if (wakeLock) {
      wakeLock.release().then(() => {
        console.log('Wake Lock released');
        setWakeLock(null);
      }).catch(err => {
        console.error('Error releasing Wake Lock:', err);
      });
    }
    
    // Clear recording state from localStorage
    localStorage.removeItem('recording_active');
    localStorage.removeItem('recording_start_time');
    
    // Clear timer interval
    if (window.recordingTimerInterval) {
      clearInterval(window.recordingTimerInterval);
      window.recordingTimerInterval = null;
    }
    
    // Stop the media stream tracks to release the microphone
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }

    recorder
      .stop()
      .getMp3()
      .then(async ([buffer, blob]) => {
        // Calculate duration
        const recordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;
        setDuration(recordingDuration);
        setRecordingStartTime(null);

        const blobURL = URL.createObjectURL(blob);
        setBlobURL(blobURL);

        const file = new File(buffer, "audio.mp3", {
          type: blob.type,
          lastModified: Date.now(),
        });

        setAudioFile(file); // Store the file for later use

        // Persist audio state to localStorage
        try {
          localStorage.setItem('audio_blob_url', blobURL);
          localStorage.setItem('audio_duration', recordingDuration.toString());
          
          // Convert file to base64 for storage
          const reader = new FileReader();
          reader.onloadend = () => {
            const audioFileData = {
              name: file.name,
              type: file.type,
              lastModified: file.lastModified,
              dataURL: reader.result,
            };
            localStorage.setItem('audio_file', JSON.stringify(audioFileData));
          };
          reader.readAsDataURL(file);
        } catch (err) {
          console.error('Error saving audio to localStorage:', err);
        }

        // Use the file directly for upload (no need to convert back and forth)
        const audioFileForUpload = file;

        // Create FormData to send to backend
        const formData = new FormData();
        formData.append("audio", audioFileForUpload);
        if (journalDate) {
          formData.append("journal_date", journalDate);
        }
        // Include duration for filename generation
        formData.append("duration_ms", recordingDuration.toString());

        const fullUrl = `${API_BASE}/transcribe`;
        // #region agent log
        dbg({ location: 'Audio.jsx:pre-send', message: 'About to POST /transcribe', data: { fullUrl, hasToken: !!token, fileSize: file.size, fileType: file.type, journalDate: journalDate || null, contentTypeExplicit: true }, hypothesisId: 'H2,H5' });
        // #endregion

        // Show transcribing loader
        setIsTranscribing(true);
        setTranscriptionError(null);

        // Send to backend proxy endpoint (which will call OpenAI)
        axios({
          method: "post",
          url: fullUrl,
          data: formData,
          headers: {
            "Content-Type": "multipart/form-data",
            "Authorization": `Bearer ${token}`,
          },
        })
          .then(async (response) => {
            const transcript = response.data.data.transcript;
            const local_path = response.data.data.local_path;
            const language = response.data.data.language;
            const confidence = response.data.data.confidence;

            // #region agent log
            dbg({ location: 'Audio.jsx:success', message: 'Transcribe succeeded', data: { status: response.status, hasTranscript: !!transcript, localPath: !!local_path }, hypothesisId: 'H4' });
            // #endregion
            
            console.log("Transcript:", transcript);
            console.log("Audio saved at:", local_path);
           
            setScript(transcript);
            setSavedAudioPath(local_path);
            
            // Save transcript to transcripts table if entryId is provided
            if (entryId && token) {
              try {
                await axios.post(
                  `${API_BASE}/transcripts`,
                  {
                    recording_id: entryId,
                    text: transcript,
                    language: language,
                    confidence: confidence,
                  },
                  {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );
                console.log("Transcript saved to database");
              } catch (transcriptError) {
                console.error("Error saving transcript to database:", transcriptError);
                // Don't fail the whole process if transcript saving fails
              }
            }
            
            // Notify parent component about recording completion
            if (onRecordingComplete) {
              onRecordingComplete({
                transcript,
                duration_ms: recordingDuration,
                local_path,
                audioFile: file,
              });
            }
            
            setIsTranscribing(false);
          })
          .catch((error) => {
            const status = error.response?.status;
            const msg = error.response?.data?.message ?? null;
            const errBody = error.response?.data?.error ?? null;
            const errorDetails = error.response?.data?.details ?? null;
            // #region agent log
            dbg({ location: 'Audio.jsx:catch', message: 'Transcribe request failed', data: { status, message: msg, error: errBody, code: error.code }, hypothesisId: 'H1,H2,H3,H4' });
            // #endregion
            console.error("Transcription error:", error);
            setIsTranscribing(false);
            
            // Build a more helpful error message
            let errorMessage = "Transcription failed.";
            
            if (msg) {
              errorMessage = msg;
            } else if (errBody) {
              errorMessage = typeof errBody === 'string' ? errBody : `Error: ${JSON.stringify(errBody)}`;
            } else if (status === 401) {
              errorMessage = "Authentication failed. Please check your OpenAI API key in Vercel environment variables.";
            } else if (status === 429) {
              errorMessage = "Rate limit exceeded. Please check your OpenAI account billing or try again later.";
            } else if (status === 413 || error.code === 'ECONNABORTED') {
              errorMessage = "File too large or request timed out. Try a shorter recording.";
            } else if (status) {
              errorMessage = `Transcription failed (Status: ${status}). Please try again.`;
            } else if (error.code === 'ECONNABORTED') {
              errorMessage = "Request timed out. The audio file may be too long. Please try again.";
            } else if (error.message) {
              errorMessage = `Error: ${error.message}`;
            }
            
            setTranscriptionError({
              message: errorMessage,
              audio_saved: error.response?.data?.audio_saved || false,
            });
          });

        setIsRecording(false);
      })
      .catch((e) => console.error(e));
  };

  const audioToBase64 = async (audioFile) => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(audioFile);
    });
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleRetryTranscription = async () => {
    if (!savedAudioPath && !audioFile) {
      alert("No audio file available to retry transcription");
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      const formData = new FormData();
      
      // If we have the audio file, use it; otherwise, we'd need to fetch from savedAudioPath
      if (audioFile) {
        formData.append("audio", audioFile);
      } else {
        // Fetch audio from saved path and create a file
        const response = await fetch(`${API_BASE}/audio/${savedAudioPath}`);
        const blob = await response.blob();
        const file = new File([blob], "audio.mp3", { type: "audio/mpeg" });
        formData.append("audio", file);
      }
      
      if (journalDate) {
        formData.append("journal_date", journalDate);
      }

      const response = await axios({
        method: "post",
        url: `${API_BASE}/transcribe`,
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`,
        },
      });

      const transcript = response.data.data.transcript;
      const local_path = response.data.data.local_path;
      const language = response.data.data.language;
      const confidence = response.data.data.confidence;

      setScript(transcript);
      setSavedAudioPath(local_path);

      // Save transcript to transcripts table if entryId is provided
      if (entryId && token) {
        try {
          await axios.post(
            `${API_BASE}/transcripts`,
            {
              recording_id: entryId,
              text: transcript,
              language: language,
              confidence: confidence,
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
        } catch (transcriptError) {
          console.error("Error saving transcript to database:", transcriptError);
        }
      }

      if (onRecordingComplete) {
        onRecordingComplete({
          transcript,
          duration_ms: duration,
          local_path,
          audioFile: audioFile,
        });
      }

      setIsTranscribing(false);
    } catch (error) {
      console.error("Retry transcription error:", error);
      setIsTranscribing(false);
      setTranscriptionError({
        message: error.response?.data?.message || "Transcription failed. Please try again.",
        audio_saved: error.response?.data?.audio_saved || false,
      });
    }
  };

  return (
    <div className='flex flex-col gap-4 w-full max-w-md mx-auto'>
      <div className="flex items-center justify-center gap-6">
        <button 
          onClick={start} 
          disabled={isRecording || isTranscribing} 
          className='w-16 h-16 flex items-center justify-center bg-gradient-to-br from-brand-orange to-brand-red text-white rounded-full shadow-lg hover:shadow-brand-orange/30 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
          title="Start Recording"
        >
          <span className="text-3xl drop-shadow-sm">🎤</span>
        </button>
        <button 
          onClick={stop} 
          disabled={!isRecording || isTranscribing} 
          className='w-16 h-16 flex items-center justify-center bg-stone-700 text-white rounded-full shadow-lg hover:bg-stone-600 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
          title="Stop Recording"
        >
          <span className="text-2xl drop-shadow-sm">⏹</span>
        </button>
      </div>
        
      {(isRecording || isTranscribing) && (
        <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
          {isRecording && (
            <div className="flex items-center gap-2 bg-brand-red/10 px-4 py-1.5 rounded-full border border-brand-red/20">
              <span className="w-2.5 h-2.5 bg-brand-red rounded-full animate-pulse"></span>
              <span className="text-sm text-brand-red font-semibold font-sans">Recording</span>
              {showTimer && (
                <span className="text-sm font-bold text-brand-red font-mono ml-1 border-l border-brand-red/20 pl-2">
                  {formatTime(elapsedTime)}
                </span>
              )}
            </div>
          )}
          {isTranscribing && (
            <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-blue-400 font-medium font-sans">Transcribing...</span>
            </div>
          )}
        </div>
      )}
      
      {/* Transcription Error with Retry */}
      {transcriptionError && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-center">
          <p className="text-sm text-red-300 mb-2 font-sans">{transcriptionError.message}</p>
          {transcriptionError.audio_saved && (
            <p className="text-xs text-red-400 mb-2 font-sans">✓ Audio file saved. You can retry transcription.</p>
          )}
          <button
            onClick={handleRetryTranscription}
            disabled={isTranscribing}
            className="px-3 py-1 bg-brand-red text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50 font-sans"
          >
            {isTranscribing ? "Retrying..." : "Retry Transcription"}
          </button>
        </div>
      )}
      
      {blobURL && (
        <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-white/5 rounded-full p-2 shadow-inner border border-white/10">
            <audio 
              src={blobURL} 
              controls 
              muted 
              volume={0.3}
              className="w-full h-10 invert opacity-90"
              onPlay={(e) => {
                e.target.volume = 0.3;
                e.target.muted = false;
              }}
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                if (audioFile) {
                  const url = URL.createObjectURL(audioFile);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `recording-${new Date().toISOString().split('T')[0]}.mp3`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } else if (blobURL) {
                  fetch(blobURL)
                    .then(res => res.blob())
                    .then(blob => {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `recording-${new Date().toISOString().split('T')[0]}.mp3`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    });
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors font-sans flex items-center gap-2"
              title="Download audio file"
            >
              <span>💾</span> Download Audio
            </button>
          </div>
          <p className="text-xs text-stone-500 text-center flex items-center justify-center gap-1 font-sans">
            <span>🎧</span> Use headphones for best results
          </p>
        </div>
      )}
    </div>
    
    
  );
};



const Audio = ({ onRecordingComplete, showTimer = false, entryId = null, onRetryTranscription = null, journalDate = null }) => {
  return (
    <div>
      <AudioRecording 
        onRecordingComplete={onRecordingComplete} 
        showTimer={showTimer}
        entryId={entryId}
        onRetryTranscription={onRetryTranscription}
        journalDate={journalDate}
      />
    </div>
  );
};

export default Audio;