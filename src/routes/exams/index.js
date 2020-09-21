const express = require("express")
const db = require("../../db")

const examRouter = express.Router()

examRouter.post("/", async (req, res) => {
    const response = await db.query("INSERT INTO exams (studentid, courseid, examdate) VALUES ($1, $2, $3) RETURNING _id",
        [req.body.studentid, req.body.courseid, req.body.examdate])

    res.send(response.rows[0])
})

examRouter.get("/:studentid", async (req, res) => {
    const response = await db.query(`SELECT courses._id, courses.name, courses.description, courses.semester, exams.examdate, exams.grade
                                     FROM exams JOIN "courses" ON exams.courseid = "courses"._id
                                     WHERE studentid = $1
                                     GROUP BY courses._id, courses.name, courses.description, courses.semester, exams.examdate, exams.grade
                                     `, [req.params.studentid])
    console.log(response.rows)
    res.send({ count: response.rows.length, data: response.rows })
})

examRouter.put("/:studentid/:id", async (req, res) => {
    try {
        let params = []
        let query = 'UPDATE "exams" SET '
        for (bodyParamName in req.body) {
            query += // for each element in the body I'll add something like parameterName = $Position
                (params.length > 0 ? ", " : '') + //I'll add a coma before the parameterName for every parameter but the first
                bodyParamName + " = $" + (params.length + 1) // += Category = $1 

            params.push(req.body[bodyParamName]) //save the current body parameter into the params array
        }

        params.push(req.params.id) //push the id into the array
        params.push(req.params.studentid)
        query += " WHERE _id = $" + (params.length - 1) + " AND studentid = $" + (params.length) + " RETURNING *" //adding filtering for id + returning
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

examRouter.delete("/:studentid/:id", async (req, res) => {

    const response = await db.query(`DELETE FROM exams where _id IN
                                     (SELECT _id FROM exams 
                                      WHERE courseid = $1 AND studentid = $2
                                      LIMIT 1)`,
        [req.params.id, req.params.studentid])

    if (response.rowCount === 0)
        return res.status(404).send("Not found")

    res.send("DELETED")
})


module.exports = examRouter;