"""Extract the supplied AAH model without shipping its large source bone meshes."""
from pathlib import Path
import xml.etree.ElementTree as E
import json, struct, hashlib
repo = Path(__file__).resolve().parent.parent
source_dir = repo / 'references/ms_arm_and_hand/AAH Model/mujoco model'
source = source_dir / 'RightArmAndHand_NoMuscles.xml'
wrist = E.parse(source).find(".//body[@name='RA3L']")
nodes = []
def walk(body, parent=-1):
    index = len(nodes)
    node = {'name': body.get('name'), 'parent': parent,
            'position': list(map(float, body.get('pos', '0 0 0').split())) if parent >= 0 else [0, 0, 0], 'joints': []}
    if parent >= 0:
        for joint in body.findall('joint'):
            node['joints'].append({'name': joint.get('name'), 'axis': list(map(float, joint.get('axis').split())),
                                   'range': list(map(float, joint.get('range').split()))})
    mesh = body.find('geom')
    if mesh is not None and node['name'].startswith(('RA7D', 'RA6D1')):
        data = (source_dir / 'Geometry' / (mesh.get('mesh') + '.stl')).read_bytes()
        vertices = []
        for i in range(struct.unpack('<I', data[80:84])[0]):
            triangle = struct.unpack('<12fH', data[84+50*i:134+50*i])
            vertices.extend([triangle[3:6], triangle[6:9], triangle[9:12]])
        lower = min(v[1] for v in vertices)
        tip = [v for v in vertices if v[1] < lower + .0015]
        node['tip'] = [sum(v[k] for v in tip) / len(tip) for k in range(3)]
    nodes.append(node)
    for child in body.findall('body'):
        walk(child, index)
walk(wrist)
header = '// Derived from the user-supplied AAH right arm model (MIT). Lengths in metres.\n// Source SHA256: ' + hashlib.sha256(source.read_bytes()).hexdigest() + '\n'
(repo / 'src/hand-rig-data.js').write_text(header + 'export const HAND_RIG=' + json.dumps(nodes, separators=(',', ':')) + ';\n', encoding='utf-8', newline='\n')
(repo / 'assets/AAH-LICENSE.txt').write_bytes((repo / 'references/ms_arm_and_hand/LICENSE.txt').read_bytes())
print(f'Extracted {len(nodes)} bodies and distal tips')
