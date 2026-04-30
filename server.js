const express=require("express")
const cors=require("cors")
const path=require("path")

const app=express()
const PORT=process.env.PORT||3000

app.use(cors())
app.use(express.json({limit:"1mb"}))
app.use(express.static(path.join(__dirname,"public")))

const state={
logs:[],
memory:[],
status:{content:"idle",link:"idle",post:"idle",analytics:"active"},
stats:{pins:0,links:0,posts:0,clicks:0,aiCalls:0,aiProvider:"none"}
}

function log(agent,msg,level="info"){
state.logs.unshift({ts:new Date().toISOString(),agent,level,msg})
if(state.logs.length>60) state.logs.pop()
}

function setStatus(agent,val){
state.status[agent]=val
}

function rid(){return Math.random().toString(36).slice(2,9)}

async function fetchJson(url,opts={},ms=15000){
const c=new AbortController()
const t=setTimeout(()=>c.abort(),ms)
try{
const r=await fetch(url,{...opts,signal:c.signal})
const text=await r.text()
let data=null
try{data=JSON.parse(text)}catch{data={raw:text}}
if(!r.ok) throw new Error(`HTTP ${r.status} ${JSON.stringify(data).slice(0,200)}`)
return data
}finally{clearTimeout(t)}
}

function pickJsonFromText(s){
if(!s) return null
const m=s.match(/\{[\s\S]*\}/)
if(!m) return null
try{return JSON.parse(m[0])}catch{return null}
}

async function aiGroq(prompt){
if(!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing")
const data=await fetchJson("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{
"Authorization":`Bearer ${process.env.GROQ_API_KEY}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
model:"llama3-8b-8192",
temperature:0.7,
messages:[
{role:"system",content:"Return ONLY JSON: {\"title\":\"...\",\"description\":\"...\",\"category\":\"...\",\"hashtags\":[\"#a\"]}"},
{role:"user",content:prompt}
]
})
})
return data.choices?.[0]?.message?.content||""
}

async function aiOpenRouter(prompt){
if(!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing")
const data=await fetchJson("https://openrouter.ai/api/v1/chat/completions",{
method:"POST",
headers:{
"Authorization":`Bearer ${process.env.OPENROUTER_API_KEY}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
model:"mistralai/mistral-7b-instruct:free",
temperature:0.7,
messages:[
{role:"system",content:"Return ONLY JSON: {\"title\":\"...\",\"description\":\"...\",\"category\":\"...\",\"hashtags\":[\"#a\"]}"},
{role:"user",content:prompt}
]
})
})
return data.choices?.[0]?.message?.content||""
}

async function aiGemini(prompt){
if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing")
const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`
const data=await fetchJson(url,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
contents:[{parts:[{text:`Return ONLY JSON: {"title":"","description":"","category":"","hashtags":["#a"]}\n\n${prompt}` }]}]
})
})
return data.candidates?.[0]?.content?.parts?.[0]?.text||""
  }
async function aiContent(topic="pinterest pin idea"){
state.stats.aiCalls++
const prompt=`Generate Pinterest pin content about: ${topic}`
const providers=[
{n:"groq",fn:aiGroq},
{n:"openrouter",fn:aiOpenRouter},
{n:"gemini",fn:aiGemini}
]
for(const p of providers){
try{
const raw=await p.fn(prompt)
const obj=pickJsonFromText(raw)
if(obj?.title){
state.stats.aiProvider=p.n
log("AI",`Provider=${p.n} ok`,"success")
return obj
}
throw new Error("Bad JSON from model")
}catch(e){
log("AI",`Provider=${p.n} fail: ${String(e.message||e)}`,"error")
}
}
state.stats.aiProvider="mock"
return {title:`Pin ${rid()}`,description:"Mock description",category:"General",hashtags:["#mock","#pinterest"]}
}

app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")))

app.get("/api/generate",async(req,res)=>{
try{
setStatus("content","active")
const topic=req.query.topic||"home decor"
const data=await aiContent(topic)
state.stats.pins++
log("Content Agent",`Generated: ${data.title}`,"success")
state.memory.push({ts:Date.now(),type:"content",data})
res.json({success:true,provider:state.stats.aiProvider,data})
}catch(e){
log("Content Agent",`Error: ${String(e.message||e)}`,"error")
res.status(500).json({success:false,error:String(e.message||e)})
}finally{
setTimeout(()=>setStatus("content","idle"),700)
}
})

app.get("/api/link",(req,res)=>{
setStatus("link","active")
const clicks=Math.floor(Math.random()*30)
state.stats.links++
state.stats.clicks+=clicks
const data={id:rid(),short:`https://pin.link/${rid()}`,clicks}
log("Link Agent",`Created: ${data.short}`,"success")
state.memory.push({ts:Date.now(),type:"link",data})
setTimeout(()=>setStatus("link","idle"),500)
res.json({success:true,data})
})

app.get("/api/post",(req,res)=>{
setStatus("post","active")
state.stats.posts++
const data={id:rid(),status:"published",board:"Automation"}
log("Posting Agent","Simulated publish","success")
state.memory.push({ts:Date.now(),type:"post",data})
setTimeout(()=>setStatus("post","idle"),800)
res.json({success:true,data})
})

app.get("/api/stats",(req,res)=>res.json({success:true,data:state.stats}))
app.get("/api/logs",(req,res)=>res.json({success:true,data:state.logs.slice(0,40)}))
app.get("/api/status",(req,res)=>res.json({success:true,data:state.status}))

app.post("/api/webhook",async(req,res)=>{
const topic=req.body?.topic||"travel"
log("Webhook","Workflow start","info")
const content=await aiContent(topic)
state.stats.pins++
const route=(content.category||"").toLowerCase().includes("travel")?"travel":"default"
const link={id:rid(),short:`https://pin.link/${rid()}`,clicks:Math.floor(Math.random()*20)}
state.stats.links++; state.stats.clicks+=link.clicks
const post={id:rid(),status:"published",board:route==="travel"?"Travel":"General"}
state.stats.posts++
log("Router",`route=${route}`,"info")
res.json({success:true,route,content,link,post,provider:state.stats.aiProvider})
})

app.listen(PORT,()=>{
log("System","Server started","success")
console.log("Running on",PORT)
})
