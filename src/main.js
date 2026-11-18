import Phaser from 'phaser';
import './style.css';
import './novel-layout.css';
import { nextPlayable, toggleOption, selectionValid, validateCharacter } from './player.js';
import { createPersistence } from './persistence.js';

const $ = selector => document.querySelector(selector);
const panel = $('#story-panel');
let storage;
try { storage = window.localStorage; } catch { console.log('Armazenamento indisponível: os envios pendentes ficam somente nesta aba.'); }
const linkEmail = new URLSearchParams(window.location.search).get('email');
const email = linkEmail && linkEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmail) ? linkEmail : null;
const saves = createPersistence({ storage, email });

const media = matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = media.matches;
let story, index = -1, selected = [], character, currentBackground = 'cafe.svg', scene;
const transcript = [];
const locations = {'cafe.svg':'O CAFÉ DA ESQUINA','garden.svg':'O JARDIM TRANQUILO','rooftop.svg':'ACIMA DA CIDADE'};

class EveningScene extends Phaser.Scene {
  constructor() { super('evening'); }
  preload() {
    ['cafe.svg','garden.svg','rooftop.svg'].forEach(file => this.load.svg(file, `/backgrounds/${file}`, {width:1600,height:1000}));
    const g = this.make.graphics({x:0,y:0},false);
    g.fillStyle(0xffedc2).fillCircle(4,4,4); g.generateTexture('glow',8,8); g.destroy();
  }
  create() {
    scene = this;
    this.picture = this.add.image(800,500,'cafe.svg');
    this.motes = this.add.particles(0,0,'glow',{x:{min:40,max:1560},y:{min:150,max:800},lifespan:6500,speedY:{min:-10,max:-26},speedX:{min:-6,max:6},scale:{start:0.55,end:0},alpha:{start:0.45,end:0},frequency:450,blendMode:'ADD'});
    this.motes.setVisible(!reducedMotion);
    if (currentBackground !== 'cafe.svg') this.changeBackground(currentBackground);
    $('#scene').classList.add('ready');
  }
  changeBackground(file) {
    if (!this.textures.exists(file)) {
      this.load.svg(file,`/backgrounds/${encodeURIComponent(file)}`,{width:1600,height:1000});
      this.load.once(`filecomplete-svg-${file}`,()=>this.changeBackground(file));
      this.load.start(); return;
    }
    if (this.picture.texture.key === file) return;
    const previous = this.picture;
    this.picture = this.add.image(800,500,file).setAlpha(reducedMotion ? 1 : 0).setDepth(-1);
    previous.setDepth(-2);
    if (reducedMotion) previous.destroy();
    else this.tweens.add({targets:this.picture,alpha:1,duration:950,ease:'Sine.easeInOut',onComplete:()=>previous.destroy()});
  }
}
new Phaser.Game({type:Phaser.AUTO,parent:'scene',width:1600,height:1000,backgroundColor:'#bc9c90',scene:EveningScene,scale:{mode:Phaser.Scale.ENVELOP,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true},audio:{noAudio:true}});

function el(tag, className, text) { const node=document.createElement(tag); if(className)node.className=className; if(text!==undefined)node.textContent=text; return node; }
function button(text, className, action) { const node=el('button',className,text); node.type='button';node.addEventListener('click',action); return node; }
function heading(kicker,title) { panel.append(el('p','eyebrow',kicker),el('h2','',title)); }
function setBackground(file) {
  currentBackground=file;
  scene?.changeBackground(file);
  $('#location').textContent=locations[file] || 'EM ALGUM LUGAR COM VOCÊ';
  const number=['cafe.svg','garden.svg','rooftop.svg'].indexOf(file)+1;
  $('.scene-index').textContent=`${String(number || 1).padStart(2,'0')} / 03   —   UM POUCO MAIS PERTO`;
}
function showNotes() {
  const content=$('#notes-content');content.replaceChildren();
  for(const line of transcript) {const p=el('p','log-line');p.append(el('strong','',`${line.speaker}  `),document.createTextNode(line.text));content.append(p);}
  if(!transcript.length)content.append(el('p','fine-print','Sua conversa aparecerá aqui ao longo da noite.'));
  $('#notes-dialog').showModal();
}
function renderCharacter() {
  panel.className='story-panel character-panel'; panel.replaceChildren();
  heading('ANTES DO PRIMEIRO OLÁ','Toda história começa com você.');
  panel.append(el('p','character-intro','Um nome para lembrar. Um pouco de coragem para começar.'));
  const form=el('form','character-form');
  const fields=el('div','character-fields');
  const nameLabel=el('label','','Seu nome');const name=el('input');name.name='name';name.required=true;name.maxLength=60;name.placeholder='Como Cecilia deve chamar você?';name.autocomplete='given-name'; nameLabel.append(name);
  const ageLabel=el('label','','Idade');const age=el('input');age.name='age';age.type='number';age.min='18';age.max='120';age.step='1';age.required=true;age.placeholder='18+';ageLabel.append(age);
  const sexLabel=el('label','','Sexo');const sex=el('select');sex.name='sex';sex.id='character-sex';sex.setAttribute('aria-label','Sexo');sex.required=true;
  for(const [value,label] of [['','Escolha…'],['female','Feminino'],['male','Masculino'],['other','Outro'],['prefer_not_to_say','Prefiro não informar']]){const option=el('option','',label);option.value=value;sex.append(option);}sexLabel.append(sex);
  fields.append(nameLabel,ageLabel,sexLabel);form.append(fields);
  const privacy=el('p','fine-print','Somente para maiores de 18 anos. Use informações fictícias: os dados do personagem e algumas escolhas são registrados.'+(email?' O email informado no link será associado às suas partidas e respostas registradas.':''));form.append(privacy);
  const error=el('p','form-error');error.setAttribute('role','alert');form.append(error);
  const submit=el('button','primary-button','Que a noite comece  ↗');submit.type='submit';form.append(submit);
  form.addEventListener('submit',event=>{
    event.preventDefault();if(!form.isConnected)return;const input=validateCharacter(Object.fromEntries(new FormData(form)));
    if(!input){error.textContent='Informe um nome, uma idade inteira entre 18 e 120 anos e escolha uma opção de sexo.';return;}
    character=input;saves.beginCharacter(input);saves.flush();console.log('Personagem criado:',input);advance();
  });panel.append(form);
  $('#progress-label').textContent='ANTES DE COMEÇAR';$('#progress-count').textContent='00';$('#progress-fill').style.width='0%';
}
function renderNode() {
  const node=story.nodes[index];selected=[];panel.replaceChildren();panel.className=`story-panel ${node.type==='question'?'question-panel':''}`;
  const seen=transcript.length;
  $('#progress-label').textContent=node.type==='end'?'LEMBRANÇAS DA NOITE':'SUA NOITE';
  $('#progress-count').textContent=String(seen+1).padStart(2,'0');
  $('#progress-fill').style.width=`${node.type==='end'?100:Math.min(92,(seen+1)/Math.max(1,story.nodes.filter(n=>['dialogue','question','end'].includes(n.type)).length)*100)}%`;
  if(node.type==='question') {
    heading('UM POUCO SOBRE VOCÊ',node.prompt);
    const help=el('p','choice-help',node.mode==='multiple'?`Escolha de ${node.min??1} a ${node.max??node.options.length} opções que combinam com você.`:'Escolha a resposta que mais combina com você.');help.id='choice-help';panel.append(help);
    const form=el('form','choice-form');const fieldset=el('fieldset','options');const legend=el('legend','sr-only',node.prompt);fieldset.append(legend);fieldset.setAttribute('aria-describedby','choice-help');
    const confirm=el('button','primary-button','Essa é minha resposta  ↗');confirm.type='submit';confirm.disabled=true;
    for(const [i,option] of node.options.entries()) {
      const label=el('label','option'); const input=el('input');input.type=node.mode==='multiple'?'checkbox':'radio';input.name='answer';input.value=option.id;
      const number=el('span','option-number',String(i+1).padStart(2,'0'));const text=el('span','option-text',option.text);const mark=el('span','option-mark');mark.setAttribute('aria-hidden','true');
      label.append(input,number,text,mark);fieldset.append(label);
      input.addEventListener('change',()=>{
        selected=toggleOption(node,selected,option.id);
        fieldset.querySelectorAll('input').forEach(control=>{control.checked=selected.includes(control.value);control.closest('label').classList.toggle('selected',control.checked);control.disabled=node.mode==='multiple'&&!control.checked&&selected.length>=(node.max??node.options.length);});
        confirm.disabled=!selectionValid(node,selected);
      });
    }
    form.append(fieldset,confirm);form.addEventListener('submit',event=>{event.preventDefault();if(!form.isConnected||!selectionValid(node,selected))return;
      const chosen=node.options.filter(o=>selected.includes(o.id));transcript.push({speaker:character.name,text:chosen.map(o=>o.text).join(' · ')});
      const answer={storyVersion:story.version,questionId:node.id,optionIds:[...selected]};saves.recordAnswer(answer);saves.flush();console.log('Resposta escolhida:',answer);advance(node.mode==='single'?chosen[0].goto:undefined);
    });panel.append(form);
  } else if(node.type==='end') {
    heading(node.outcome==='failure'?'ALGUNS CAMINHOS SE SEPARAM AQUI':node.outcome==='success'?'ALGO PARA ESPERAR COM CARINHO':'CONTINUA',node.outcome==='failure'?'Um outro tipo de final.':'Talvez este seja um começo.');
    panel.append(el('p','dialogue-text',node.text));
    const actions=el('div','ending-actions');actions.append(button('Encontrar de novo  ↗','primary-button',()=>$('#restart-dialog').showModal()),button('Reler nossa noite','text-button',showNotes));panel.append(actions);
    transcript.push({speaker:'A noite',text:node.text});
  } else {
    const speaker=['You','Você'].includes(node.speaker)?character.name:node.speaker==='Narrator'?'Narrador':node.speaker || 'A noite';
    const speakerRow=el('div','speaker-row');speakerRow.append(el('span','speaker-dot'),el('span','speaker-name',speaker),el('span','speaker-detail',speaker==='Cecilia'?'uma chance que vale a pena':''));panel.append(speakerRow);
    panel.append(el('p','dialogue-text',node.text));
    const bottom=el('div','dialogue-bottom');bottom.append(el('span','keyboard-hint','ESPAÇO OU ENTER PARA CONTINUAR'),button('Continuar  ↗','primary-button',()=>advance()));panel.append(bottom);
    transcript.push({speaker,text:node.text});
  }
}
function advance(target) {
  try {const next=nextPlayable(story.nodes,index,target);index=next.index;if(next.background)setBackground(next.background);renderNode();}
  catch(error){console.log('Erro na história:',error);panel.replaceChildren();heading('UMA PEQUENA PAUSA','Perdemos o fio da história.');panel.append(el('p','',error.message),button('Recomeçar','primary-button',()=>$('#restart-dialog').showModal()));}
}
async function loadStory() {
  panel.replaceChildren();
  try {
    const response=await fetch('/story.json',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Não foi possível carregar a história');
    story=await response.json();if(!Array.isArray(story.nodes)||!story.nodes.length)throw Error('Esta história está vazia');
    renderCharacter();
  } catch(error) {console.log('Erro ao carregar a história:',error);panel.replaceChildren();heading('UMA PEQUENA PAUSA','O café ainda não está pronto.');panel.append(el('p','','Tente novamente em instantes.'),button('Tentar de novo  ↗','primary-button',loadStory));}
}
$('#open-log').addEventListener('click',showNotes);$('#close-notes').addEventListener('click',()=>$('#notes-dialog').close());
$('#restart').addEventListener('click',()=>$('#restart-dialog').showModal());$('#cancel-restart').addEventListener('click',()=>$('#restart-dialog').close());
$('#confirm-restart').addEventListener('click',()=>{$('#restart-dialog').close();index=-1;character=undefined;saves.restart();transcript.length=0;setBackground('cafe.svg');loadStory();});
function motionLabel() {$('#motion-toggle').textContent=reducedMotion?'Animações desativadas':'Animações ativadas';$('#motion-toggle').setAttribute('aria-pressed',String(reducedMotion));scene?.motes?.setVisible(!reducedMotion);}
$('#motion-toggle').addEventListener('click',()=>{reducedMotion=!reducedMotion;motionLabel();});motionLabel();

window.addEventListener('keydown',event=>{
  if(event.repeat||![' ','Enter'].includes(event.key)||document.querySelector('dialog[open]')||!character||story?.nodes[index]?.type!=='dialogue')return;
  if(event.target.closest('button,input,select,textarea,a'))return;event.preventDefault();advance();
});
window.addEventListener('online',()=>saves.flush());
setInterval(()=>saves.flush(),15000);
saves.flush();loadStory();
