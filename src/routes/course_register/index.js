const express = require("express")
const db = require("../../db")
const sgMail = require("@sendgrid/mail")
const { authorize, forAllButStudent, onlyForAdmin } = require("../middlewares/authorize")

const registerRouter = express.Router()

// endpoint for course registration, needed by student
registerRouter.post("/", authorize, async (req, res) => {
    const checkRegister = await db.query(`SELECT _id FROM course_register 
                                      WHERE courseid = $1 AND studentid = $2`,
        [req.body.courseid, req.body.studentid])

    if (checkRegister.rowCount > 0)
        return res.status(400).send("You have already registered for this course!")

    const newCourseReg = await db.query("INSERT INTO course_register (studentid, courseid, reg_date) VALUES ($1, $2, $3) RETURNING _id",
        [req.body.studentid, req.body.courseid, req.body.reg_date])

    const newExamReg = await db.query("INSERT INTO exams (studentid, courseid, examdate) VALUES ($1, $2, $3) RETURNING _id",
        [req.body.studentid, req.body.courseid, req.body.examdate])

    const record = await db.query(`SELECT courses._id, courses.name, courses.description, courses.semester, course_register.reg_date
        FROM course_register JOIN "courses" ON course_register.courseid = "courses"._id
        WHERE course_register.studentid = $1
        GROUP BY courses._id, courses.name, courses.description, courses.semester, course_register.reg_date
        `, [req.body.studentid])

    // const studentInfo = await db.query(`SELECT students._id, students.firstname, students.lastname, students.email
    //     FROM course_register JOIN "students" ON course_register.studentid = "students"._id
    //     WHERE studentid = $1
    //     GROUP BY students._id, students.firstname, students.lastname, students.email
    //     `, [req.body.studentid])

    // const registerUpdate = await db.query(`SELECT * FROM course_register 
    //                                   WHERE studentid = $1`,
    //     [req.body.studentid])

    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // const msg = {
    //     to: studentInfo.rows[0].email,
    //     from: 'srms@school.com',
    //     subject: 'Course Registration Successful',
    //     text: `Hello ${studentInfo.rows[0].firstname} ${studentInfo.rows[0].lastname}, 
    //             \nYour registration for ${record.rows[0].name} which is scheduled for ${record.rows[0].semester} semester has been saved.`
    // };
    // await sgMail.send(msg);

    res.send(record.rows)
})

// endpoint for viewing registered course list, needed by student
registerRouter.get("/course_list/:studentid", authorize, async (req, res) => {
    const response = await db.query(`SELECT courses._id, courses.name, courses.description, courses.semester, course_register.reg_date
                                     FROM course_register JOIN "courses" ON course_register.courseid = "courses"._id
                                     WHERE studentid = $1
                                     GROUP BY courses._id, courses.name, courses.description, courses.semester, course_register.reg_date
                                     `, [req.params.studentid])
    console.log(response.rows)
    res.send({ count: response.rows.length, data: response.rows })
})

// endpoint for viewing students list in a particular course, needed by lecturer
registerRouter.get("/student_list/:courseid", authorize, forAllButStudent, async (req, res) => {
    const response = await db.query(`SELECT students._id, students.firstname, students.lastname, students.email, course_register.reg_date
                                     FROM course_register JOIN "students" ON course_register.studentid = "students"._id
                                     WHERE courseid = $1
                                     GROUP BY students._id, students.firstname, students.lastname, students.email, course_register.reg_date
                                     `, [req.params.courseid])
    console.log(response.rows)
    res.send({ count: response.rows.length, data: response.rows })
})

// endpoint for removing a course from registered list, needed by student
registerRouter.delete("/:studentid/:courseid", authorize, async (req, res) => {

    const response = await db.query(`DELETE FROM course_register where _id IN
                                     (SELECT _id FROM course_register 
                                      WHERE courseid = $1 AND studentid = $2
                                      LIMIT 1)`,
        [req.params.courseid, req.params.studentid])

    if (response.rowCount === 0)
        return res.status(404).send("Not found")

    res.send("Course successfully removed from your list of registered courses!")
})


module.exports = registerRouter;