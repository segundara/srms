const express = require("express")
const db = require("../../db")
const multer = require("multer")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { authorize, onlyForAdmin } = require("../middlewares/authorize")

const { BlobServiceClient, StorageSharedKeyCredential, BlobLeaseClient } = require("@azure/storage-blob")
var MulterAzureStorage = require('multer-azure-storage')

const credentials = new StorageSharedKeyCredential("srmscdn", process.env.STORAGE_KEY)
const blobClient = new BlobServiceClient("https://srmscdn.blob.core.windows.net/", credentials)

const lecturerRouter = express.Router();


lecturerRouter.get("/", authorize, async (req, res, next) => {
    try {
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

    } catch (error) {
        next(error)
    }
})

lecturerRouter.get("/me", authorize, async (req, res, next) => {
    try {
        const getMe = await db.query('SELECT * FROM "lecturers" WHERE email= $1',
            [req.user.email])
        res.send(getMe.rows[0])
    } catch (error) {
        next("While reading users list a problem occurred!")
    }
})

lecturerRouter.post("/register", authorize, onlyForAdmin, async (req, res, next) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)

        const newLecturer = await db.query(`INSERT INTO "lecturers" (firstname, lastname, email, departmentid) 
    Values ($1, $2, $3, $4)
    RETURNING *`,
            [req.body.firstname, req.body.lastname, req.body.email, req.body.departmentid])

        const newUser = await db.query(`INSERT INTO "users" (email, password, title) 
            Values ($1, $2, $3)
            RETURNING *`,
            [req.body.email, hashedPassword, req.body.title])

        console.log(newLecturer)
        res.send(newLecturer.rows[0])
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

lecturerRouter.post("/upload/me", authorize, multerOptions.single("imageFile"), async (req, res, next) => {
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
    catch (error) {
        next(error)
    }
})

lecturerRouter.put("/me", authorize, async (req, res, next) => {
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
    catch (error) {
        next(error)
    }
})

lecturerRouter.delete("/me", authorize, async (req, res, next) => {
    try {
        const response = await db.query(`DELETE FROM "lecturers" WHERE _id = $1`, [req.user._id])

        if (response.rowCount === 0)
            return res.status(404).send("Not Found")

        res.send("Record deleted!")

    } catch (error) {
        next(error)
    }
})


module.exports = lecturerRouter