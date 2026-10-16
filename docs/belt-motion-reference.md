# Belt demonstration reference and validation

The lesson retargets continuous motion from the supplied [F-NJFRGi6ys reference](https://www.youtube.com/watch?v=F-NJFRGi6ys) onto the character's own fixed-size arms, hands and black belt. The [IG5WBxopLJw reference](https://www.youtube.com/watch?v=IG5WBxopLJw) supports wrap/layer review; [poG-fDcqUA0](https://www.youtube.com/watch?v=poG-fDcqUA0) is a secondary comparison. The app does not embed source footage or draw source hand/belt silhouette masks.

All 1,285 original controls and PTS at 60fps (0 through21.4s) remain in the hashed dataset. Between native frames only resolved grip/wrist/curl/angle controls are interpolated; source observations and nullable physical tips are retained unchanged. Angles take the shortest arc. Main, camera and detail rendering share one pose/time. Contact projection is explicitly inferred; it is not a measured anatomical reconstruction.

## Seven lesson intervals

| Stage | Source interval | Action |
| --- | --- | --- |
| 1 | 2s hold | Midpoint at the waist |
| 2 | 2-4.1s | Wrap behind the body |
| 3 | 4.1-5.4s | Bring ends forward and cross |
| 4 | 5.4-12.5s | A under both standing layers |
| 5 | 12.5-15.5s | Return A through layers, retain a loose opening |
| 6 | 15.5-18s | Feed B tip first through the retained passage |
| 7 | 18-19.8s | Pull ends and flatten the final knot |

A is the first threaded material end, initially viewer-left; B starts viewer-right. These are material names, not anatomical hands. The standalone end-length adjustment stage remains removed. Display ends are deliberately shortened for teaching; their A/B markers are authored guide endpoints and are not sparse source-observed physical tips. Hidden free ends suppress their marker.

Stages5/6 run at0.65x source speed, with pauses before insertion (13.75s,16.25s) and after B passes (17.5s). Only the rapid first passage10.65-11.0s slows to0.3x, adding0.817s. This avoids dragging out the whole lesson. User playback speed multiplies these rates.

## Native drawing and readable entry

The character uses a fixed upper arm0.65 and forearm0.60 in local waist units. Only the belt mannequin disables its old hanging arms; other judo idle/tap rendering remains unchanged. Belt faces are flat 3D material panels of width0.09 and thickness0.008, sharing exact crease-edge objects. Coplanar subdivisions are not additional folds. The reviewed result uses the existing faces and two outgoing ends, without decorative extra folds.

Stages4-7 crop the detail view around the knot. Stages5/6 emphasize existing face edges and label the intended A/B entry. This overlay changes no panel geometry. It supplies instructional readability; the unannotated black silhouette alone is not claimed to reveal an obvious hole. The detail and main view use the same pose and mirror mapping.

The virtual camera guide and actual-belt color-marker mode remain separate. In actual mode A/B labels follow the registered physical markers; translucent authored guides do not add duplicate A/B labels. Marker occlusion/recovery does not change lesson progression. This is not live recognition of the complete physical knot.

## Reviewed inputs and delivery

Source video SHA256: `661ed0670e8afbadd42a0c3cc21eb9ae86f171c0d5f5c826272b471f4b689822`.
Controls SHA256: `ebcf8e7605ad0c46e4c5067bab2406c3a7d1ed8f68f9fea213316df20f83f86a`.
The previous v4 motion (`4e176b335a3ece236800f15d87db724ff61bb2952208d355434224ad5dfd935c`) is retained only as a regression baseline, not proof of correct threading. Current runtime module hashes, including the wrap helper, are recorded in `BELT_REVIEW` in `src/belt-source.js`.

The explicit gzip asset is693,607 bytes. The browser decompresses and verifies controls SHA256 and original source/frame coverage before rendering. Failure offers retry; leaving cancels pending loading; successful data are cached. Source footage, raw model data and review images remain local audit inputs, not product assets. The legacy3.2MB mask asset and source-mask player are removed.

## Verification and limits

`tests/belt-paper.test.mjs` checks all native frames, fixed bones, shared panel edges/signed material width, declared grip/pad contact features, source immutability, and four coplanar-subdivision regressions that failed the previous candidate. `tests/belt-interpolation.test.mjs` checks all native/midpoint controls, shortest angles, local clock duration and continuous timeline progression. Existing `belt-lesson.test.mjs` covers the retained legacy geometry utility only; it is not evidence for the new renderer.

Independent review separately covered structural/contact/boundary checks, source-aligned sequence, and actual visual presentation. Real built-app checks cover seven stages,44 scrub positions, mobile, same-time detail, failed download/bad hash/retry/abort, gzip transfer, synthetic camera and marker recovery, both mirror modes, stopped camera tracks, and zero changed idle/tap pixels. The full regression suite remains required.

Hidden material paths and finger contacts are authored inference. This is an explanatory flat-strip rig, not a cloth solver, proof of collision-free hidden3D topology, or a guarantee of physical knot strength. All1,285 frames are retained; this does not mean every frame was manually visually reviewed.

## Reference correction after the rejected v4 presentation

Re-opened primary source frames at 2.0, 3.5, 5.4, 7.5, 13.5, 14.5, 15.5, 16.5, 16.75, 17.0, 18.5 and 19.5 seconds. Front view, no additional mirror. The source is cropped at the waist for comparison, without changing aspect ratio. Baseline modules/captures and the opened side-by-side report are local artifacts in `.test-output/belt-reference-fix/`.

Observed defects and corrections:

- The initial pose already drew two standing bands. `belt-wrap-motion.js` now starts with one band and adds the returning front layer as the wrap advances. Opposite waist runs cross before the short free ends descend.
- At 7?8 seconds the old code interpolated end positions between opposite hands while disabling both contacts. Hands now remain fitted to belt material sections. A hand need not be holding the physical tip or only one material end. The rear exchange remains inferred because the source hides it.
- In the old 17-second pose, the apparent opening was only about 0.0146 units high for a 0.09-wide belt, and B's outlet lay inside A's visible face. The retained opening now provides clearance for both actual B outlet edges. The receiving interval, not just a single final pose, is tested.
- A previously skipped the left waist-layer passage. It now enters above the outer layer, follows a distinct concealed span and emerges below it. The upper return stays supported by the hand. B enters at a separate right-side gap before emerging through the retained A opening.
- Tightening previously changed the crossing by painting an increasing fraction of A over B. The A return now retains its front layer throughout; the cloth geometry contracts instead. After feeding, A's hidden passage and tail flatten into the same direction, without an extra final right-angle bend.

Visible entry/exit, support, order and final silhouette are reference observations. Hidden depth, exact material contact and the loosened instructional opening are authored inference. Shortened display length remains deliberate. No source silhouettes, new decorative folds, character proportion changes or camera-tracking changes are included.

`tests/belt-threading.test.mjs` checks outlet clearance, the concealed A passage, retained projected tail width, stable crossing order, final coplanar tail and time-boundary continuity. `tests/belt-wrap.test.mjs` checks the standing layers, crossed front paths, both visible contacts and the 9-second join. These complement the native-frame and immutable-source tests; they do not certify full hidden 3D cloth physics. In particular, finite-difference speed can be higher than the old, incorrect route during tightening, so continuity alone is not evidence of identical motion.

The built-app review includes all seven stages, 44 intermediate scrub positions, mobile layout and uninterrupted progression through the lesson. Source comparison and inspection of intermediate poses are separate from automated test results. The source's occluded rear route and full physical knot topology remain unmeasured.
