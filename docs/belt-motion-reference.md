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

The pre-change geometry at `6f19e10` was preserved as a comparator. Seven source/baseline/candidate events were captured at a common candidate scale; source images retain their aspect ratio. A local event-scrubbable report was built with the `animation-visual-qa` skill in `.test-output/motion-review/review.html`. Reference images are local review evidence, not product assets.

`tests/belt-lesson.test.mjs` checks material length, strip width, tip-led insertion, held-end stability, B passage order, opening clearance, outward finish, continuous sampled motion and viewport bounds. `tests/belt-timeline.test.mjs` checks both insertion holds, seeking and cancellation. Browser scripts check playback speed, pauses, auto advance, camera overlay controls and mobile layout. These are distinct from reference comparison and do not validate live belt tracking accuracy.

Retained requirements: black belt, total material length 6.4, existing shortened mannequin, seven stages without a separate end-length adjustment stage, and virtual/real belt modes.
