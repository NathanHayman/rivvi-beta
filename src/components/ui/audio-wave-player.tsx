import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
// import {
//   IconDownload,
//   IconPlayerPause,
//   IconPlayerPlay,
//   IconVolume,
//   IconVolume3,
// } from "@tabler/icons-react";
import { useWavesurfer } from "@wavesurfer/react";
import {
  Download,
  MoreHorizontal,
  Pause,
  Play,
  Volume,
  Volume2,
} from "lucide-react";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";

export function AudioPlayerWithWaveform({
  audioUrl,
  onDownload,
}: {
  audioUrl: string;
  onDownload: () => void;
}) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const { wavesurfer, isReady } = useWavesurfer({
    container: waveformRef as RefObject<HTMLDivElement>,
    height: 80,
    waveColor: "rgb(200, 200, 200)",
    progressColor: "rgb(0, 122, 255)",
    cursorColor: "rgb(100, 100, 100)",
    barWidth: 2,
    barRadius: 3,
    cursorWidth: 1,
    url: audioUrl,
  });

  useEffect(() => {
    if (!wavesurfer) return;

    setVolume(wavesurfer.getVolume());
    setDuration(wavesurfer.getDuration());

    const subscriptions = [
      wavesurfer.on("play", () => setIsPlaying(true)),
      wavesurfer.on("pause", () => setIsPlaying(false)),
      wavesurfer.on("timeupdate", (currentTime) => setCurrentTime(currentTime)),
      wavesurfer.on("finish", () => setIsPlaying(false)),
    ];

    return () => {
      subscriptions.forEach((unsub) => unsub());
    };
  }, [wavesurfer]);

  const togglePlayPause = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.playPause();
    }
  }, [wavesurfer]);

  const handleVolumeChange = (newVolume: number[]) => {
    const volumeValue = newVolume[0];
    setVolume(volumeValue);
    if (wavesurfer) {
      wavesurfer.setVolume(volumeValue);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          onClick={togglePlayPause}
          variant="outline"
          size="icon"
          disabled={!isReady}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </Button>
        <div className="mx-2 flex-grow" ref={waveformRef} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              <span>Download recording</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center space-x-2">
        <div className="text-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div className="flex flex-grow items-center space-x-2">
          <Button
            onClick={() => handleVolumeChange([volume === 0 ? 1 : 0])}
            variant="ghost"
            size="icon"
          >
            {volume === 0 ? <Volume size={20} /> : <Volume2 size={20} />}
          </Button>
          <Slider
            max={1}
            step={0.01}
            value={[volume]}
            onValueChange={handleVolumeChange}
            aria-label="Adjust volume"
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
}
