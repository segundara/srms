const express = require("express")
const db = require("../../db")
const multer = require("multer")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { authenticateLecturer, refreshTokenLecturer } = require("./auth_Lecturers")
const { authorizeLecturer } = require("../middlewares/authorize")

const { BlobServiceClient, StorageSharedKeyCredential, BlobLeaseClient } = require("@azure/storage-blob")
var MulterAzureStorage = require('multer-azure-storage')
const auth_lecturers = require("./auth_Lecturers")

const credentials = new StorageSharedKeyCredential("srmscdn", process.env.STORAGE_KEY)
const blobClient = new BlobServiceClient("https://srmscdn.blob.core.windows.net/", credentials)

const lecturerRouter = express.Router();


lecturerRouter.get("/", authorizeLecturer, async (req, res) => {

    const sort = req.query.sort
    const order = req.query.order
    const offset = req.query.offset || 0
    const limit = req.query.limit

    delete req.query.sort
    delete req.query.order
    delete req.query.offset
    delete req.query.limit

    let query = 'SELECT * FROM "lecturers" ' //create query

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
})

lecturerRouter.get("/me", authorizeLecturer, async (req, res) => {
    try {
        res.send(req.user)
    } catch (error) {
        next("While reading users list a problem occurred!")
    }
})

lecturerRouter.post("/register", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)

        const response = await db.query(`INSERT INTO "lecturers" (firstname, lastname, email, departmentid,password) 
    Values ($1, $2, $3, $4,$5)
    RETURNING *`,
            [req.body.firstname, req.body.lastname, req.body.email, req.body.departmentid, hashedPassword])

        console.log(response)
        res.send(response.rows[0])
    } catch (error) {

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

lecturerRouter.post("/upload/me", authorizeLecturer, multerOptions.single("imageFile"), async (req, res) => {
    try {
        let params = []
        let query = `UPDATE "lecturers" SET image = '${req.file.url}'`

        params.push(req.user._id)
        query += " WHERE _id = $" + (params.length) + " RETURNING *"
        console.log(query)

        const result = await db.query(query, params)

        if (result.rowCount === 0)
            return res.status(404).send("Not Found")

        res.send(result.rows[0])
    }
    catch (ex) {
        console.log(ex)
        res.status(500).send(ex)
    }
})

lecturerRouter.put("/me", authorizeLecturer, async (req, res) => {
    try {
        let params = []
        let query = 'UPDATE "lecturers" SET '
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
    catch (ex) {
        console.log(ex)
        res.status(500).send(ex)
    }
})

lecturerRouter.delete("/me", authorizeLecturer, async (req, res) => {
    const response = await db.query(`DELETE FROM "lecturers" WHERE _id = $1`, [req.user._id])

    if (response.rowCount === 0)
        return res.status(404).send("Not Found")

    res.send("Record deleted!")
})

lecturerRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body

        const getUser = await db.query('SELECT * FROM "lecturers" WHERE email= $1',
            [email])

        const isMatch = await bcrypt.compare(password, getUser.rows[0].password)
        if (!isMatch) {
            const err = new Error("Unable to login")
            err.httpStatusCode = 401
            throw err
        }

        const user = getUser.rows[0]

        const tokens = await authenticateLecturer(user)
        res.send(tokens)

    } catch (error) {
        console.log(error)
    }
})

lecturerRouter.post("/logout", authorizeLecturer, async (req, res, next) => {
    try {
        let params = []
        let query = `UPDATE "lecturers" SET token = ''`

        params.push(req.user._id)
        query += " WHERE _id = $" + (params.length) + " RETURNING *"
        console.log(query)

        const result = await db.query(query, params)

        if (result.rowCount === 0)
            return res.status(404).send("Not Found")

        res.send("logout successful!")

    } catch (err) {
        next(err)
    }
})

lecturerRouter.post("/refreshToken", async (req, res, next) => {
    const oldRefreshToken = req.body.refreshToken
    if (!oldRefreshToken) {
        const err = new Error("Forbidden")
        err.httpStatusCode = 403
        next(err)
    } else {
        try {
            const newTokens = await refreshTokenLecturer(oldRefreshToken)
            res.send(newTokens)
        } catch (error) {
            console.log(error)
            const err = new Error(error)
            err.httpStatusCode = 403
            next(err)
        }
    }
})

module.exports = lecturerRouter