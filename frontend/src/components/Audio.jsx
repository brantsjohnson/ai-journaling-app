import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useScript } from "./ScriptContext";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE } from "../config/api";
import { supabase } from "../config/supabase";

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

// Use native MediaRecorder API instead of mic-recorder-to-mp3 (which uses deprecated ScriptProcessorNode
// and was causing silent recordings). MediaRecorder is well-supported and reliable across browsers.

const AudioRecording = ({ onRecordingComplete, showTimer = false, entryId = null, onRetryTranscription = null, journalDate = null }) => {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
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
  const [chunkingProgress, setChunkingProgress] = useState(null); // { current: 1, total: 3 }
  const [showLongRecordingWarning, setShowLongRecordingWarning] = useState(false);
  
  // Recording duration thresholds
  const WARNING_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  const RECOMMENDED_MAX_MS = 20 * 60 * 1000; // 20 minutes
  

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
            // Restore audio file from base64 - must create NEW blob URL (stored blob URLs are invalid after session)
            const audioData = JSON.parse(storedAudioFile);
            fetch(audioData.dataURL)
              .then(res => res.blob())
              .then(blob => {
                const file = new File([blob], audioData.name || "audio.mp3", {
                  type: audioData.type || "audio/mpeg",
                  lastModified: audioData.lastModified || Date.now(),
                });
                setAudioFile(file);
                setBlobURL(URL.createObjectURL(blob)); // Create fresh blob URL - stored one is invalid
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
      const mr = mediaRecorderRef.current;
      if (isRecording && mr && mr.state !== 'inactive') {
        e.preventDefault();
        e.returnValue = 'You are currently recording. Are you sure you want to leave?';
        try {
          const chunks = chunksRef.current;
          mr.onstop = () => {
            const blob = chunks.length > 0 ? new Blob(chunks, { type: mr.mimeType || 'audio/webm' }) : null;
            if (blob && blob.size > 0) {
              const reader = new FileReader();
              reader.onloadend = () => {
                localStorage.setItem('emergency_recording', JSON.stringify({
                  audio: reader.result,
                  duration: recordingStartTime ? Date.now() - recordingStartTime : 0,
                  timestamp: Date.now(),
                }));
              };
              reader.readAsDataURL(blob);
            }
          };
          mr.stop();
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

      // Get a fresh MediaStream - use permissive constraints (strict sampleRate can cause silent audio on some devices)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Avoid sampleRate - Chrome ignores it and strict values can cause issues on some devices
        } 
      });

      // Use MediaRecorder API - reliable, no deprecated ScriptProcessorNode
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(1000); // Collect data every second for reliability
      
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
          const elapsed = currentTime - startTime;
          setElapsedTime(elapsed);
          
          // Show warning when recording exceeds 15 minutes
          if (elapsed >= WARNING_DURATION_MS && !showLongRecordingWarning) {
            setShowLongRecordingWarning(true);
          }
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
    
    // Reset warning
    setShowLongRecordingWarning(false);
    
    // Clear timer interval
    if (window.recordingTimerInterval) {
      clearInterval(window.recordingTimerInterval);
      window.recordingTimerInterval = null;
    }
    
    const streamToStop = mediaStream;
    setMediaStream(null);
    setIsRecording(false);

    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      if (streamToStop) streamToStop.getTracks().forEach(track => track.stop());
      setIsTranscribing(false);
      return;
    }

    mediaRecorder.onstop = async () => {
      try {
        if (streamToStop) streamToStop.getTracks().forEach(track => track.stop());
        
        const recordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;
        setDuration(recordingDuration);
        setRecordingStartTime(null);

        const chunks = chunksRef.current;
        const blob = chunks.length > 0 ? new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' }) : null;
        
        if (!blob || blob.size < 1000) {
          setTranscriptionError({
            message: 'Recording failed: no audio captured. Please check microphone permissions and try again.',
            audio_saved: false,
          });
          setIsTranscribing(false);
          return;
        }

        const blobURL = URL.createObjectURL(blob);
        setBlobURL(blobURL);

        const ext = blob.type.includes('webm') ? 'webm' : 'mp3';
        const file = new File([blob], `audio.${ext}`, {
          type: blob.type,
          lastModified: Date.now(),
        });

        setAudioFile(file);

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

        // Upload directly to Supabase first (bypasses Vercel's 4.5MB limit)
        setIsTranscribing(true);
        setTranscriptionError(null);

        try {
          // Generate filename
          const dateParts = (journalDate || new Date().toISOString().split('T')[0]).split('-');
          const formattedDate = `${dateParts[1]}-${dateParts[2]}-${dateParts[0]}`;
          const durationSeconds = Math.round(recordingDuration / 1000);
          const uniqueSuffix = Date.now().toString().slice(-6);
          const filename = `${formattedDate}--01--${durationSeconds}--${uniqueSuffix}.${ext}`;
          
          const bucket = 'audio'; // Use your bucket name
          
          console.log('Uploading to Supabase:', { bucket, filename, fileSize: file.size });
          
          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filename, file, {
              contentType: file.type || 'audio/mpeg',
              upsert: true,
            });

          if (uploadError) {
            const errMsg = uploadError.message || 'Unknown upload error';
            throw new Error(`Supabase upload failed: ${errMsg}`);
          }

          const filePath = uploadData.path;
          console.log('File uploaded to Supabase:', filePath);

          // Transcribe (will handle chunking if needed)
          const response = await transcribeInChunks(file, filePath, recordingDuration);
          
          // Handle response (could be direct axios response or our combined response)
          const responseData = response.data || response;
          const data = responseData?.data || responseData;
          const transcript = (data?.transcript ?? '') || '';
          const local_path = data?.local_path;
          const language = data?.language;
          const confidence = data?.confidence;
          const chunked = data?.chunked || false;
          const chunksProcessed = data?.chunks_processed || 1;

          if (!local_path) {
            throw new Error('Transcription completed but audio path was not saved. Please try again.');
          }
          
          if (chunked) {
            console.log(`Transcribed in ${chunksProcessed} chunk(s)`);
          }

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
        } catch (error) {
          console.error("Transcription/Upload error:", error);
          setIsTranscribing(false);
          setChunkingProgress(null);
          let errorMessage = error.response?.data?.message || error.message || "Transcription failed. Please try again.";
          // Provide helpful message for RLS policy errors
          if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
            errorMessage = "Storage upload failed. The app needs a one-time Supabase configuration. See SUPABASE_UPLOAD_FIX.md for the fix.";
          }
          setTranscriptionError({
            message: errorMessage,
            audio_saved: error.response?.data?.audio_saved || false,
          });
        }
      } catch (e) {
        console.error("Recording error:", e);
        setIsTranscribing(false);
        setTranscriptionError({
          message: e?.message || "Recording failed. Please try again.",
          audio_saved: false,
        });
      }
    };

    mediaRecorder.stop();
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

  // Split audio file into chunks using Web Audio API
  // Splits by BOTH file size (20MB) AND duration (10 minutes) to avoid Vercel timeout
  const splitAudioIntoChunks = async (audioFile, maxChunkSizeMB = 20, maxChunkDurationMinutes = 10) => {
    const maxChunkSize = maxChunkSizeMB * 1024 * 1024; // Convert to bytes
    const maxChunkDurationSeconds = maxChunkDurationMinutes * 60;
    const fileSize = audioFile.size;

    try {
      // Decode audio file using Web Audio API to get duration
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const sampleRate = audioBuffer.sampleRate;
      const durationSeconds = audioBuffer.duration;
      const totalSamples = audioBuffer.length;
      
      // Check if file needs to be chunked (by size OR duration)
      const needsChunkingBySize = fileSize > maxChunkSize;
      const needsChunkingByDuration = durationSeconds > maxChunkDurationSeconds;
      
      // If file is small enough AND short enough, return as single chunk
      if (!needsChunkingBySize && !needsChunkingByDuration) {
        audioContext.close();
        return [{ file: audioFile, startTime: 0, endTime: durationSeconds, index: 1, total: 1 }];
      }

      // Calculate chunks needed for both constraints
      const chunksNeededBySize = Math.ceil(fileSize / maxChunkSize);
      const chunksNeededByDuration = Math.ceil(durationSeconds / maxChunkDurationSeconds);
      
      // Use whichever requires MORE chunks (stricter constraint)
      const numChunks = Math.max(chunksNeededBySize, chunksNeededByDuration);
      const chunkDurationSeconds = durationSeconds / numChunks;
      const chunkSamples = Math.floor(totalSamples / numChunks);
      
      console.log(`Splitting audio: ${durationSeconds.toFixed(1)}s, ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Creating ${numChunks} chunks of ~${chunkDurationSeconds.toFixed(1)}s / ~${((fileSize / numChunks) / 1024 / 1024).toFixed(2)}MB each`);
      console.log(`Reason: ${needsChunkingByDuration ? 'Duration limit (10min)' : 'File size limit (20MB)'}`)
      
      const chunks = [];
      
      for (let i = 0; i < numChunks; i++) {
        const startSample = i * chunkSamples;
        const endSample = Math.min(startSample + chunkSamples, totalSamples);
        const chunkLength = endSample - startSample;
        
        // Create new audio buffer for this chunk
        const chunkBuffer = audioContext.createBuffer(
          audioBuffer.numberOfChannels,
          chunkLength,
          sampleRate
        );
        
        // Copy audio data for each channel
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const originalData = audioBuffer.getChannelData(channel);
          const chunkData = chunkBuffer.getChannelData(channel);
          for (let j = 0; j < chunkLength; j++) {
            chunkData[j] = originalData[startSample + j];
          }
        }
        
        // Convert audio buffer back to WAV blob (MP3 encoding requires library)
        // For now, we'll use WAV format for chunks
        const wavBlob = audioBufferToWav(chunkBuffer);
        const chunkFile = new File([wavBlob], `chunk_${i + 1}.wav`, { type: 'audio/wav' });
        
        chunks.push({
          file: chunkFile,
          index: i + 1,
          total: numChunks,
          startTime: startSample / sampleRate,
          endTime: endSample / sampleRate,
        });
      }
      
      audioContext.close();
      return chunks;
    } catch (error) {
      console.error('Error splitting audio:', error);
      // Fallback: return original file
      return [{ file: audioFile, startTime: 0, endTime: duration || 0 }];
    }
  };

  // Convert AudioBuffer to WAV blob
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // Transcribe audio file in chunks
  const transcribeInChunks = async (file, filePath, recordingDuration) => {
    const CHUNK_SIZE_MB = 20; // Process in 20MB chunks (leaves buffer for OpenAI's 25MB limit)
    const CHUNK_DURATION_MINUTES = 10; // Process in 10-minute chunks (ensures each API call completes in ~3-4min, well under 13min Vercel timeout)
    
    const fileSizeMB = file.size / (1024 * 1024);
    const durationMinutes = recordingDuration / (1000 * 60);

    // Check if file needs chunking by size OR duration
    const needsChunkingBySize = fileSizeMB > CHUNK_SIZE_MB;
    const needsChunkingByDuration = durationMinutes > CHUNK_DURATION_MINUTES;

    // If file is small enough AND short enough, transcribe normally
    if (!needsChunkingBySize && !needsChunkingByDuration) {
      return await transcribeSingleChunk(filePath, recordingDuration);
    }

    // For large or long files, split and transcribe in chunks
    console.log(`File requires chunking: ${fileSizeMB.toFixed(2)}MB, ${durationMinutes.toFixed(1)} minutes`);
    console.log(`Reason: ${needsChunkingByDuration ? 'Exceeds 10-minute duration limit' : 'Exceeds 20MB size limit'}`);
    
    setChunkingProgress({ current: 0, total: 0 }); // Will update as we go
    
    const chunks = await splitAudioIntoChunks(file, CHUNK_SIZE_MB, CHUNK_DURATION_MINUTES);
    const numChunks = chunks.length;
    
    console.log(`Split into ${numChunks} chunks, transcribing each...`);
    setChunkingProgress({ current: 0, total: numChunks });
    
    const transcripts = [];
    const errors = [];
    
    // Upload and transcribe each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      setChunkingProgress({ current: i + 1, total: numChunks });
      
      try {
        // Upload chunk to Supabase
        const dateParts = (journalDate || new Date().toISOString().split('T')[0]).split('-');
        const formattedDate = `${dateParts[1]}-${dateParts[2]}-${dateParts[0]}`;
        const uniqueSuffix = Date.now().toString().slice(-6);
        const chunkFilename = `${formattedDate}--chunk-${chunk.index}--${uniqueSuffix}.wav`;
        
        const { data: chunkUploadData, error: chunkUploadError } = await supabase.storage
          .from('audio')
          .upload(chunkFilename, chunk.file, {
            contentType: 'audio/wav',
            upsert: true,
          });

        if (chunkUploadError) {
          throw new Error(`Failed to upload chunk ${chunk.index}: ${chunkUploadError.message}`);
        }

        // Transcribe this chunk
        const chunkResponse = await transcribeSingleChunk(chunkUploadData.path, (chunk.endTime - chunk.startTime) * 1000);
        
        if (chunkResponse.data?.data?.transcript) {
          transcripts.push({
            text: chunkResponse.data.data.transcript,
            index: chunk.index,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
          });
          console.log(`Chunk ${chunk.index}/${numChunks} transcribed successfully`);
        }
      } catch (error) {
        console.error(`Error transcribing chunk ${chunk.index}:`, error);
        errors.push({ chunk: chunk.index, error: error.message });
      }
    }
    
    // Combine all transcripts
    if (transcripts.length === 0) {
      throw new Error('Failed to transcribe any chunks. ' + (errors.length > 0 ? errors[0].error : ''));
    }
    
    // Sort by index and combine
    transcripts.sort((a, b) => a.index - b.index);
    const combinedTranscript = transcripts.map(t => t.text).join('\n\n');
    
    console.log(`Successfully transcribed ${transcripts.length}/${numChunks} chunks`);
    
    // Return combined transcript in the same format as single transcription
    return {
      data: {
        data: {
          transcript: combinedTranscript,
          local_path: filePath, // Use original file path
          file_size: file.size,
          language: null,
          confidence: null,
          chunked: true,
          chunks_processed: transcripts.length,
          total_chunks: numChunks,
        }
      }
    };
  };

  // Transcribe a single chunk
  const transcribeSingleChunk = async (filePath, duration, isChunked = false) => {
    const fullUrl = `${API_BASE}/transcribe`;
    
    return axios({
      method: "post",
      url: fullUrl,
      data: {
        file_path: filePath,
        journal_date: journalDate,
        duration_ms: duration,
        chunked: isChunked,
      },
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
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
      } else if (savedAudioPath) {
        // Fetch audio from Supabase storage (savedAudioPath is the storage path)
        const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(savedAudioPath);
        const response = await fetch(publicUrl);
        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/mp4'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|webm|m4a|mp4)$/i)) {
      alert('Please upload a valid audio file (MP3, WAV, WebM, M4A, or MP4)');
      return;
    }

    // Check file size (60MB limit)
    const maxSize = 60 * 1024 * 1024; // 60MB
    if (file.size > maxSize) {
      alert(`File is too large. Maximum size is 60MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    // Create blob URL for playback
    const blobURL = URL.createObjectURL(file);
    setBlobURL(blobURL);
    setAudioFile(file);

    // Try to get duration from the audio file
    try {
      const audio = new Audio(blobURL);
      audio.addEventListener('loadedmetadata', () => {
        const fileDuration = Math.round(audio.duration * 1000);
        setDuration(fileDuration);
        localStorage.setItem('audio_duration', fileDuration.toString());
      });
    } catch (err) {
      console.warn('Could not get audio duration:', err);
    }

    // Persist audio state to localStorage
    try {
      localStorage.setItem('audio_blob_url', blobURL);
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

    // Upload directly to Supabase first (bypasses Vercel's 4.5MB limit)
    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      // Generate filename
      const dateParts = (journalDate || new Date().toISOString().split('T')[0]).split('-');
      const formattedDate = `${dateParts[1]}-${dateParts[2]}-${dateParts[0]}`;
      const durationSeconds = duration > 0 ? Math.round(duration / 1000) : 0;
      const uniqueSuffix = Date.now().toString().slice(-6);
      const filename = `${formattedDate}--01--${durationSeconds}--${uniqueSuffix}.${file.name.split('.').pop() || 'mp3'}`;
      
      const bucket = 'audio';
      
      console.log('Uploading to Supabase:', { bucket, filename, fileSize: file.size });
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filename, file, {
          contentType: file.type || 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Supabase upload failed: ${uploadError.message}`);
      }

      const filePath = uploadData.path;
      console.log('File uploaded to Supabase:', filePath);

      // Now send just the file path to backend for transcription
      // Transcribe (will handle chunking if needed)
      const response = await transcribeInChunks(file, filePath, duration > 0 ? duration : 0);

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
          console.log("Transcript saved to database");
        } catch (transcriptError) {
          console.error("Error saving transcript to database:", transcriptError);
        }
      }

      // Notify parent component
      if (onRecordingComplete) {
        onRecordingComplete({
          transcript,
          duration_ms: duration || 0,
          local_path,
          audioFile: file,
        });
      }

      setIsTranscribing(false);
      setChunkingProgress(null);
    } catch (error) {
      console.error("Transcription error:", error);
      setIsTranscribing(false);
      setChunkingProgress(null);
      let errorMessage = error.response?.data?.message || error.message || "Transcription failed. Please try again.";
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
        errorMessage = "Storage upload failed. The app needs a one-time Supabase configuration. See SUPABASE_UPLOAD_FIX.md for the fix.";
      }
      setTranscriptionError({
        message: errorMessage,
        audio_saved: error.response?.data?.audio_saved || false,
      });
    }

    // Reset file input
    event.target.value = '';
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
      
      {/* Upload Audio Button */}
      <div className="flex items-center justify-center">
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors font-sans text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Upload Audio
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.webm,.m4a,.mp4"
            onChange={handleFileUpload}
            disabled={isRecording || isTranscribing}
            className="hidden"
          />
        </label>
      </div>
        
      {/* Long Recording Warning */}
      {showLongRecordingWarning && isRecording && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-center animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-sm text-yellow-300 font-sans font-semibold mb-1">⚠️ Long Recording Warning</p>
          <p className="text-xs text-yellow-200 font-sans">
            Recordings over 20 minutes may take longer to process. Consider stopping and saving periodically.
          </p>
        </div>
      )}
      
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
            <div className="flex flex-col items-center gap-2 bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-blue-400 font-medium font-sans">
                  {chunkingProgress ? `Transcribing chunk ${chunkingProgress.current} of ${chunkingProgress.total}...` : 'Transcribing...'}
                </span>
              </div>
              {chunkingProgress && (
                <div className="w-full bg-blue-500/20 rounded-full h-1.5">
                  <div 
                    className="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(chunkingProgress.current / chunkingProgress.total) * 100}%` }}
                  ></div>
                </div>
              )}
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