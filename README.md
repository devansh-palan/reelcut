# Reelcut

A mobile-first video editor that runs entirely in the browser. Flow: **Upload media → Editor → Edit → Preview / Export**.

```
npm install
npm run dev        # http://localhost:5173  (use --host to open it on your phone)
npm run build      # production bundle in dist/
```

## What it does

| Area | Details |
| --- | --- |
| Upload | Pick one or many videos/photos (or record with the camera). Drag-and-drop on desktop. Thumbnails and metadata are probed in the browser. |
| Timeline | Clips are stacked in order. Tap to select. Drag or swipe the strip to pan the whole timeline (the playhead keeps its time until you push it against the edge, then it scrubs). Drag the playhead to pick where playback starts. Drag the edges of the selected clip to trim it in place. Add more media from the `+` at the end. |
| Clip ops | Split at playhead, duplicate, move (left/right/first/last), delete. Every action sits in a single always-visible dock. Undo / redo for everything. |
| Trim | Two-handle trim over a filmstrip of the source; the preview scrubs to the edge you are dragging. Photos get a duration slider. |
| Speed | Per-clip playback rate from 0.25× to 4× with presets and a fine-tune slider. The timeline, split points and audio all follow the new rate. |
| Crop | Drag corners or move the box on the preview. Free or locked ratios (1:1, 4:5, 9:16, 16:9). |
| Text | Multiple overlays. Drag to position on the preview. Font, weight, colour, background pill, size, and a time range set from the playhead. |
| Look | 10 filter presets with live thumbnails, plus brightness / contrast / saturation sliders. One tap applies a look to every clip. |
| Playback | Play/pause, jump to previous/next clip, scrub, tap-to-toggle on the preview. Space bar and Ctrl+Z on desktop. |
| Output | Choose 9:16, 4:5, 1:1 or 16:9. Clips are letterboxed on a blurred copy of themselves. |
| Export | Records the composition in real time with `MediaRecorder` (MP4 where the browser supports it, otherwise WebM) and offers Download / native Share. |

## Stack

- **React 18 + TypeScript + Vite** – small, fast, no framework overhead for what is essentially one screen with panels.
- **Zustand** – two tiny stores. `project` holds the document (assets, clips, text overlays, selection, undo history). `playback` holds the 60 fps playhead so only the timecode, playhead and scrubber re-render during playback.
- **Canvas 2D compositing engine** (`src/engine/engine.ts`) – no ffmpeg, no WebCodecs. Every frame is drawn from the decoded `<video>` / `<img>` elements with crop, filter and text applied. The same renderer feeds the editor preview, the fullscreen preview and the export.
- **lucide-react** for icons. No UI library; the styling is hand-written CSS with custom properties.

## Architecture

```
src/
  types.ts               Document model: MediaAsset, Clip, TextOverlay, ...
  lib/
    media.ts             File → asset: metadata probe, thumbnail sampling
    timeline.ts          Pure helpers: clip lengths, offsets, clipAt(time), aspect sizes
    filters.ts           Filter presets → CSS filter strings
    useImport.ts         Shared import pipeline used by both screens
  store/
    project.ts           Document + undo/redo (snapshot stack)
    playback.ts          time / playing / exporting
  engine/
    engine.ts            Singleton renderer + transport + MediaRecorder export
  screens/
    UploadScreen.tsx     Staging area for new media
    EditorScreen.tsx     Stage + transport + timeline + tool panel + dock
    PreviewScreen.tsx    Fullscreen playback and export sheet
  components/
    Stage.tsx            Sizes the canvas to the container and exposes metrics to overlays
    Timeline.tsx         Filmstrip timeline: pan, draggable playhead, in-place edge trimming
    overlays/            CropBox and TextLayer live on top of the canvas
    panels/              Trim, Speed, Crop, Look, Text, Move tool panels
```

### Key decisions

**Non-destructive edit model.** A `Clip` is just `{ assetId, start, end, speed, crop, filter, adjust }`. Trimming never touches media; it only changes the in/out points. Splitting creates two clips that share an asset. This keeps every operation instant and makes undo a matter of swapping array snapshots.

**One renderer for preview and export.** The engine composites the current frame onto a single canvas. The editor, the preview screen and the exporter all attach to it, so what you see is exactly what you export. There is no second code path that could drift.

**Audio-locked clock.** The playback loop advances a `requestAnimationFrame` clock, but while a video clip is active it soft-locks the timeline to that element's `currentTime`. Audio therefore stays in sync and clip boundaries are hit exactly; images and gaps fall back to the wall clock.

**Real-time MediaRecorder export instead of ffmpeg.wasm.** ffmpeg.wasm is ~30 MB, needs cross-origin isolation headers, and is slow on phones. `canvas.captureStream()` + `MediaRecorder` ships in every modern mobile browser, produces MP4 on Safari/Chrome and WebM elsewhere, and the audio graph is mixed with the Web Audio API. The trade-off is that export takes as long as the video does, which is acceptable for short social clips.

**Overlays, not canvas hit-testing.** Crop handles and text selection are DOM elements placed over the canvas using metrics the `Stage` exposes. The engine reports the measured text boxes each frame so hit-testing matches what was actually drawn.

**Mobile first.** Everything is pointer-event based with `touch-action: none` on gesture surfaces, safe-area insets are respected, the layout is a single column that is also framed on desktop for easy demoing, and media elements are unlocked inside the first tap so iOS lets later clips auto-start.

## Known limitations / what I would build next

- **Export speed and quality.** Move to WebCodecs (`VideoEncoder` + mp4-muxer) for faster-than-real-time export with exact frame timing, keeping MediaRecorder as the fallback.
- **Drag-to-reorder clips** on the timeline (currently move left/right buttons) and pinch-to-zoom the timeline.
- **Transitions** between clips, plus a music track with volume ducking.
- **Persistence.** Store the project document in IndexedDB and re-link files via the File System Access API so a reload does not lose work.
- **Canvas filter fallback.** Older WebKit lacks `CanvasRenderingContext2D.filter`; the preview falls back to a CSS filter, but exports on those browsers would not include the look. A WebGL shader path would fix both.
- **Keyframed text animation**, safe-area guides for TikTok/Reels UI, and thumbnail generation in a worker for very long files.
