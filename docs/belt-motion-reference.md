# Belt demonstration reference and validation

The lesson retargets continuous motion from the supplied [F-NJFRGi6ys reference](https://www.youtube.com/watch?v=F-NJFRGi6ys) onto the character's own fixed-size arms, hands and black belt. The [IG5WBxopLJw reference](https://www.youtube.com/watch?v=IG5WBxopLJw) supports wrap/layer review; [poG-fDcqUA0](https://www.youtube.com/watch?v=poG-fDcqUA0) is a secondary comparison. The app does not embed source footage or draw source hand/belt silhouette masks.

All 1,285 original controls and PTS at 60fps (0 through21.4s) remain in the hashed dataset. Between native frames only resolved grip/wrist/curl/angle controls are interpolated; source observations and nullable physical tips are retained unchanged. Angles take the shortest arc. Main, camera and detail rendering share one pose/time. Contact projection is explicitly inferred; it is not a measured anatomical reconstruction.

## Seven lesson intervals

| Stage | Source interval | Action |
| --- | --- | --- |
| 1 | 0-2s authored preparation | Hold midpoint at chest, lower to waist |
| 2 | 2-5s authored preparation | Wrap behind the body and exchange ends |
| 3 | 5-8.5s authored preparation | Bring ends forward and cross |
| 4 | 8.5-12.5s | A under both standing layers |
| 5 | 12.5-15.5s | Return A through layers, retain a loose opening |
| 6 | 15.5-18s | Feed B tip first through the retained passage |
| 7 | 18-19.8s | Pull ends and flatten the final knot |

A is the first threaded material end, initially viewer-right in the new chest-held preparation; B starts viewer-left. Material identity stays fixed through the rear exchange and front crossing. The full material length is displayed throughout. A/B markers follow actual mesh endpoints and are hidden behind the body.

Stages5/6 run at0.65x source speed, with pauses before insertion (13.75s,16.25s) and after B passes (17.5s). Only the rapid first passage10.65-11.0s slows to0.3x, adding0.817s. This avoids dragging out the whole lesson. User playback speed multiplies these rates.

## Native drawing and readable entry

From source time 8.5s, the website now uses the Blender-authored material sequence
in `belt-blender-data.js` and `belt-blender-motion.js`. Display width is 0.078 and
thickness is 0.006; the authored knot core and total material length
7.060652279241386 remain fixed. The exposed waist connections are flattened
during tightening as described below. The original export retains its 0.09/0.007
dimensions for provenance. Both front and angled detail views depth-test the
same closed surface, including the software fallback. At the marked 17.208s
crossings, B remains in front of A in the left circle, and passes behind A in
the central square. Yellow A / blue B refer to the Blender review colors; the
product continues to show a black belt.

The user also marked that same return crossing in the final 19.5s pose. A new
Blender render of `source-square-crossing/pose-19.500/pose.json` and a web render
with only A/B pigment changed confirm yellow A in front of blue B there. The
older `source-sequence-survey/source-19.500/front.png` predates that correction
and is not the final reference. Regression checks include 17.208, 18.125, 19.5
and the held finish at 19.8s. The prepared temporary folder and repository use
identical source motion data. Display cross section, material-coordinate rounding
and body visibility were changed during integration; the subsequent preparation
and waist-connection corrections are explicitly authored website changes.

Waist occlusion follows a curved front surface matching the illustrated hips.
The previous flat clipping plane hid the side wraps before they reached the
character's silhouette. This correction changes visibility, not the mannequin's
proportions or belt trajectory. Shared material vertices weld the parts;
interpolated adapter mismatch is bounded below 0.00075 (one eighth of display
thickness), while authored keys join within 1e-7. A sub-micrometre waist-arc
sampling drift is corrected in material coordinates without moving the path.

The 2026-10-19 review captured actual front/oblique app views, playback and mobile
layout. Nineteen sampled closed meshes from 8.5 to 19.8s had no strict self/body
intersections or vertices inside the evaluated Blender torso. This is sampled
geometry evidence, not a continuous-time physics guarantee or a volumetric model
of the illustrated judogi. Local evidence is in `artifacts/web-integration-review/`
and is deliberately excluded from the website commit.

The earlier 8.5s shape discontinuity is now removed. `belt-preparation.js`
progressively unrolls the first Blender pose from its material midpoint. At the
user's request, preparation starts with the belt held at chest height and lowers
to the waist before wrapping. The straight held span distributes enough material
across the hands that the full hanging ends stay above the floor. Every surface
vertex translates rigidly during lowering: there is no floor bend diverting
length into depth, shortening, or rescaling. End exchanges are staggered so one
hand remains in contact. Material laid around the torso stays on the accepted
rear over/under route.
This earlier motion is newly authored, not an additional approved Blender clip.
The complete thick surface converges to the first Blender pose without changing
that pose. Measured center-line arc length differs from the fixed material
budget by less than 0.004 units across the preparation samples (tessellation).

Hands attach to material coordinates throughout preparation and A threading,
with explicit rear/front exchanges and a continuous acquisition of the late
opening/support contacts. Wrist orientation respects fixed arm reach; finger
bone geometry is retained. Hidden hands, rear tails and endpoint markers are
occluded by the waist, judogi skirt and trouser legs. Front detail uses the same
body occlusion; angled inspection exposes the geometry without the body mask.

The continuity review checks chest placement, the 8.5s thick-surface join,
framewise hand reach/contact, actual center-line length and rear-tail visibility.
Twenty sampled preparation surfaces have no strict self/body intersections
against the evaluated Blender torso. This is sampled collision evidence, not a
cloth simulation. Local baseline, screenshots, metrics and comparison report are
in `artifacts/belt-continuity-review/` and remain outside the website commit.

The next user correction removes the two raised shoulders beside the finished
knot. From 18 to 19.5s, `belt-waist-settle.js` flattens the exposed connections.
The inner wrap underneath the knot retains its previous height to clear A's
return fold. Its extra arc length is subtracted from the length released by the
shoulders, and that net material moves into the free ends. The A/B knot core and
both marked over/under relationships remain unchanged. The measured rendered
center-line length stays within 0.003 units of the fixed material budget through
tightening; this bound includes mesh tessellation error. This is an authored
ribbon deformation, not a cloth simulation. The wider preparation grips remain
within the existing arm reach, and framewise tests check grip continuity.
Actual app comparisons, 48 captured playback frames and surface audits for this
correction are kept locally in `artifacts/belt-fixed-length-review/`. The audit
checks 119 rendered thick surfaces, including every 60fps frame from 18 to 19.8s;
none intersects itself or the evaluated Blender torso, and no tested belt vertex
lies inside that torso. This does not certify continuous-time cloth physics.

The following sections are historical notes on the earlier panel renderer,
retained as regression utilities but no longer used to draw the product belt:

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

Hidden material paths and finger contacts are authored inference. This is an explanatory flat-strip rig, not a cloth solver, proof of collision-free hidden3D topology, or a guarantee of physical knot strength. All 1,285 frames are retained. The initial validation here was structural; the subsequent full-frame visual audit is documented below.

## Reference correction after the rejected v4 presentation

Re-opened primary source frames at 2.0, 3.5, 5.4, 7.5, 13.5, 14.5, 15.5, 16.5, 16.75, 17.0, 18.5 and 19.5 seconds. Front view, no additional mirror. The source is cropped at the waist for comparison, without changing aspect ratio. Baseline modules/captures and the opened side-by-side report are local artifacts in `.test-output/belt-reference-fix/`.

Observed defects and corrections:

- The initial pose already drew two standing bands. `belt-wrap-motion.js` now starts with one band and adds the returning front layer as the wrap advances. Opposite waist runs cross before the short free ends descend.
- At 7?8 seconds the old code interpolated end positions between opposite hands while disabling both contacts. Hands now remain fitted to belt material sections. A hand need not be holding the physical tip or only one material end. The rear exchange remains inferred because the source hides it.
- In the old 17-second pose, the apparent opening was only about 0.0146 units high for a 0.09-wide belt, and B's outlet lay inside A's visible face. The retained opening now provides clearance for both actual B outlet edges. The receiving interval, not just a single final pose, is tested.
- A previously skipped the left waist-layer passage. It now enters above the outer layer, follows a distinct concealed span and emerges below it. The upper return stays supported by the hand. B enters at a separate right-side gap before emerging through the retained A opening.
- Tightening previously changed the crossing by painting an increasing fraction of A over B. The A return now retains its front layer throughout; the cloth geometry contracts instead. This earlier version flattened the hidden passage into the tail; the full-frame review below replaces that transition because its intermediate faces turned edge-on.

Visible entry/exit, support, order and final silhouette are reference observations. Hidden depth, exact material contact and the loosened instructional opening are authored inference. Shortened display length remains deliberate. No source silhouettes, new decorative folds, character proportion changes or camera-tracking changes are included.

`tests/belt-threading.test.mjs` checks outlet clearance, the concealed A passage, retained projected tail width, stable crossing order, final broad tail and time-boundary continuity. `tests/belt-wrap.test.mjs` checks the standing layers, crossed front paths, both visible contacts and the 9-second join. These complement the native-frame and immutable-source tests; they do not certify full hidden 3D cloth physics. In particular, finite-difference speed can be higher than the old, incorrect route during tightening, so continuity alone is not evidence of identical motion.

The built-app review includes all seven stages, 44 intermediate scrub positions, mobile layout and uninterrupted progression through the lesson. Source comparison and inspection of intermediate poses are separate from automated test results. The source's occluded rear route and full physical knot topology remain unmeasured.


## Stiff-belt and completed-knot correction (full-frame review)

The next review compared all 1,285 source frames to native waist renders in 65 consecutive contact sheets, with individual expanded frames for reported defects. Review ranges were 0-599, 600-919 and 920-1284, with no gaps. Frames 0-119 precede the lesson and 1189-1284 follow its final stop; they were retained in the audit and distinguished from displayed lesson frames. This is a waist/contact-sheet visual review plus targeted full-resolution inspection, not a claim to have measured hidden 3D cloth or inspected every pixel.

The final reference (19.5s and 21.4s) shows a short upper shoulder behind the front wrapping face and an opposing lower face joined to the other end. Hip-length diagonal panels, a hanging lower rectangular return and an isolated upper horn did not reproduce that closed silhouette. The attachment positions and these existing return faces are now compact; standing layers stay at the waist and free ends remain short and straight. No source-image contours or new decorative loops are used.

Keeping a stiff broad face also exposed a defect missed by final-pose tests: merging A's hidden return with its tail rotated the visible plane edge-on twice during tightening. The corrected route retains the existing concealed return, shrinking it inside the knot. It does not claim to minimize the abstract number of hinges: the meaningful requirement is that the return stays concealed by belt material even after hands leave, while the exterior end remains a broad, straight face. Tests sample its entire polygon against the covering belt, excluding hands as occluders.

Full-frame review additionally found contact jumps at the rear-wrap visibility boundary, front crossing, 9.5s regrip, 16.75s receiving hand and 18.13s reacquisition. Material ownership now survives a front crossing; release and reacquisition have continuous weights instead of hard nearest-material changes. The completed ends settle at 19.5s and no longer follow lowering source hands after the observed release. These contacts and the hidden threading depth remain authored inference.

Audit artifacts are local in `.test-output/belt-knot-shape/`: initial all-frame pairs and metrics, final captures, targeted source comparison, actual-app interaction checks and playback. Regression checks cover all original frames' shared material edges, finite geometry, fixed bones and source immutability, together with full receiving/tightening width, concealed return, contact-boundary convergence and stationary released knot tests. Visual review is recorded separately from test totals.


The front return now emerges from the hip as an increasing material interval instead of switching a whole X into view. The held B end remains broad through the source's stationary hold; its hanging transition starts with the subsequent release, not at 8s. At the 16.5s feed boundary, the solver's crease-length minimum previously created extra exposed material in a nearly straight two-panel span. Clipping to the authored material budget removes that extrapolation, so both the endpoint and holding hand converge across the boundary. This is actual material clipping, not a width clamp or a painted cover.

Some turning ends legitimately show their thin edge (for example source frames361-362); the audit does not label every projected-width reduction a fault. The receiving/tightening interval specifically preserves the broad exposed planes shown in that reference. A figure-level correspondence check is distinct from proving occluded knot topology.

The final 989-to-990 comparison also found a surface pop despite continuous endpoints. The pre-entry B face is now partitioned by its existing material coordinate and fed progressively behind the standing waist layer from 16.0 to 16.5 seconds. This changes occlusion, not geometry, opacity or contact topology. Regression checks verify conserved face area, unchanged contacts and convergence of the remaining front-visible material.
