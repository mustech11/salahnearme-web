"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string | null;
  label: string;
};

export default function HajjAudioPlayer({ src, label }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setError(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [src]);

  if (!src) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50">
        Audio will be added for this step soon.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-black/40 p-4">
      <div className="text-sm font-semibold text-yellow-400">{label}</div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          Audio file not found yet. Add this file:{" "}
          <span className="font-mono">{src}</span>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              if (!audioRef.current) return;

              try {
                if (playing) {
                  audioRef.current.pause();
                  setPlaying(false);
                } else {
                  await audioRef.current.play();
                  setPlaying(true);
                }
              } catch {
                setError(true);
                setPlaying(false);
              }
            }}
            className="rounded-xl bg-yellow-500 px-4 py-2 font-semibold text-black hover:bg-yellow-400"
          >
            {playing ? "Pause" : "Play"}
          </button>

          <span className="text-sm text-white/60">
            {playing ? "Playing..." : "Ready"}
          </span>
        </div>
      )}

      <audio
        data-hajj-audio="true"
        ref={audioRef}
        src={src}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
      />
    </div>
  );
}

