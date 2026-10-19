import {paperMotion} from './paper-motion.js';
import {buildBlenderBelt} from './belt-blender-motion.js';
import {applyVolumeContacts} from './belt-volume-contact.js';

// The tracked source remains the timing authority. From the first Blender pose
// onward the belt is the single, fixed-length material route authored in Blender.
export function lessonMotion(frame){
  const legacy=paperMotion(frame),t=frame.originalPTS;
  if(t<8.5)return legacy;
  const volume=buildBlenderBelt(t);
  const attached=t>=14.8?applyVolumeContacts(frame,volume,legacy.rig):{rig:legacy.rig,contacts:[]};
  const strips=volume.strips.map(strip=>({...strip,freeEndVisible:true,panels:strip.triangles}));
  return {...legacy,volume,strips,rig:attached.rig,contacts:attached.contacts,
    guideEnds:Object.fromEntries(strips.map(strip=>{
      const point=strip.samples.at(-1).center;
      return [strip.material,{position:point.slice(0,2),position3D:point,freeEndVisible:true,kind:'fixed material end'}];
    })),
    inference:{...volume.inference,sourceMotion:'F-NJFRGi6ys tracked timing; Blender-authored material poses'}};
}
