# Belt demonstration reference

The sequence uses the supplied [F-NJFRGi6ys video](https://www.youtube.com/watch?v=F-NJFRGi6ys) as its primary reference. A is the end threaded first, not an anatomical hand. Front view is not mirrored: A exits on viewer-right after the first underpass. The [IG5WBxopLJw video](https://www.youtube.com/watch?v=IG5WBxopLJw) supports wrap/layer inspection; [poG-fDcqUA0](https://www.youtube.com/watch?v=poG-fDcqUA0) is an alternate demonstration, not a source for splicing a different finish into this sequence.

| Primary time | Event used for animation |
| --- | --- |
| 2 s | Center at the front of the waist |
| 3.2 s | Wrap behind the waist |
| 5.4 s | Return and cross at the front |
| 12.5 s | First threaded end A raised to viewer-right |
| 13.5–15.5 s | A crosses left, enters downward between waist layers, leaving a front opening |
| 16.5–18 s | B enters the opposite layer passage, then emerges through A's opening toward viewer-right |
| 19.5–20 s | Both ends pulled outward to flatten the knot |

The tip arrives before trailing material is fed. B waits during A insertion; A waits during B insertion. Anime.js pauses at actual tip arrival and, for B, at emergence through the front opening. Timing does not change the geometry.

The hands obscure parts of the internal passage. Those depths, the bend plane, and the exact loop shape are **inferred**, not measured from the video. The renderer uses a fixed-length ribbon with guided folds, not a cloth/contact solver. Aperture clearance checks do not establish global collision freedom or the strength of a physical knot. The demonstration omits the holding hands and simplifies the free end held partway along its length.

## Review and checks

The pre-change geometry at `5eec600` was preserved as a comparator. Seven source/baseline/candidate events were captured at a common candidate scale; source images retain their aspect ratio. A local event-scrubbable report was built with the `animation-visual-qa` skill in `.test-output/belt-redo/review.html`. Reference images are local review evidence, not product assets.

`tests/belt-lesson.test.mjs` checks material length, strip width, tip-led insertion, held-end stability, B passage order, opening clearance, outward finish, continuous sampled motion and viewport bounds. `tests/belt-timeline.test.mjs` checks both insertion holds, seeking and cancellation. Browser scripts check playback speed, pauses, auto advance, camera overlay controls and mobile layout. These are distinct from reference comparison and do not validate live belt tracking accuracy.

Retained requirements: black belt, total material length 6.4, existing shortened mannequin, seven stages without a separate end-length adjustment stage, and virtual/real belt modes.

## Flat-fold revision

The earlier version retained a circular ring at the front and turned the strip toward the camera. The inspected 15.5 s and 19.5 s frames instead show broad diagonal faces with localized bends. This revision uses straight spans connected by two small folds, a belt width of 0.101 waist units, and transported strip orientation. The face is constrained to the opening plane only after the tip arrives; it is not forced toward the viewer.

Tightening reduces front-to-back space, preserving the opening's horizontal extent rather than shrinking the whole knot. Material released from the fold is added to the free tails. The opening normal and B's width orientation follow the changing depth. The final diagonal tail angle is approximately 15 degrees below horizontal, based on the visible pull direction.

The old opening test used an ideal width vector and subtracted half the A belt width in every direction. It now intersects the actual rendered B ribbon edges with the opening plane and checks the resulting width/thickness corners. Edge-continuity tests additionally sample both visible boundaries, with finer samples around the two approach folds; centerline-only continuity did not catch face flips. These remain local geometric checks, not a full cloth self-collision simulation.


## Continuous front-view tracking revision (2026-10-14)

The live belt lesson now renders image-conditioned belt/hand vector contours at every decoded original timestamp. The previous authored 3D belt generator is retained for legacy geometry regression coverage but is not used by the lesson renderer. The source video is not embedded in the demonstration.

Reviewed input SHA256:

- Belt v4: `0f3d3c3e5815d967bd386cea735e1009bfedf02d0d92efaee1141fac5523e0c3`
- SAM hand surfaces: `82ff12472ee6f714292abef10fcc89c93503b45fd48ae70f49a29de0439c0664`
- Reviewed vector renderer: `70f44cf424ab558831d2ee9d6b42d4c791d7287f042bfb7da0f5663ae7ba936d`
- Packed JSON: `12dd282461bd4397aad73cf6314304a97e015c7acaec6cd1f315f89fdf2513d9`

All 1,285 original PTS from 0 through 21.4 seconds remain in the deployed observation dataset. The seven lesson intervals are 2s hold, 2–4.1, 4.1–5.4, 5.4–12.5, 12.5–15.5, 15.5–18, 18–19.8. The in-sequence end presentation remains continuous inside stage 4, with no added length-matching lesson. Stage 5 pauses before entry at 13.75s; stage 6 pauses at 16.25 and 17.5s. Stages 5/6 play at 0.65 times source speed, multiplied by the user-selected speed. Coordinate playback remains linear in source PTS.

Fixed image registration at (.5,.5), width .65 and body scale .74 is separately approved and is not detector confidence. Model confidence stays null and the source candidate metadata is preserved. Runtime authorization comes from the independently reviewed source hashes plus the integrity-checked packed hash. Back/side reconstruction is unsupported and those controls were removed.

The explicitly authorized teaching simplification clips only free distal belt drawing at waist-relative y=1.1 throughout the entire source interval. This is body y=.814, above the existing knee. It never changes hands, contacts or source data, and the flat drawing cap is not labeled an observed physical endpoint. Stages 5/6 preserve the observed loose opening and hands; only source stage 7 tightens it. Hidden passages and sparse A/B endpoint observations remain unknown, not fabricated 3D physics or full material tracking.

`scripts/pack-belt-tracking.py --belt <tracking-v4.json> --hands <hand-masks-sam.json> --out <packed.json>` deterministically removes unused landmark/flow payloads while preserving every frame, observation/QC state, polygons, holes, shading and null endpoints. Five-decimal coordinates differ by at most .0064 original-source pixels. The gzip asset is 3,221,190 bytes; the browser explicitly decompresses and verifies SHA256 before rendering. A failed request/integrity check offers retry; leaving cancels pending loading. Source media and raw model artifacts remain local audit inputs and are not bundled.

Validation distinguishes observation geometry tests, source review, app playback, and synthetic real-belt marker tracking. It does not establish live-camera knot recognition or hidden 3D correctness. Both virtual and real modes use the same frame and registration; missing observed tips suppress target arrows but never stop actual color-marker tracking.
