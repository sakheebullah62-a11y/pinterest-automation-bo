require("dotenv").config()
const express=require("express")
const cors=require("cors")

const app=express()
const PORT=process.env.PORT||3000

app.use(cors())
app.use(express.json())

let logs=[]
let stats={
pinsCreated:0,
linksGenerated:0,
postsDone:0,
clicks:0
}

let status={
contentAgent:"idle",
linkAgent:"idle",
postingAgent:"idle",
analyticsAgent:"active"
}

function addLog(agent,action){
logs.unshift({time:new Date(),agent,action})
if(logs.length>50){logs.pop()}
}

function randomId(){
return Math.random().toString(36).substring(2,9)
}

app.get("/api/generate",(req,res)=>{
status.contentAgent="active"
stats.pinsCreated++
addLog("Content","Generated")
setTimeout(()=>{status.contentAgent="idle"},2000)
res.json({title:"Idea "+randomId()})
})

app.get("/api/link",(req,res)=>{
status.linkAgent="active"
stats.linksGenerated++
addLog("Link","Created")
setTimeout(()=>{status.linkAgent="idle"},2000)
res.json({link:"https://pin.link/"+randomId()})
})

app.get("/api/post",(req,res)=>{
status.postingAgent="active"
stats.postsDone++
addLog("Post","Posted")
setTimeout(()=>{status.postingAgent="idle"},2000)
res.json({status:"Posted"})
})

app.get("/api/stats",(req,res)=>{
res.json(stats)
})

app.get("/api/logs",(req,res)=>{
res.json(logs)
})

app.listen(PORT,()=>{
console.log("Running")
})