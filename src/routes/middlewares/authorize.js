const jwt = require("jsonwebtoken")
const { verifyJWT } = require("../students/authTools")
const db = require("../../db")

const authorize = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "")
    const decoded = await verifyJWT(token)
    const user = await db.query('SELECT * FROM "students" WHERE _id= $1',
      [decoded._id])

    if (!user) {
      throw new Error()
    }

    req.token = token
    req.user = user.rows[0]

    if (req.user.token === '') {
      const err = new Error("Sorry you need to login again!")
      err.httpStatusCode = 401
      next(err)
    }
    next()
  } catch (e) {
    const err = new Error("Please authenticate")
    err.httpStatusCode = 401
    next(err)
  }
}

module.exports = authorize
