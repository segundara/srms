const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")
dotenv.config()
const db = require("./db")
const studentRouter = require("./routes/students")
const listEndpoints = require("express-list-endpoints")

const server = express()
server.use(cors())
server.use(express.json())


server.use("/students", studentRouter)

console.log(listEndpoints(server))
server.listen(process.env.PORT || 3456, () => console.log("Running on ", process.env.PORT || 3456))