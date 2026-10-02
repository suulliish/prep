// Каталог мастерской v2 (черновик данных для content/ship_items.mjs). need: {}=сразу; {boss:k}=после босса мира k (отсек k);
// {lvl:[k,L]}=отсек k уровня L; {date}=сезон (появляется и остаётся); {petStage:n}=этап роста питомца; {arena:n}=n-й пробник арены пройден (участие, не балл)
export const OLD = [ // 22 нынешних: id не меняются, цены пересчитаны (купленное не трогается)
 ['rope_coil',40],['barrel_pair',50],['flower_pot',60],['lantern_floor',70],['gem_crate',90],['cannon',140],['map_table',150],['gold_bars',170],['lantern_big',90],
 ['statue_hero',220],['chest_gold',120],['captain_chair',110],['trophy',260],['bunting',80],['banner_star',100],['string_lights',110],
 ['pet_cat',160],['pet_dog',180],['pet_fox',220],['pet_parrot',280],['pet_penguin',340],['pet_panda',420]].map(([id,price])=>({id,price,kind:'old',need:{}}));
export const ROOMS = [ // отсек за босса мира k; L1 бесплатно с сундуком, L2/L3 — монеты
 ['trophy_hall','Трофей залы'],['greenhouse','Жасыл бақ'],['lookout','Бақылау мұнарасы'],['crystal_engine','Кристалл қозғалтқыш'],['arcade','Неон ойын залы'],
 ['storm_mast','Найзағай антеннасы'],['observatory','Обсерватория'],['forge','Ұстахана'],['aquarium','Аквариум'],['library','Алыптар кітапханасы'],['beacon','Жарық маяғы']];
export const UPG = ROOMS.flatMap(([id],k)=>[
  {id:`${id}_2`,price:100+12*k,kind:'upg',need:{boss:k}},
  {id:`${id}_3`,price:160+20*k,kind:'upg',need:{lvl:[k,2]}}]);
export const FURN = ROOMS.map(([id],k)=>({id:`${id}_f1`,price:80+14*k,kind:'furn',need:{lvl:[k,2]}}));
// аксессуары питомца: открываются этапами роста (честные дни) — поздний сток до экзамена
export const PET_STAGE_DAYS=[0,5,12,20,30,42,56,72,90,110,130,155,180,210,245,280,320]; // этап i с PET_STAGE_DAYS[i] честных дней
export const ACC = [
 ['acc_bow_red',60,2],['acc_scarf',70,3],['acc_cap',80,4],['acc_glasses',90,5],['acc_bell',100,6],['acc_bandana',110,7],
 ['acc_goggles',120,8],['acc_headphones',130,10],['acc_wings',150,12],['acc_halo',170,13],['acc_crown_gold',200,14],['acc_star_aura',220,16]]
 .map(([id,price,st])=>({id,price,kind:'acc',need:{petStage:st}}));
export const SEASON = [
 ...[['ny26_tree',110],['ny26_lights',80],['ny26_snowman',110]].map(([id,price])=>({id,price,kind:'season',need:{date:'2026-12-20'}})),
 ...[['nau27_kiiz',130],['nau27_kazan',120],['nau27_dombra',140]].map(([id,price])=>({id,price,kind:'season',need:{date:'2027-03-14'}})),
 ...[['sum27_hammock',110],['sum27_kite',110]].map(([id,price])=>({id,price,kind:'season',need:{date:'2027-06-01'}})),
 ...[['last27_banner',150],['last27_clock',150]].map(([id,price])=>({id,price,kind:'season',need:{date:'2027-09-01'}})),
 ...[['ny27_tree_big',180],['ny27_fireworks',180]].map(([id,price])=>({id,price,kind:'season',need:{date:'2027-12-20'}})),
 ...[['nau28_yurt',200],['nau28_tus',160]].map(([id,price])=>({id,price,kind:'season',need:{date:'2028-03-14'}})),
];
// свет: открыт сразу (у ребёнка, который уже всё купил, есть цель в день выпуска)
export const LIGHT = [['light_lanterns_row',70],['light_mast_star',90],['light_deck_glow',100],['light_portal_ring',110],['light_aurora_sail',130],['light_beam_bow',140],['light_fireflies',120],['light_neon_rail',150]]
 .map(([id,price])=>({id,price,kind:'light',need:{}}));
export const ARENA = [1,3,5,7,9,11].map((n,i)=>({id:`arena_${n}`,price:[160,180,200,220,240,260][i],kind:'arena',need:{arena:n}}));
export const ALL=[...OLD,...LIGHT,...UPG,...FURN,...ACC,...SEASON,...ARENA];
export const sum=a=>a.reduce((s,x)=>s+x.price,0);
// резерв на случай большого старого баланса (B > 1500 при переносе): 4-й уровень отсеков, по одному на каждые 350 монет сверх 1000
export const RESERVE = ROOMS.map(([id],k)=>({id:`${id}_4`,price:250+20*k,kind:'upg4',need:{lvl:[k,3]}}));
