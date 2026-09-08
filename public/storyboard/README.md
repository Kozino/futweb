# Fix It Splash Song — Chapter 1 — Storyboard Video

**Duration:** 2:48 (168 seconds)  
**Scenes:** 19  
**Style:** Pixar 3D Kids Cartoon, bright playful outdoor car-wash  
**Resolution:** 1920x1080 16:9 ready, 30fps

## Scenes

| Time | # | Title | Camera | Image |
|------|---|-------|--------|-------|
| 0:01-0:08 | 1 | Messy Beginning | Wide establishing shot | 01-messy-beginning.png |
| 0:08-0:11 | 2 | Muddy Car | Medium shot | 02-muddy-car.png |
| 0:11-0:20 | 3 | Grab the Buckets | Tracking shot following kids | 03-grab-buckets.png |
| 0:20-0:27 | 4 | Tank Leak | Wide → close-up of leak | 04-tank-leak.png |
| 0:27-0:41 | 5 | Daddy Fixes It | Close-up → fast pullback | 05-daddy-fixes.png |
| 0:41-0:49 | 6 | Splash! | Wide playful shot | 06-splash.png |
| 0:49-1:10 | 7 | Water Is the Best | Alternating wide/close shots | 07-water-best.png |
| 1:10-1:15 | 8 | Big Laugh | Close-up reactions | 08-big-laugh.png |
| 1:15-1:22 | 9 | Knock at the Door | Wide exterior shot | 09-knock-door.png |
| 1:22-1:28 | 10 | New Box | Medium tracking shot | 10-new-box.png |
| 1:28-1:38 | 11 | New Hose | Close-ups of hands + hose | 11-new-hose.png |
| 1:38-1:40 | 12 | Water! | Close-up | 12-water.png |
| 1:40-1:49 | 13 | Boom & Crash | Dynamic wide shot | 13-boom-crash.png |
| 1:49-1:59 | 14 | Drip Drip Drop | Low-angle shot | 14-drip-drop.png |
| 1:59-2:11 | 15 | Fill the Tank | Vertical/tilting shot | 15-fill-tank.png |
| 2:11-2:15 | 16 | Almost Full | Close-up | 16-almost-full.png |
| 2:15-2:22 | 17 | Clean Cars | Hero wide shot | 17-clean-cars.png |
| 2:22-2:30 | 18 | Final Splash | Fast dynamic shots | 18-final-splash.png |
| 2:30-2:48 | 19 | Happy Ending | Wide closing shot | 19-happy-ending.png |

## Audio Stems

8 voiceover tracks in `/audio/`:
- 01-intro.mp3 (0:01-0:11)
- 02-buckets-leak.mp3 (0:11-0:27)
- 03-fix-splash.mp3 (0:27-0:49)
- 04-wash.mp3 (0:49-1:15)
- 05-delivery.mp3 (1:15-1:38)
- 06-water-boom.mp3 (1:38-1:59)
- 07-fill-clean.mp3 (1:59-2:22)
- 08-finale.mp3 (2:22-2:48)

## How to watch

Run dev server and open `/fix-it-splash` or `/storyboard`:

```
npm run dev
# open http://localhost:5173/fix-it-splash
```

Features:
- Play/pause (Space), scrub, -5s/+5s, click timeline
- Auto-sync audio stems
- Splash particle effects on scenes 5,6,13,18
- Record to WebM via Record MP4 button (uses canvas.captureStream + MediaRecorder)
- Download video

## Export to MP4

Option 1: Use Record button in player → downloads .webm → convert to mp4 with:
```
ffmpeg -i fix-it-splash-song.webm -c:v libx264 -crf 23 -preset medium -c:a aac fix-it-splash-song.mp4
```

Option 2: Screen record with OBS at 1920x1080 while playing

Option 3: Import image sequence + audio into Premiere/DaVinci Resolve:
- Each image duration = scene length (see table)
- Add 0.2s cross-dissolve
- Layer audio stems
- Add kids music bed

## Tech

- React + Tailwind, all assets in `/public/storyboard/`
- No external deps, fully offline
- Build passes: `npm run build` ✓
