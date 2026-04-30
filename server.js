const express=require("express")
const cors=require("cors")
const path=require("path")

const app=express()
const PORT=process.env.PORT||3000

app.use(cors())
app.use(express.json())

app.use(express.static(path.join(__dirname,"public")))

app.get("/",(req,res)=>{
res.sendFile(path.join(__dirname,"public","index.html"))
})

let stats={
pins:0,
links:0,
posts:0,
clicks:0
}

function id(){
return Math.random().toString(36).substring(2,8)
}

app.get("/api/generate",(req,res)=>{
stats.pins++
res.json({title:"Pin "+id()})
})

app.get("/api/link",(req,res)=>{
stats.links++
res.json({link:"https://pin.link/"+id()})
})

app.get("/api/post",(req,res)=>{
stats.posts++
res.json({status:"Posted"})
})

app.get("/api/stats",(req,res)=>{
res.json(stats)
})

app.listen(PORT,()=>{
console.log("Running on "+PORT)
})
