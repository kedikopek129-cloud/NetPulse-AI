const $ = (s) => document.querySelector(s);
const els = {
  prompt: $("#prompt"), send: $("#sendBtn"), select: $("#modelSelect"),
  messages: $("#messages"), welcome: $("#welcome"), history: $("#history"),
  status: $("#modelStatus"), toast: $("#toast"), sidebar: $("#sidebar")
};
const STORAGE_KEY = "netpulse_guest_chats_v1";
let chats = loadChats();
let activeChatId = chats[0]?.id || null;
let busy = false;

function loadChats(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
function saveChats(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0,40))); }
function id(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function toast(message){ els.toast.textContent=message; els.toast.classList.add("show"); setTimeout(()=>els.toast.classList.remove("show"),2600); }
function activeChat(){ return chats.find(c=>c.id===activeChatId); }
function createChat(){ const c={id:id(),title:"New chat",messages:[],createdAt:Date.now()}; chats.unshift(c); activeChatId=c.id; saveChats(); render(); els.prompt.focus(); }
function renderHistory(){
  els.history.innerHTML="";
  chats.forEach(c=>{ const b=document.createElement("button"); b.className="history-item"+(c.id===activeChatId?" active":""); b.textContent=c.title; b.title=c.title; b.onclick=()=>{activeChatId=c.id;render();els.sidebar.classList.remove("open");}; els.history.append(b); });
}
function renderMessages(){
  const c=activeChat(); els.messages.innerHTML="";
  els.welcome.hidden=!!(c && c.messages.length);
  if(!c) return;
  for(const m of c.messages){
    const row=document.createElement("div"); row.className="message "+m.role;
    const avatar=document.createElement("div"); avatar.className="avatar"; avatar.textContent=m.role==="user"?"Y":"✦";
    const body=document.createElement("div"); body.className="bubble";
    if(m.role==="assistant"){ const meta=document.createElement("div"); meta.className="message-meta"; meta.textContent=m.modelLabel||"NetPulse AI"; body.append(meta); }
    const content=document.createElement("div"); content.textContent=m.content; body.append(content);
    row.append(avatar,body); els.messages.append(row);
  }
  window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"});
}
function render(){renderHistory();renderMessages();}
async function loadModels(){
  try{
    const r=await fetch("/api/models"); const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Modeller yüklenemedi");
    els.select.innerHTML="";
    for(const group of data.groups||[]){
      const og=document.createElement("optgroup"); og.label=group.label;
      for(const model of group.models){const o=document.createElement("option");o.value=model.id;o.textContent=model.name;og.append(o);}
      if(og.children.length)els.select.append(og);
    }
    if(!els.select.options.length)throw new Error("Henüz model yapılandırılmamış");
    els.status.textContent=`${data.count} model`;
  }catch(e){els.status.textContent="Provider setup required";toast(e.message);}
}
function setBusy(v){busy=v;els.send.disabled=v;els.send.querySelector("span").textContent=v?"Thinking":"Send";}
async function sendMessage(text){
  const prompt=text.trim(); if(!prompt||busy)return;
  if(!els.select.value){toast("No model provider is configured yet.");return;}
  if(!activeChatId)createChat();
  const c=activeChat(); c.messages.push({role:"user",content:prompt});
  if(c.title==="New chat")c.title=prompt.slice(0,38)+(prompt.length>38?"…":"");
  saveChats();render();els.prompt.value="";els.prompt.style.height="auto";setBusy(true);
  const assistant={role:"assistant",content:"",modelLabel:els.select.selectedOptions[0]?.textContent||"AI"};c.messages.push(assistant);render();
  try{
    const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:els.select.value,messages:c.messages.filter(m=>m.role==="user"||m.role==="assistant").slice(0,-1).map(m=>({role:m.role,content:m.content}))})});
    if(!response.ok){let d={};try{d=await response.json()}catch{}throw new Error(d.error||`Sunucu hatası (${response.status})`);}
    if(!response.body)throw new Error("Your browser does not support streaming responses.");
    const reader=response.body.getReader();const decoder=new TextDecoder();let buffer="";
    while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const parts=buffer.split("\n");buffer=parts.pop()||"";for(const line of parts){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(raw==="[DONE]")continue;try{const event=JSON.parse(raw);if(event.error)throw new Error(event.error);if(event.text){assistant.content+=event.text;renderMessages();}}catch(err){if(err instanceof SyntaxError)continue;throw err;}}}
    if(!assistant.content)assistant.content="The model returned an empty response.";
  }catch(e){assistant.content=assistant.content?assistant.content+`\n\n[Bağlantı kesildi: ${e.message}]`:`İstek tamamlanamadı: ${e.message}`;toast(e.message);}
  finally{saveChats();render();setBusy(false);}
}
els.send.addEventListener("click",()=>sendMessage(els.prompt.value));
els.prompt.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(els.prompt.value);}});
els.prompt.addEventListener("input",()=>{els.prompt.style.height="auto";els.prompt.style.height=Math.min(els.prompt.scrollHeight,180)+"px";});
$("#newChat").addEventListener("click",createChat);
$("#clearAll").addEventListener("click",()=>{if(!chats.length)return;if(confirm("Delete all chats stored in this browser?")){chats=[];activeChatId=null;saveChats();render();toast("Chat history deleted.");}});
$("#menuBtn").addEventListener("click",()=>els.sidebar.classList.toggle("open"));
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{els.prompt.value=b.dataset.prompt;sendMessage(b.dataset.prompt);}));
render();loadModels();