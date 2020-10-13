const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")
dotenv.config()
const db = require("./db")
const studentRouter = require("./routes/students")
const departmentRouter = require("./routes/departments")
const courseRouter = require("./routes/courses")
const lecturerRouter = require("./routes/lecturers")
const registerRouter = require("./routes/course_register")
const examRouter = require("./routes/exams")
const adminRouter = require("./routes/admin")
const userRouter = require("./routes/users")
const listEndpoints = require("express-list-endpoints")
const cookieParser = require("cookie-parser")

const {
    notFoundHandler,
    forbiddenHandler,
    badRequestHandler,
    genericErrorHandler,
} = require("./errorHandlers")

const server = express()

const whitelist = ["http://localhost:3000"]
const corsOptions = {
    origin: (origin, callback) => {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true)
        } else {
            callback(new Error("Not allowed by CORS"))
        }
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
}

server.use(cors(corsOptions))
server.use(express.json())
server.use(cookieParser())


server.use("/student", studentRouter)
server.use("/departments", departmentRouter)
server.use("/courses", courseRouter)
server.use("/tutor", lecturerRouter)
server.use("/register", registerRouter)
server.use("/exams", examRouter)
server.use("/admin", adminRouter)
server.use("/users", userRouter)

// ERROR HANDLERS MIDDLEWARES

server.use(badRequestHandler)
server.use(forbiddenHandler)
server.use(notFoundHandler)
server.use(genericErrorHandler)

console.log(listEndpoints(server))
server.listen(process.env.PORT || 3456, () => console.log("Running on ", process.env.PORT || 3456))