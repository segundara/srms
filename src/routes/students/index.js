const express = require("express")
const db = require("../../db")
const multer = require("multer")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { authenticateStudent, refreshTokenStudent } = require("./auth_students")
const { authorizeStudent } = require("../middlewares/authorize")

const { BlobServiceClient, StorageSharedKeyCredential, BlobLeaseClient } = require("@azure/storage-blob")
var MulterAzureStorage = require('multer-azure-storage')
const { cookie } = require("express-validator")

const credentials = new StorageSharedKeyCredential("srmscdn", process.env.STORAGE_KEY)
const blobClient = new BlobServiceClient("https://srmscdn.blob.core.windows.net/", credentials)

const studentRouter = express.Router();

studentRouter.get("/", authorizeStudent, async (req, res, next) => {
    try {
        const sort = req.query.sort
        const order = req.query.order
        const offset = req.query.offset || 0
        const limit = req.query.limit

        delete req.query.sort
        delete req.query.order
        delete req.query.offset
        delete req.query.limit

        let query = 'SELECT * FROM "students" ' //create query

        const params = []
        for (queryParam in req.query) { //for each value in query string, I'll filter
            params.push(req.query[queryParam])

            if (params.length === 1)
                query += `WHERE ${queryParam} = $${params.length} `
            else
                query += ` AND ${queryParam} = $${params.length} `
        }

        if (sort !== undefined)
            query += `ORDER BY ${sort} ${order}`  //adding the sorting 

        params.push(limit)
        query += ` LIMIT $${params.length} `
        params.push(offset)
        query += ` OFFSET $${params.length}`
        console.log(query)

        const response = await db.query(query, params)

        res.send({ count: response.rows.length, data: response.rows })

    } catch (error) {
        next(error)
    }
})

studentRouter.get("/me", authorizeStudent, async (req, res, next) => {
    try {
        res.send(req.user)
    } catch (error) {
        next("While reading users list a problem occurred!")
    }
})

// studentRouter.get("/:id", async (req, res) => {
//     const response = await db.query('SELECT _id, firstname, lastname, email, dateofbirth, nationality FROM "students" WHERE _id= $1',
//         [req.params.id])

//     if (response.rowCount === 0)
//         return res.status(404).send("Not found")

//     res.send(response.rows[0])
// })

studentRouter.post("/register", async (req, res, next) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)

        const response = await db.query(`INSERT INTO "students" (firstname, lastname, email, dateofbirth, nationality, departmentid, password) 
    Values ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
            [req.body.firstname, req.body.lastname, req.body.email, req.body.dateofbirth, req.body.nationality, req.body.departmentid, hashedPassword])

        console.log(response)
        res.status(201).send(response.rows[0])
    } catch (error) {
        next(error)
    }
})

// EXTRA) Using multer middleware to upload image
const getFileName = (file) => file.originalname

const multerOptions = multer({
    storage: new MulterAzureStorage({
        azureStorageConnectionString: process.env.STORAGE_CS,
        containerName: 'images',
        containerSecurity: 'container',
        fileName: getFileName
    })
})

studentRouter.post("/upload/me", authorizeStudent, multerOptions.single("imageFile"), async (req, res, next) => {
    try {
        let params = []
        let query = `UPDATE "students" SET image = '${req.file.url}'`

        params.push(req.user._id)
        query += " WHERE _id = $" + (params.length) + " RETURNING *"
        console.log(query)

        const result = await db.query(query, params)

        if (result.rowCount === 0)
            return res.status(404).send("Not Found")

        res.send(result.rows[0])
    }
    catch (error) {
        next(error)
    }
})

studentRouter.put("/me", authorizeStudent, async (req, res, next) => {
    try {
        let params = []
        let query = 'UPDATE "students" SET '
        for (bodyParamName in req.body) {
            query += // for each element in the body I'll add something like parameterName = $Position
                (params.length > 0 ? ", " : '') + //I'll add a coma before the parameterName for every parameter but the first
                bodyParamName + " = $" + (params.length + 1) // += Category = $1 

            params.push(req.body[bodyParamName]) //save the current body parameter into the params array
        }

        params.push(req.user._id) //push the id into the array
        query += " WHERE _id = $" + (params.length) + " RETURNING *" //adding filtering for id + returning
        console.log(query)

        const result = await db.query(query, params) //querying the DB for updating the row


        if (result.rowCount === 0) //if no element match the specified id => 404
            return res.status(404).send("Not Found")

        res.send(result.rows[0]) //else, return the updated version
    }
    catch (error) {
        next(error)
    }
})

studentRouter.delete("/me", authorizeStudent, async (req, res, next) => {
    try {
        const response = await db.query(`DELETE FROM "students" WHERE _id = $1`, [req.user._id])

        if (response.rowCount === 0)
            return res.status(404).send("Not Found")

        res.send("Record deleted!")

    } catch (error) {
        next(error)
    }
})

studentRouter.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body

        const getUser = await db.query('SELECT * FROM "students" WHERE email= $1',
            [email])

        const isMatch = await bcrypt.compare(password, getUser.rows[0].password)
        if (!isMatch) {
            const err = new Error("Unable to login")
            err.httpStatusCode = 401
            throw err
        }

        const user = getUser.rows[0]

        const tokens = await authenticateStudent(user)

        res.cookie("accessToken", tokens.accessToken, {
            httpOnly: true,
        })
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            path: "/students/refreshToken",
        })
        // res.send(tokens)
        res.send("cookies sent!")

        // const accessToken = await generateAccessToken(user)
        // const refreshToken = jwt.sign(user, process.env.REFRESH_SECRET)

        // let params = []
        // let query = `UPDATE "students" SET token = '${refreshToken}'`

        // params.push(email)
        // query += " WHERE email = $" + (params.length) + " RETURNING *"
        // console.log(query)

        // const result = await db.query(query, params)

        // res.json({ accessToken: accessToken, refreshToken: refreshToken })

    } catch (error) {
        next(error)
    }
})

// function generateAccessToken(user) {
//     return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '15s' })
// }

studentRouter.post("/logout", authorizeStudent, async (req, res, next) => {
    try {
        let params = []
        let query = `UPDATE "students" SET token = null`

        params.push(req.user._id)
        query += " WHERE _id = $" + (params.length) + " RETURNING *"
        console.log(query)

        const result = await db.query(query, params)

        if (result.rowCount === 0)
            return res.status(404).send("Not Found")

        // res.send(result.rows[0])
        res.send("logout successful!")

    } catch (error) {
        next(error)
    }
})

studentRouter.post("/refreshToken", async (req, res, next) => {
    const oldRefreshToken = req.cookies.refreshToken
    console.log(oldRefreshToken)
    if (!oldRefreshToken) {
        const err = new Error("Forbidden")
        err.httpStatusCode = 403
        next(err)
    } else {
        try {
            const newTokens = await refreshTokenStudent(oldRefreshToken)
            res.cookie("accessToken", newTokens.accessToken, {
                httpOnly: true,
            })
            res.cookie("refreshToken", newTokens.refreshToken, {
                httpOnly: true,
                path: "/students/refreshToken",
            })
            // res.send(newTokens)
            res.send("newTokens sent!")
        } catch (error) {
            console.log(error)
            const err = new Error(error)
            err.httpStatusCode = 403
            next(err)
        }
    }
})

module.exports = studentRouter