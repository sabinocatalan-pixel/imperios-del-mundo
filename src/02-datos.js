/* ==================== 02-datos.js ====================
   Facciones, territorios, adyacencias, continentes, épocas, unidades. */
/* ==================== DATOS ==================== */
const FACTIONS={
  AG:{name:"Imperio Águila",emb:"🦅",color:"#C63D2F",rel:"Culto del Águila",pers:"agresivo",aggr:0.85,eco:0.3},
  SO:{name:"Imperio del Sol",emb:"☀️",color:"#D9A441",rel:"Fe Solar",pers:"equilibrado",aggr:0.55,eco:0.5},
  CO:{name:"Imperio Corona",emb:"👑",color:"#3E6FA8",rel:"Iglesia de la Corona",pers:"defensivo",aggr:0.3,eco:0.55},
  SB:{name:"Imperio Sabana",emb:"🦁",color:"#5C8A3A",rel:"Espíritus de la Sabana",pers:"oportunista",aggr:0.6,eco:0.4},
  DR:{name:"Imperio Dragón",emb:"🐉",color:"#7B5EA7",rel:"Vía del Dragón",pers:"económico",aggr:0.35,eco:0.85},
  CR:{name:"Imperio Coral",emb:"🐚",color:"#2E8C83",rel:"Canto del Coral",pers:"defensivo",aggr:0.3,eco:0.6}
};
function fname(f){return FACTIONS[f].emb+" "+FACTIONS[f].name;}
const TERR={
  CAN:{n:"Canadá",f:"AG",p:"60,60 250,45 300,95 235,125 120,120",c:[178,88],res:"ciencia"},
  USA:{n:"EE. UU.",f:"AG",p:"90,130 235,130 265,175 190,205 110,180",c:[182,163],res:"oro"},
  MEX:{n:"Mesoamérica",f:"AG",p:"150,210 235,205 265,250 215,275 175,250",c:[210,240],res:"comida"},
  GCO:{n:"Gran Colombia",f:"SO",p:"250,285 320,275 340,320 285,340 250,320",c:[293,308],res:"oro"},
  BRA:{n:"Brasil",f:"SO",p:"300,330 385,320 400,395 340,430 305,385",c:[350,370],res:"comida"},
  PER:{n:"Perú",f:"SO",p:"255,330 295,345 300,400 270,430 245,380",c:[272,378],res:"oro"},
  SUR:{n:"Cono Sur",f:"SO",p:"275,435 330,440 325,505 285,510 265,470",c:[297,472],res:"comida"},
  EUO:{n:"Europa Occ.",f:"CO",p:"455,120 505,110 520,160 480,180 450,155",c:[485,145],res:"ciencia"},
  EUN:{n:"Escandinavia",f:"CO",p:"470,55 555,45 570,95 510,105 465,95",c:[518,75],res:"ciencia"},
  EUE:{n:"Europa Este",f:"CO",p:"560,100 640,90 655,145 585,165 545,140",c:[598,125],res:"comida"},
  MAG:{n:"Magreb",f:"SB",p:"440,200 540,190 555,235 480,250 445,235",c:[495,220],res:"fe"},
  AFO:{n:"África Occ.",f:"SB",p:"445,255 520,250 530,310 470,320 440,290",c:[485,285],res:"oro"},
  AFE:{n:"África Or.",f:"SB",p:"535,250 610,240 625,310 565,330 530,300",c:[578,285],res:"comida"},
  SUD:{n:"Sudáfrica",f:"SB",p:"505,335 585,335 590,405 540,425 505,385",c:[547,375],res:"oro"},
  MOR:{n:"Medio Oriente",f:"DR",p:"585,175 665,165 685,225 625,245 580,215",c:[632,205],res:"fe"},
  RUS:{n:"Rusia-Siberia",f:"DR",p:"650,50 900,55 910,110 760,130 655,95",c:[785,88],res:"ciencia"},
  IND:{n:"India",f:"DR",p:"690,235 745,225 760,290 715,305 685,270",c:[722,265],res:"fe"},
  CHN:{n:"China",f:"DR",p:"760,135 890,120 905,205 815,230 755,195",c:[830,172],res:"oro"},
  SEA:{n:"Sudeste Asiático",f:"CR",p:"770,240 840,235 855,300 805,315 765,285",c:[808,272],res:"comida"},
  JPN:{n:"Japón",f:"CR",p:"915,130 952,125 962,192 928,197",c:[940,160],res:"ciencia"},
  AUS:{n:"Australia",f:"CR",p:"830,360 940,350 950,440 860,455 825,410",c:[887,402],res:"oro"}
};
const ADJ={
  CAN:["USA","EUN","RUS"],USA:["CAN","MEX","EUO"],MEX:["USA","GCO"],
  GCO:["MEX","BRA","PER"],BRA:["GCO","PER","SUR","AFO"],PER:["GCO","BRA","SUR"],SUR:["PER","BRA"],
  EUO:["USA","EUN","EUE","MAG"],EUN:["CAN","EUO","EUE","RUS"],EUE:["EUN","EUO","RUS","MOR"],
  MAG:["EUO","AFO","AFE","MOR"],AFO:["MAG","AFE","SUD","BRA"],AFE:["MAG","AFO","SUD","MOR"],SUD:["AFO","AFE"],
  MOR:["EUE","MAG","AFE","RUS","IND"],RUS:["EUN","EUE","MOR","CHN","JPN","CAN"],
  IND:["MOR","CHN","SEA"],CHN:["RUS","IND","SEA","JPN"],SEA:["IND","CHN","AUS"],
  JPN:["CHN","RUS"],AUS:["SEA"]
};
const SEAROUTES=[["CAN","EUN"],["USA","EUO"],["BRA","AFO"],["CAN","RUS"],["CHN","JPN"],["RUS","JPN"],["SEA","AUS"]];
const CONTINENTS={
  "Norteamérica":{ids:["CAN","USA","MEX"],bonus:6},
  "Sudamérica":{ids:["GCO","BRA","PER","SUR"],bonus:7},
  "Europa":{ids:["EUO","EUN","EUE"],bonus:6},
  "África":{ids:["MAG","AFO","AFE","SUD"],bonus:7},
  "Asia":{ids:["MOR","RUS","IND","CHN"],bonus:8},
  "Oceanía-Pacífico":{ids:["SEA","JPN","AUS"],bonus:5}
};
const ERAS=["É. Antigua","É. Medieval","É. Industrial","É. Moderna"];
const ERA_COST=[0,35,80,150];
const RESICON={oro:"🪙",comida:"🌾",ciencia:"🔬",fe:"✨"};
const SPECIALS=["☄️ Lluvia de meteoros","🔥 Flechas de fuego","💣 Bombardeo","✈️ Ataque aéreo"];
const UNIT_NAMES=[
  {melee:"Guerrero",ranged:"Hondero",heavy:"Mamut",healer:"Chamán",siege:"Catapulta"},
  {melee:"Espadachín",ranged:"Arquero",heavy:"Caballero",healer:"Monje",siege:"Trebuchet"},
  {melee:"Fusilero",ranged:"Mosquetero",heavy:"Cañón",air:"Biplano",healer:"Médico",siege:"Mortero"},
  {melee:"Soldado",ranged:"Francotirador",heavy:"Tanque",air:"Caza",healer:"Médico de campaña",siege:"Artillería"}
];
const CULT_WIN=250,FAITH_WIN=250;
