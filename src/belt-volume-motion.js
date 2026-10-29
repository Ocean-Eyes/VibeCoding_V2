import {paperMotion} from './paper-motion.js';
import {buildBlenderBelt} from './belt-blender-motion.js';
import {applyVolumeContacts} from './belt-volume-contact.js';
import {buildPreparationBelt} from './belt-preparation.js';

// Preparation and tying share one fixed-length material route. The original
// Blender folds remain authoritative from 8.5s onward.
export function lessonMotion(frame){
  const legacy=paperMotion(frame),t=frame.originalPTS;
  const volume=t<8.5?buildPreparationBelt(t):buildBlenderBelt(t);
  const attached=applyVolumeContacts(frame,volume,legacy.rig);
  const strips=volume.strips.map(strip=>({...strip,freeEndVisible:true,panels:strip.surfaceTriangles??strip.triangles}));
  return {...legacy,volume,strips,rig:attached.rig,contacts:attached.contacts,
    guideEnds:Object.fromEntries(strips.map(strip=>{
      const point=strip.samples.at(-1).center;
      return [strip.material,{position:point.slice(0,2),position3D:point,freeEndVisible:true,kind:'fixed material end'}];
    })),
    inference:{...volume.inference,sourceMotion:'F-NJFRGi6ys tracked timing; Blender-authored material poses'}};
}
