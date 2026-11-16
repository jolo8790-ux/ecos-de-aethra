import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
// Reconstruye assets/characters/*.glb.js a partir del paquete KayKit Adventurers 1.0 (CC0).
// Uso: git clone https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 kaykit
//      npm i @gltf-transform/core@4 @gltf-transform/functions@4
//      node tools/build_assets.mjs kaykit/addons/kaykit_character_pack_adventures/Characters/gltf/
const SRC = (process.argv[2] || './kaykit/addons/kaykit_character_pack_adventures/Characters/gltf/').replace(/\/?$/, '/');
const OUT = new URL('../assets/characters/', import.meta.url).pathname;
const toJs = (name) => { const b = fs.readFileSync(OUT + name + '.glb').toString('base64'); fs.writeFileSync(OUT + name + '.glb.js', `// Modelo ${name}.glb codificado en base64 (KayKit Adventurers, CC0, Kay Lousberg).\nexport default "${b}";\n`); fs.unlinkSync(OUT + name + '.glb'); };
const killAnim = a => { for (const sm of a.listSamplers()) sm.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose(); }; fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO();
const HIDE = /Knife|Crossbow|Throwable|Sword|Shield|Axe|Staff|Wand|Spellbook|Mug|^1H|^2H|Hat|Helmet/i;
// personajes sin animaciones ni armas
const chars = { Rogue: 'lia', Rogue_Hooded: 'kael', Mage: 'marta', Knight: 'tomas' };
for (const [src, out] of Object.entries(chars)) {
  const doc = await io.read(SRC + src + '.glb');
  const root = doc.getRoot();
  for (const a of root.listAnimations()) killAnim(a);
  for (const n of root.listNodes()) if (n.getMesh() && HIDE.test(n.getName())) { n.getMesh().dispose(); n.dispose(); }
  for (const acc of root.listAccessors()) if (acc.listParents().every(p => p.propertyType === 'Root')) acc.dispose();
  await doc.transform(prune(), dedup());
  await io.write(OUT + out + '.glb', doc);
  console.log(out, fs.statSync(OUT + out + '.glb').size); toJs(out);
}
// animaciones compartidas (mismo esqueleto en todos): solo las que usa el juego
const KEEP = ['Idle', 'Unarmed_Idle', 'Walking_A', 'Walking_B', 'Running_A', 'Running_B', 'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Interact', 'PickUp', 'Cheer', 'Use_Item', 'Hit_A', 'Dodge_Forward', 'Dodge_Backward', 'Sit_Floor_Idle',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', 'Block', 'Death_A', 'Spellcast_Raise'];
const doc = await io.read(SRC + 'Rogue.glb');
const root = doc.getRoot();
for (const a of root.listAnimations()) if (!KEEP.includes(a.getName())) killAnim(a);
for (const n of root.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.dispose(); }
for (const s of root.listSkins()) s.dispose();
for (const t of root.listTextures()) t.dispose();
for (const m of root.listMaterials()) m.dispose();
for (const acc of root.listAccessors()) if (acc.listParents().every(p => p.propertyType === 'Root')) acc.dispose();
await doc.transform(prune({ keepLeaves: true }), dedup());
await io.write(OUT + 'anims.glb', doc);
console.log('anims', fs.statSync(OUT + 'anims.glb').size, root.listAnimations().map(a => a.getName()).length); toJs('anims');
