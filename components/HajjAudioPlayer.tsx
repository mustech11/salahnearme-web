"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  src: string | null;
  label: string;
};

function cleanSource(value: string | null): string | null {
  const raw = value?.trim();

  if (!raw) return null;
  if (raw.startsWith("/")) return raw;

  try {
    const url = new URL(raw);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function HajjAudioPlayer({ src, label }: Props) {
  const feedbackId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);

  const safeSrc = useMemo(() => cleanSource(src), [src]);
  const cleanLabel = label.trim() || "Hajj audio guidance";

  useEffect(() => {
    const audio = audioRef.current;

    setPlaying(false);
    setError("");
    setDuration(0);
    setCurrentTime(0);
    setLoading(false);

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.load();
    }
  }, [safeSrc]);

  if (!safeSrc) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50">
        Audio will be added for this step soon.
      </div>
    );
  }

  async function togglePlayback() {
    const audio = audioRef.current;

    if (!audio || loading) return;

    try {
      setError("");

      if (audio.paused) {
        setLoading(true);
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setError("The audio could not be played on this device.");
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-yellow-500/20 bg-black/40 p-4">
      <div className="text-sm font-black text-yellow-400">{cleanLabel}</div>

      <audio
        data-hajj-audio="true"
        ref={audioRef}
        src={safeSrc}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onError={() => {
          setError("Audio is unavailable at the moment.");
          setPlaying(false);
          setLoading(false);
        }}
      />

      {error ? (
        <div
          id={feedbackId}
          role="alert"
          className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void togglePlayback()}
              disabled={loading}
              aria-busy={loading}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-yellow-500 px-4 py-2 font-black text-black transition hover:bg-yellow-400 disabled:opacity-50"
            >
              {loading ? "Loading…" : playing ? "Pause" : "Play"}
            </button>

            <span className="text-sm text-white/60">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            disabled={!duration}
            aria-label={`Seek ${cleanLabel}`}
            onChange={(event) => {
              const next = Number(event.target.value);
              const audio = audioRef.current;

              if (audio && Number.isFinite(next)) {
                audio.currentTime = next;
                setCurrentTime(next);
              }
            }}
            className="mt-4 w-full accent-yellow-500"
          />
        </>
      )}
    </section>
  );
}