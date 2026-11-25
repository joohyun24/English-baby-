import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, Loader2 } from 'lucide-react';
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
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const decodedBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const playOffsetRef = useRef<number>(0);
  const currentPlayedBeatRef = useRef<string | null>(null);

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

  // Decode WAV data URLs into AudioBuffers whenever audioMap changes
  useEffect(() => {
    let cancelled = false;
    const decodeAll = async () => {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;

      for (const beat of beats) {
        const audio = audioMap[beat.id];
        if (!audio?.audioDataUrl) continue;
        const cacheKey = `${beat.id}:${audio.voiceSignature}`;
        if (decodedBuffersRef.current[cacheKey]) continue;

        try {
          const resp = await fetch(audio.audioDataUrl);
          const arrayBuf = await resp.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arrayBuf);
          if (!cancelled) {
            decodedBuffersRef.current[cacheKey] = decoded;
          }
        } catch {
          // Ignore individual decode issues cleanly
        }
      }
    };
    decodeAll();
    return () => {
      cancelled = true;
    };
  }, [beats, audioMap]);

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

  // Draw frame at a given time (seconds)
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

  // Redraw whenever paused and timeline/scene/filter changes
  useEffect(() => {
    drawAtTime(currentTime);
  }, [currentTime, drawAtTime]);

  // Reset position when beat filter changes
  useEffect(() => {
    stopActiveAudio();
    setIsPlaying(false);
    setCurrentTime(0);
    playOffsetRef.current = 0;
  }, [activeBeatFilter, stopActiveAudio]);

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

      // Gently fit audio inside beat slot if slightly longer
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
        stopActiveAudio();
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
    onBeatChange,
  ]);

  useEffect(() => {
    return () => {
      stopActiveAudio();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stopActiveAudio]);

  const togglePlay = async () => {
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    if (isPlaying) {
      playOffsetRef.current = currentTime;
      setIsPlaying(false);
      stopActiveAudio();
    } else {
      const startAt = currentTime >= timeline.totalDuration - 0.05 ? 0 : currentTime;
      playOffsetRef.current = startAt;
      currentPlayedBeatRef.current = null;
      setCurrentTime(startAt);
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    stopActiveAudio();
    playOffsetRef.current = 0;
    currentPlayedBeatRef.current = null;
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    stopActiveAudio();
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
      stopActiveAudio();
    } else if (isPlaying) {
      currentPlayedBeatRef.current = null;
    }
  };

  const handleDownloadVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isExporting) return;

    setExportError(null);
    setIsPlaying(false);
    stopActiveAudio();
    setIsExporting(true);
    setExportProgress(0);

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const exportCtx = new AudioCtx();
      const dest = exportCtx.createMediaStreamDestination();

      // Schedule all beat audio buffers cleanly on the export MediaStreamDestination
      for (const item of timeline.items) {
        const audio = audioMap[item.beat.id];
        if (!audio?.audioDataUrl) continue;
        try {
          const resp = await fetch(audio.audioDataUrl);
          const buf = await exportCtx.decodeAudioData(await resp.arrayBuffer());
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
          // continue even if one audio segment fails
        }
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
            aria-label="Play video"
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
            <p className="text-lg font-semibold">Recording your 30s film with voice & subtitles…</p>
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
            className="flex-1 h-2 bg-[#E2E6EC] rounded-lg accent-[#2F4858] cursor-pointer"
          />
          <span className="font-mono-num text-sm font-medium text-[#4A5568] w-12 text-right">
            {formatTime(timeline.totalDuration)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={isExporting}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#2F4858] hover:bg-[#243946] text-white font-semibold text-base flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
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
              aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
              className="min-h-[48px] min-w-[48px] px-3.5 py-2.5 rounded-xl bg-[#F0F3F6] hover:bg-[#E2E7ED] text-[#1E242B] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          {showDownloadButton && (
            <button
              type="button"
              onClick={handleDownloadVideo}
              disabled={isExporting}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#4A7C6F] hover:bg-[#3C675C] text-white font-semibold text-base flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
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
