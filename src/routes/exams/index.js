const express = require("express")
const db = require("../../db")
const PdfPrinter = require('pdfmake')
const { authorize, forAllButStudent, onlyForAdmin } = require("../middlewares/authorize")

const examRouter = express.Router()

// endpoint to register for exam
examRouter.post("/", authorize, async (req, res) => {
    const response = await db.query("INSERT INTO exams (studentid, courseid, examdate) VALUES ($1, $2, $3) RETURNING _id",
        [req.body.studentid, req.body.courseid, req.body.examdate])

    res.send(response.rows[0])
})

// endpoint to view exam grades and other exam info
examRouter.get("/:studentid", authorize, async (req, res) => {
    const response = await db.query(`SELECT courses._id, courses.name, courses.description, courses.semester, exams.examdate, exams.grade
                                     FROM exams JOIN "courses" ON exams.courseid = "courses"._id
                                     WHERE studentid = $1
                                     GROUP BY courses._id, courses.name, courses.description, courses.semester, exams.examdate, exams.grade
                                     `, [req.params.studentid])
    console.log(response.rows)
    res.send({ count: response.rows.length, data: response.rows })
})

// endpoint to download transcript of records
examRouter.get('/:studentid/pdf', authorize, async (req, res) => {
    try {
        const studentInfo = await db.query(`SELECT students._id, students.firstname, students.lastname, students.email
                                         FROM exams JOIN "students" ON exams.studentid = "students"._id
                                         WHERE studentid = $1
                                         GROUP BY students._id, students.firstname, students.lastname, students.email
                                         `, [req.params.studentid])

        const record = await db.query(`SELECT courses._id, courses.name, courses.description, courses.semester, exams.examdate, exams.grade
                                         FROM exams JOIN "courses" ON exams.courseid = "courses"._id
                                         WHERE studentid = $1 AND exams.grade IS NOT NULL
                                         GROUP BY courses._id, courses.name, courses.description, courses.semester, exams.examdate, exams.grade
                                         `, [req.params.studentid])

        if (record.rowCount > 0) {
            var fonts = {
                Roboto: {
                    normal: 'node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf',
                    bold: 'node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf',
                    italics: 'node_modules/roboto-font/fonts/Roboto/roboto-italic-webfont.ttf',
                    bolditalics: 'node_modules/roboto-font/fonts/Roboto/roboto-bolditalic-webfont.ttf'
                }
            };
            var printer = new PdfPrinter(fonts);

            console.log(record.rows)

            function generateRows() {
                var tempArr = [];
                for (var i = 0; i < record.rows.length; i++) {

                    tempArr.push(
                        {
                            'Course Name': record.rows[i].name,
                            Semester: record.rows[i].semester,
                            'Date of Exam': record.rows[i].examdate.toString().slice(0, 16),
                            Grade: record.rows[i].grade
                        }
                    );
                }
                return tempArr;
            }

            function buildTableBody(data, columns) {
                var body = [];

                body.push(columns);

                data.forEach(function (row) {
                    var dataRow = [];

                    columns.forEach(function (column) {
                        dataRow.push(row[column].toString());
                    })

                    body.push(dataRow);
                });

                return body;
            }

            function table(data, columns) {
                return {
                    table: {
                        headerRows: 1,
                        widths: [100, 100, 100, 50],
                        body: buildTableBody(data, columns)
                    },
                    alignment: 'center',
                    color: 'black',
                    layout: {
                        fillColor: function (rowIndex, node, columnIndex) {
                            return (rowIndex === 0) ? '#eeeeee' : null;
                        }
                    }
                };
            }

            var docDefinition = {
                pageMargins: [100, 50, 100, 50],
                watermark: { text: 'academic transcript', color: 'blue', opacity: 0.1, bold: true, italics: false },
                content: [
                    {
                        text: `${studentInfo.rows[0].firstname.toUpperCase()} ${studentInfo.rows[0].lastname.toUpperCase()}`,
                        bold: true, fontSize: 30, alignment: 'center', color: 'navy'
                    },
                    {
                        text: `Transcript of Records`, normal: true, alignment: 'center', color: 'navy'
                    }, `\n`,
                    table(generateRows(), ['Course Name', 'Semester', 'Date of Exam', 'Grade'])
                ]
            }

            var pdfDoc = printer.createPdfKitDocument(docDefinition);
            // res.setHeader("Content-Disposition", `attachment; filename=${studentInfo.rows[0].firstname}.pdf`)

            res.setHeader('content-type', 'application/pdf');
            pdfDoc.pipe(res)
            pdfDoc.end()
        }
        else res.status(404).send('no record found!')
    } catch (error) {
        console.log(error)
    }
})

// endpoint to get students list in a particular exam
examRouter.get("/student_list/:courseid", authorize, forAllButStudent, async (req, res) => {
    const response = await db.query(`SELECT students._id AS studentid, students.firstname, students.lastname, students.email, exams.examdate, exams.grade, exams._id
                                     FROM exams JOIN "students" ON exams.studentid = "students"._id
                                     WHERE courseid = $1
                                     GROUP BY students._id, students.firstname, students.lastname, students.email, exams.examdate, exams.grade, exams._id
                                     `, [req.params.courseid])
    console.log(response.rows)
    res.send({ count: response.rows.length, data: response.rows })
})

// endpoint to upload exam grades
examRouter.put("/:studentid/:id", authorize, forAllButStudent, async (req, res) => {
    try {
        let params = []
        let query = 'UPDATE "exams" SET '
        for (bodyParamName in req.body) {
            query += // for each element in the body I'll add something like parameterName = $Position
                (params.length > 0 ? ", " : '') + //I'll add a coma before the parameterName for every parameter but the first
                bodyParamName + " = $" + (params.length + 1) // += Category = $1 

            params.push(req.body[bodyParamName]) //save the current body parameter into the params array
        }

        params.push(req.params.studentid) //push the id into the array
        params.push(req.params.id)
        query += " WHERE studentid = $" + (params.length - 1) + " AND _id = $" + (params.length) + " RETURNING *" //adding filtering for id + returning
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

examRouter.delete("/:studentid/:id", authorize, async (req, res) => {

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