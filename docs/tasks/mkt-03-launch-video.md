# Task: mkt-03 launch video

Status: approved Oct 28, 2026 (owner: "use this too for bragging video", "add this video in main readme too", then "defaults" and "approved").

A 20 s launch video made with the brag-slim skill, plus a link to it at the top of the README. Spec sections: "Overview" (the pitch), "Security" (the attacks we stop).

## Decisions

| Area | Decision |
| --- | --- |
| Format | Landscape 1920×1080, 30 fps, 20 s, H.264 + AAC |
| Tone | `polished` with one playful beat (the Grifter caught) |
| Story | Hook: the seeded Bean Mail brief with its injected line. Reveal: logo and "Wallets AI agents can't misuse." Then the real scroll story on `/`: gates pass and flag, the owner denies, Scout is paid through PayPal. Punchline: "40 injection attacks. 0 wrong payouts." End card with a placeholder URL `agents-gotta-eat.vercel.app` |
| Source | Scenes 3 to 5 are the live marketing page in Chromium with transitions off and the story's scroll set per frame; scenes 1, 2 and 6 are one HTML page in the app's colours. Every frame is a pure function of time |
| Audio | Synthesised in numpy at 120 BPM in A minor; every cut and effect on the beat grid |
| Claims | Only the repo's own: the seed brief, the story copy, the red-team number |
| Files | `docs/media/brag.mp4` and `docs/media/brag.jpg` committed; working files in `brag-output/` (not committed); the brag-slim skill stays local |
| README | The poster links to the video at the top. GitHub plays videos inline only when uploaded through its editor; that swap is the owner's |

## Checks

| Area | Check |
| --- | --- |
| Stills | A frame from every scene and every transition: no overflow, collisions or low contrast |
| Timing | Each readable line settled at least 0.3 s per word |
| Audio | 20.000 s, no clipping, cues on the grid |
| Size | `brag.mp4` under about 8 MB |
| Repo | Format check passes; README renders the poster link |

## Changes made during the build

| Area | Change | Why |
| --- | --- | --- |
| Story | No caption overlays on scenes 3 to 5; the story's own titles ("Hard rules: pass", "Intent check: flagged", "Owner: denied") carry them | Overlays on top of the real captions made the frame busy |
| Capture | The live page is drawn at 1024×576 with a 1.875 device scale, so the story fills the 1920×1080 frame | At 1280×720 the story's text was too small to read in the video |
| Site | The "stopped · $0 moved" stamp hangs off the approval card's bottom edge (`spend-story.tsx`) | It covered "flagged by the intent check"; the payout stamp already does this |
| Poster | Frame 0 and `brag.jpg` are the "Owner: denied" frame | It shows the whole product in one frame: three gates, the approval and the stamp |
| Size | `brag.mp4` is 2.1 MB | CRF 20 was enough for a mostly flat, dark picture |
