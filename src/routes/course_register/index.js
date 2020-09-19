const express = require("express")
const db = require("../../db")

const registerRouter = express.Router()

registerRouter.post("/", async (req, res) => {
    const response = await db.query("INSERT INTO course_register (studentid, courseid, reg_date) VALUES ($1, $2, $3) RETURNING _id",
        [req.body.studentid, req.body.courseid, req.body.reg_date])

    res.send(response.rows[0])
})

registerRouter.get("/:studentid", async (req, res) => {
    const response = await db.query(`SELECT courses._id, courses.name, courses.description, courses.semester, course_register.reg_date
                                     FROM course_register JOIN "courses" ON course_register.courseid = "courses"._id
                                     WHERE studentid = $1
                                     GROUP BY courses._id, courses.name, courses.description, courses.semester, course_register.reg_date
                                     `, [req.params.studentid])

    res.send({ count: response.rows.length, data: response.rows })
})

registerRouter.delete("/:studentid/:id", async (req, res) => {

    const response = await db.query(`DELETE FROM course_register where _id IN
                                     (SELECT _id FROM course_register 
                                      WHERE courseid = $1 AND studentid = $2
                                      LIMIT 1)`,
        [req.params.id, req.params.studentid])

    if (response.rowCount === 0)
        return res.status(404).send("Not found")

    res.send("DELETED")
})


module.exports = registerRouter;