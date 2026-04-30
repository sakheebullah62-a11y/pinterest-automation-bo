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
stats:{
pins:0,
links:0,
posts:0,
clicks:0,
aiCalls:0,
provider:"none"
}
}

function log(agent,message){
state.logs.unshift({
time:new Date().toISOString(),
agent,
message
})
if(state.logs.length>50){
state.logs.pop()
}
}

function id(){
return Math.random().toString(36).substring(2,8)
}

async function callGroq(prompt){
if(!process.env.GROQ_API_KEY) throw new Error("No GROQ Key")

const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{
"Authorization":"Bearer "+process.env.GROQ_API_KEY,
"Content-Type":"application/json"
},
body:JSON.stringify({
model:"llama3-8b-8192",
messages:[
{role:"system",content:"Return only JSON"},
{role:"user",content:prompt}
]
})
})

const data=await res.json()
return data.choices?.[0]?.message?.content||""
}

async function callOpenRouter(prompt){
if(!process.env.OPENROUTER_API_KEY) throw new Error("No OpenRouter Key")

const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{
method:"POST",
headers:{
"Authorization":"Bearer "+process.env.OPENROUTER_API_KEY,
"Content-Type":"application/json"
},
body:JSON.stringify({
model:"mistralai/mistral-7b-instruct:free",
messages:[
{role:"system",content:"Return only JSON"},
{role:"user",content:prompt}
]
})
})

const data=await res.json()
return data.choices?.[0]?.message?.content||""
}

async function generateAI(topic){

state.stats.aiCalls++

const prompt=`Generate Pinterest content about ${topic}`

try{
const r=await callGroq(prompt)
state.stats.provider="groq"
return r
}catch(e){

try{
const r=await callOpenRouter(prompt)
state.stats.provider="openrouter"
return r
}catch(e){

state.stats.provider="mock"
return JSON.stringify({
title:"Pin "+id(),
description:"Mock content",
category:"General"
})

}

}

}

app.get("/",(req,res)=>{
res.sendFile(path.join(__dirname,"public","index.html"))
})

app.get("/api/generate",async(req,res)=>{
const topic=req.query.topic||"ideas"
const content=await generateAI(topic)
state.stats.pins++
log("AI","Generated content")
res.json({
provider:state.stats.provider,
content
})
})

app.get("/api/stats",(req,res)=>{
res.json(state.stats)
})

app.get("/api/logs",(req,res)=>{
res.json(state.logs)
})

app.listen(PORT,()=>{
console.log("Server running on "+PORT)
})
