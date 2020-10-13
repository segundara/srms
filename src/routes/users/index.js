const express = require("express")
const db = require("../../db")
const bcrypt = require("bcrypt")
const { authenticate, refreshToken } = require("./auth_users")
const { authorize } = require("../middlewares/authorize")

const userRouter = express.Router();


userRouter.get("/", authorize, async (req, res, next) => {
    try {
        const sort = req.query.sort
        const order = req.query.order
        const offset = req.query.offset || 0
        const limit = req.query.limit

        delete req.query.sort
        delete req.query.order
        delete req.query.offset
        delete req.query.limit

        let query = 'SELECT * FROM "users" ' //create query

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

userRouter.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body

        const getUser = await db.query('SELECT * FROM "users" WHERE email= $1',
            [email])

        const isMatch = await bcrypt.compare(password, getUser.rows[0].password)
        if (!isMatch) {
            const err = new Error("Unable to login")
            err.httpStatusCode = 401
            throw err
        }

        const user = getUser.rows[0]

        const tokens = await authenticate(user)
        res.cookie("accessToken", tokens.accessToken, {
            // httpOnly: true,
        })
        res.cookie("refreshToken", tokens.refreshToken, {
            // httpOnly: true,
            path: "/users/refreshToken",
        })
        // res.send(tokens)
        res.send(user.title)

    } catch (error) {
        next(error)
    }
})

userRouter.post("/logout", authorize, async (req, res, next) => {
    try {
        let params = []
        let query = `UPDATE "users" SET refresh_token = null`

        params.push(req.user._id)
        query += " WHERE _id = $" + (params.length) + " RETURNING *"
        console.log(query)

        const result = await db.query(query, params)

        if (result.rowCount === 0)
            return res.status(404).send("Not Found")

        // res.clearCookie("accessToken");
        // res.clearCookie("refreshToken");

        res.send("logout successful!")

    } catch (err) {
        next(err)
    }
})

userRouter.post("/refreshToken", async (req, res, next) => {
    const oldRefreshToken = req.cookies.refreshToken
    if (!oldRefreshToken) {
        const err = new Error("Forbidden")
        err.httpStatusCode = 403
        next(err)
    } else {
        try {
            const newTokens = await refreshToken(oldRefreshToken)
            res.cookie("accessToken", newTokens.accessToken, {
                httpOnly: true,
            })
            res.cookie("refreshToken", newTokens.refreshToken, {
                httpOnly: true,
                path: "/users/refreshToken",
            })
            res.send("newTokens sent!")
        } catch (error) {
            console.log(error)
            const err = new Error(error)
            err.httpStatusCode = 403
            next(err)
        }
    }
})

module.exports = userRouter