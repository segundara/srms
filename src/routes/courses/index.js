const express = require("express")
const db = require("../../db")
const { authorize, onlyForAdmin } = require("../middlewares/authorize")

const courseRouter = express.Router();


courseRouter.get("/", authorize, async (req, res) => {

    const sort = req.query.sort
    const order = req.query.order
    const offset = req.query.offset || 0
    const limit = req.query.limit

    delete req.query.sort
    delete req.query.order
    delete req.query.offset
    delete req.query.limit

    let query = 'SELECT * FROM "courses" ' //create query

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

courseRouter.get("/:id", authorize, async (req, res) => {
    const response = await db.query('SELECT * FROM "courses" WHERE _id= $1',
        [req.params.id])

    if (response.rowCount === 0)
        return res.status(404).send("Not found")

    res.send(response.rows[0])
})

//Admin to add course info
courseRouter.post("/", authorize, onlyForAdmin, async (req, res) => {
    const response = await db.query(`INSERT INTO "courses" (name, description, semester, lecturerid, examdate) 
                                     Values ($1, $2, $3, $4, $5)
                                     RETURNING *`,
        [req.body.name, req.body.description, req.body.semester, req.body.lecturerid, req.body.examdate])



    console.log(response)
    res.send(response.rows[0])
})

courseRouter.put("/:id", authorize, onlyForAdmin, async (req, res) => {
    try {
        let params = []
        let query = 'UPDATE "courses" SET '
        for (bodyParamName in req.body) {
            query += // for each element in the body I'll add something like parameterName = $Position
                (params.length > 0 ? ", " : '') + //I'll add a coma before the parameterName for every parameter but the first
                bodyParamName + " = $" + (params.length + 1) // += Category = $1 

            params.push(req.body[bodyParamName]) //save the current body parameter into the params array
        }

        params.push(req.params.id) //push the id into the array
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

courseRouter.delete("/:id", authorize, onlyForAdmin, async (req, res) => {
    const response = await db.query(`DELETE FROM "courses" WHERE _id = $1`, [req.params.id])

    if (response.rowCount === 0)
        return res.status(404).send("Not Found")

    res.send("Record deleted!")
})

module.exports = courseRouter