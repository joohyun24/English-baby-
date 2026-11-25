import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Music,
  Download,
  Loader2,
} from 'lucide-react';
import type { BeatAudioData, BeatId, SceneConfig, StoryboardBeat } from '../types';
import { computeBeatSubtitleCues } from '../utils/subtitleTiming';
import { renderBeatFrame, renderEndCreditFrame } from '../utils/canvasRenderer';

interface FilmPlayerProps {
  beats: StoryboardBeat[];
  scene: SceneConfig;
  audioMap: Partial<Record<BeatId, BeatAudioData>>;
  activeBeatFilter?: BeatId | 'all';
  includeEndCredit?: boolean;
  showDownloadButton?: boolean;
  onBeatChange?: (beatId: BeatId) => void;
}

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const END_CREDIT_DURATION = 3;

function base64DataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Gentle, copyright-free Web Audio background music & subtle scene SFX scheduler
function scheduleAmbientSoundtrack(
  ctx: AudioContext,
  destination: AudioNode,
  startAtCtxTime: number,
  offsetSec: number,
  totalDurationSec: number,
  beatTimings: Array<{ beatId: BeatId; start: number; duration: number }>
): Array<AudioNode> {
  const createdNodes: Array<AudioNode> = [];
  const masterMusicGain = ctx.createGain();
  masterMusicGain.gain.value = 0.085;
  masterMusicGain.connect(destination);
  createdNodes.push(masterMusicGain);

  // Calm Cmaj7 -> Am7 -> Fmaj7 -> G6 warm electric-piano arpeggio every 2s
  const chords = [
    [261.63, 329.63, 392.0, 493.88], // Cmaj7
    [220.0, 261.63, 329.63, 392.0], // Am7
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [196.0, 246.94, 293.66, 329.63], // G6
  ];

  const chordStep = 2.0;
  const firstStep = Math.floor(offsetSec / chordStep);
  const maxSteps = Math.ceil(totalDurationSec / chordStep);

  for (let s = firstStep; s < maxSteps; s++) {
    const chordTime = s * chordStep;
    const when = startAtCtxTime + (chordTime - offsetSec);
    if (when < startAtCtxTime - 0.1) continue;

    const notes = chords[s % chords.length];
    notes.forEach((freq, nIdx) => {
      const noteStart = Math.max(startAtCtxTime, when + nIdx * 0.14);
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteStart);

      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.linearRampToValueAtTime(0.28, noteStart + 0.05);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + 1.75);

      osc.connect(noteGain);
      noteGain.connect(masterMusicGain);
      osc.start(noteStart);
      osc.stop(noteStart + 1.8);
      createdNodes.push(osc);
    });
  }

  // Subtle scene SFX cues (coffee splash in Problem beat, gentle doorway bell in Close beat)
  for (const b of beatTimings) {
    if (b.beatId === 'problem') {
      const splashTime = b.start + b.duration * 0.54;
      if (splashTime >= offsetSec) {
        const when = startAtCtxTime + (splashTime - offsetSec);
        // Gentle splash whoosh using filtered noise
        const bufferSize = Math.floor(ctx.sampleRate * 0.35);
        const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, when);
        const sfxGain = ctx.createGain();
        sfxGain.gain.setValueAtTime(0.09, when);
        sfxGain.gain.exponentialRampToValueAtTime(0.001, when + 0.34);

        noiseSrc.connect(filter);
        filter.connect(sfxGain);
        sfxGain.connect(destination);
        noiseSrc.start(when);
        createdNodes.push(noiseSrc);
      }
    }
    if (b.beatId === 'turn' || b.beatId === 'close') {
      const chimeTime = b.start + 0.15;
      if (chimeTime >= offsetSec) {
        const when = startAtCtxTime + (chimeTime - offsetSec);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(b.beatId === 'turn' ? 587.33 : 659.25, when);
        g.gain.setValueAtTime(0.001, when);
        g.gain.linearRampToValueAtTime(0.045, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0005, when + 0.65);
        osc.connect(g);
        g.connect(destination);
        osc.start(when);
        osc.stop(when + 0.7);
        createdNodes.push(osc);
      }
    }
  }

  return createdNodes;
}

export const FilmPlayer: React.FC<FilmPlayerProps> = ({
  beats,
  scene,
  audioMap,
  activeBeatFilter = 'all',
  includeEndCredit = false,
  showDownloadButton = false,
  onBeatChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [decodedVersion, setDecodedVersion] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const decodedBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeMusicNodesRef = useRef<Array<AudioNode>>([]);
  const rafRef = useRef<number | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const playOffsetRef = useRef<number>(0);
  const currentPlayedBeatRef = useRef<string | null>(null);

  const ensureAudioContext = useCallback(() => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  }, []);

  const visibleBeats = useMemo(() => {
    if (activeBeatFilter === 'all') return beats;
    const found = beats.filter((b) => b.id === activeBeatFilter);
    return found.length > 0 ? found : beats;
  }, [beats, activeBeatFilter]);

  const timeline = useMemo(() => {
    let cursor = 0;
    const items = visibleBeats.map((beat) => {
      const slotDuration = Math.max(4, beat.endSec - beat.startSec);
      const audio = audioMap[beat.id];
      const speechDur = audio?.durationSec
        ? Math.min(slotDuration - 0.15, audio.durationSec)
        : slotDuration * 0.85;
      const cues = computeBeatSubtitleCues(beat, speechDur);
      const item = {
        beat,
        start: cursor,
        end: cursor + slotDuration,
        duration: slotDuration,
        audioDuration: audio?.durationSec || speechDur,
        cues,
      };
      cursor += slotDuration;
      return item;
    });
    const filmDuration = cursor;
    const totalDuration = includeEndCredit ? filmDuration + END_CREDIT_DURATION : filmDuration;
    return { items, filmDuration, totalDuration };
  }, [visibleBeats, audioMap, includeEndCredit]);

  // Decode WAV data URLs directly from base64 (avoids CSP fetch issues)
  useEffect(() => {
    let cancelled = false;
    const decodeAll = async () => {
      const ctx = ensureAudioContext();
      if (!ctx) return;

      let addedAny = false;
      for (const beat of beats) {
        const audio = audioMap[beat.id];
        if (!audio?.audioDataUrl) continue;
        const cacheKey = `${beat.id}:${audio.voiceSignature}`;
        if (decodedBuffersRef.current[cacheKey]) continue;

        try {
          const arrayBuf = base64DataUrlToArrayBuffer(audio.audioDataUrl);
          const decoded = await ctx.decodeAudioData(arrayBuf);
          if (!cancelled) {
            decodedBuffersRef.current[cacheKey] = decoded;
            addedAny = true;
          }
        } catch (e) {
          console.error('Audio decode error for beat', beat.id, e);
        }
      }
      if (addedAny && !cancelled) {
        setDecodedVersion((v) => v + 1);
      }
    };
    decodeAll();
    return () => {
      cancelled = true;
    };
  }, [beats, audioMap, ensureAudioContext]);

  const stopActiveMusic = useCallback(() => {
    for (const node of activeMusicNodesRef.current) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // already stopped
      }
    }
    activeMusicNodesRef.current = [];
  }, []);

  const stopActiveAudio = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {
        // already stopped
      }
      activeSourceRef.current = null;
    }
    currentPlayedBeatRef.current = null;
  }, []);

  const stopAllSound = useCallback(() => {
    stopActiveAudio();
    stopActiveMusic();
  }, [stopActiveAudio, stopActiveMusic]);

  const drawAtTime = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (includeEndCredit && t >= timeline.filmDuration) {
        const creditProgress =
          (t - timeline.filmDuration) / Math.max(0.5, END_CREDIT_DURATION);
        renderEndCreditFrame(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, scene, creditProgress);
        return;
      }

      const activeItem =
        timeline.items.find((it) => t >= it.start && t < it.end) ||
        timeline.items[timeline.items.length - 1];

      if (!activeItem) return;

      const localT = Math.max(0, t - activeItem.start);
      const progress = Math.min(1, localT / activeItem.duration);
      const activeCue = activeItem.cues.find(
        (c) => localT >= c.startSec && localT <= c.endSec
      );
      const subtitleText = activeCue ? activeCue.text : '';
      const isSpeaking = Boolean(activeCue) && isPlaying;

      renderBeatFrame(
        ctx,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        activeItem.beat,
        scene,
        progress,
        subtitleText,
        isSpeaking
      );
    },
    [timeline, scene, includeEndCredit, isPlaying]
  );

  useEffect(() => {
    drawAtTime(currentTime);
  }, [currentTime, drawAtTime]);

  useEffect(() => {
    stopAllSound();
    setIsPlaying(false);
    setCurrentTime(0);
    playOffsetRef.current = 0;
  }, [activeBeatFilter, stopAllSound]);

  const startBeatAudioAt = useCallback(
    (itemIndex: number, offsetInsideBeat: number) => {
      stopActiveAudio();
      if (isMuted) return;
      const item = timeline.items[itemIndex];
      if (!item) return;

      const audio = audioMap[item.beat.id];
      if (!audio) return;
      const cacheKey = `${item.beat.id}:${audio.voiceSignature}`;
      const buffer = decodedBuffersRef.current[cacheKey];
      const ctx = audioCtxRef.current;
      if (!buffer || !ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playbackRate =
        buffer.duration > item.duration - 0.1
          ? Math.min(1.22, buffer.duration / (item.duration - 0.15))
          : 1;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      source.connect(ctx.destination);

      const audioOffset = offsetInsideBeat * playbackRate;
      if (audioOffset < buffer.duration) {
        source.start(0, Math.max(0, audioOffset));
        activeSourceRef.current = source;
      }
      currentPlayedBeatRef.current = item.beat.id;
    },
    [timeline.items, audioMap, isMuted, stopActiveAudio]
  );

  // If newly decoded voice arrives while playing, trigger the current beat's voice right away
  useEffect(() => {
    if (isPlaying && !isMuted) {
      currentPlayedBeatRef.current = null;
    }
  }, [decodedVersion, isPlaying, isMuted]);

  // Manage background soundtrack while playing
  useEffect(() => {
    stopActiveMusic();
    if (!isPlaying || isMuted || !musicEnabled) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const beatTimings = timeline.items.map((it) => ({
      beatId: it.beat.id,
      start: it.start,
      duration: it.duration,
    }));
    activeMusicNodesRef.current = scheduleAmbientSoundtrack(
      ctx,
      ctx.destination,
      ctx.currentTime,
      playOffsetRef.current,
      timeline.totalDuration,
      beatTimings
    );

    return () => {
      stopActiveMusic();
    };
  }, [isPlaying, isMuted, musicEnabled, timeline, ensureAudioContext, stopActiveMusic]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    playStartTimeRef.current = performance.now() - playOffsetRef.current * 1000;

    const tick = (now: number) => {
      const elapsed = (now - playStartTimeRef.current) / 1000;
      if (elapsed >= timeline.totalDuration) {
        setCurrentTime(timeline.totalDuration);
        setIsPlaying(false);
        playOffsetRef.current = 0;
        stopAllSound();
        drawAtTime(timeline.totalDuration);
        return;
      }

      setCurrentTime(elapsed);
      drawAtTime(elapsed);

      const itemIdx = timeline.items.findIndex(
        (it) => elapsed >= it.start && elapsed < it.end
      );
      if (itemIdx !== -1) {
        const item = timeline.items[itemIdx];
        if (currentPlayedBeatRef.current !== item.beat.id) {
          startBeatAudioAt(itemIdx, elapsed - item.start);
          onBeatChange?.(item.beat.id);
        }
      } else if (elapsed >= timeline.filmDuration) {
        stopActiveAudio();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    isPlaying,
    timeline,
    drawAtTime,
    startBeatAudioAt,
    stopActiveAudio,
    stopAllSound,
    onBeatChange,
  ]);

  useEffect(() => {
    return () => {
      stopAllSound();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stopAllSound]);

  const togglePlay = async () => {
    const ctx = ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (isPlaying) {
      playOffsetRef.current = currentTime;
      setIsPlaying(false);
      stopAllSound();
    } else {
      const startAt = currentTime >= timeline.totalDuration - 0.05 ? 0 : currentTime;
      playOffsetRef.current = startAt;
      currentPlayedBeatRef.current = null;
      setCurrentTime(startAt);
      setIsPlaying(true);
    }
  };

  const handleRestart = async () => {
    const ctx = ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
    stopAllSound();
    playOffsetRef.current = 0;
    currentPlayedBeatRef.current = null;
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    stopAllSound();
    playOffsetRef.current = val;
    currentPlayedBeatRef.current = null;
    setCurrentTime(val);
    if (isPlaying) {
      playStartTimeRef.current = performance.now() - val * 1000;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      stopAllSound();
    } else if (isPlaying) {
      playOffsetRef.current = currentTime;
      currentPlayedBeatRef.current = null;
    }
  };

  const handleDownloadVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isExporting) return;

    setExportError(null);
    setIsPlaying(false);
    stopAllSound();
    setIsExporting(true);
    setExportProgress(0);

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const exportCtx = new AudioCtx();
      const dest = exportCtx.createMediaStreamDestination();

      // Schedule TTS voices
      for (const item of timeline.items) {
        const audio = audioMap[item.beat.id];
        if (!audio?.audioDataUrl) continue;
        try {
          const arrayBuf = base64DataUrlToArrayBuffer(audio.audioDataUrl);
          const buf = await exportCtx.decodeAudioData(arrayBuf);
          const src = exportCtx.createBufferSource();
          src.buffer = buf;
          const playbackRate =
            buf.duration > item.duration - 0.1
              ? Math.min(1.22, buf.duration / (item.duration - 0.15))
              : 1;
          src.playbackRate.value = playbackRate;
          src.connect(dest);
          src.start(exportCtx.currentTime + item.start);
        } catch {
          // continue cleanly
        }
      }

      // Schedule ambient music + SFX into downloaded video if enabled
      if (musicEnabled) {
        scheduleAmbientSoundtrack(
          exportCtx,
          dest,
          exportCtx.currentTime,
          0,
          timeline.totalDuration,
          timeline.items.map((it) => ({
            beatId: it.beat.id,
            start: it.start,
            duration: it.duration,
          }))
        );
      }

      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';

      if (!mimeType) {
        throw new Error('Your browser does not support WebM video export.');
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 3_000_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      recorder.start(250);
      const exportStart = performance.now();
      const ctx = canvas.getContext('2d');

      await new Promise<void>((resolve) => {
        const renderStep = () => {
          const elapsed = (performance.now() - exportStart) / 1000;
          if (elapsed >= timeline.totalDuration) {
            setExportProgress(100);
            resolve();
            return;
          }
          setExportProgress(Math.min(99, Math.round((elapsed / timeline.totalDuration) * 100)));

          if (ctx) {
            if (includeEndCredit && elapsed >= timeline.filmDuration) {
              const fade = (elapsed - timeline.filmDuration) / END_CREDIT_DURATION;
              renderEndCreditFrame(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, scene, fade);
            } else {
              const activeItem =
                timeline.items.find((it) => elapsed >= it.start && elapsed < it.end) ||
                timeline.items[timeline.items.length - 1];
              if (activeItem) {
                const localT = Math.max(0, elapsed - activeItem.start);
                const progress = Math.min(1, localT / activeItem.duration);
                const activeCue = activeItem.cues.find(
                  (c) => localT >= c.startSec && localT <= c.endSec
                );
                renderBeatFrame(
                  ctx,
                  CANVAS_WIDTH,
                  CANVAS_HEIGHT,
                  activeItem.beat,
                  scene,
                  progress,
                  activeCue ? activeCue.text : '',
                  Boolean(activeCue)
                );
              }
            }
          }
          requestAnimationFrame(renderStep);
        };
        requestAnimationFrame(renderStep);
      });

      recorder.stop();
      const blob = await recordingDone;
      await exportCtx.close();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shall-we-play-30s-film.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Could not export video in this browser.'
      );
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      drawAtTime(0);
      setCurrentTime(0);
    }
  };

  const formatTime = (sec: number) => {
    const s = Math.floor(sec);
    return `00:${s < 10 ? `0${s}` : s}`;
  };

  return (
    <div className="w-full space-y-4">
      <div className="relative w-full overflow-hidden rounded-2xl bg-[#181C20] shadow-sm border border-[#DCE1E7]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full aspect-video block"
        />

        {!isPlaying && !isExporting && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play video with sound"
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
          >
            <span className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-[#181C20] shadow-lg transition-transform hover:scale-105">
              <Play className="w-7 h-7 sm:w-8 sm:h-8 ml-1 fill-current" />
            </span>
          </button>
        )}

        {isExporting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white px-6 text-center">
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p className="text-lg font-semibold">Recording your 30s film with voice, music & subtitles…</p>
            <p className="font-mono-num text-sm text-white/80 mt-1">{exportProgress}% complete</p>
          </div>
        )}
      </div>

      {/* Player Control Strip */}
      <div className="bg-white rounded-2xl border border-[#E2E6EC] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono-num text-sm font-medium text-[#4A5568] w-12">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={timeline.totalDuration}
            step={0.05}
            value={currentTime}
            onChange={handleScrub}
            disabled={isExporting}
            aria-label="Video timeline scrubber"
            className="flex-1 h-2 bg-[#E2E6EC] rounded-lg accent-[#2563EB] cursor-pointer"
          />
          <span className="font-mono-num text-sm font-medium text-[#4A5568] w-12 text-right">
            {formatTime(timeline.totalDuration)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={isExporting}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-base flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>{activeBeatFilter === 'all' ? 'Play Film' : 'Play Beat'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              disabled={isExporting}
              aria-label="Restart from beginning"
              className="min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-xl bg-[#F0F3F6] hover:bg-[#E2E7ED] text-[#1E242B] font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="hidden sm:inline">Restart</span>
            </button>

            <button
              type="button"
              onClick={toggleMute}
              disabled={isExporting}
              aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
              className={`min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 font-medium text-sm transition-colors cursor-pointer disabled:opacity-50 ${
                isMuted
                  ? 'bg-[#FEE2E2] text-[#991B1B]'
                  : 'bg-[#F0F3F6] hover:bg-[#E2E7ED] text-[#1E242B]'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Sound On'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMusicEnabled((v) => !v)}
              disabled={isExporting}
              aria-label={musicEnabled ? 'Disable background music' : 'Enable background music'}
              className={`min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 font-medium text-sm transition-colors cursor-pointer disabled:opacity-50 ${
                musicEnabled
                  ? 'bg-[#D1FAE5] text-[#065F46]'
                  : 'bg-[#F0F3F6] text-[#5A6675]'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>{musicEnabled ? 'Music + SFX On' : 'Voice Only'}</span>
            </button>
          </div>

          {showDownloadButton && (
            <button
              type="button"
              onClick={handleDownloadVideo}
              disabled={isExporting}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Exporting {exportProgress}%</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Download Video (.webm)</span>
                </>
              )}
            </button>
          )}
        </div>

        {exportError && (
          <p className="text-sm text-[#B42318] font-medium pt-1">{exportError}</p>
        )}
      </div>
    </div>
  );
};
