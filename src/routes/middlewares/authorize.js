const jwt = require("jsonwebtoken")
// const { verifyStudentJWT } = require("../students/auth_students")
// const { verifyLecturerJWT } = require("../lecturers/auth_lecturers")
// const { verifyAdminJWT } = require("../admin/auth_admin")
const { verifyJWT } = require("../users/auth_users")
const db = require("../../db")

const authorize = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken
    const decoded = await verifyJWT(token)
    const user = await db.query('SELECT * FROM "users" WHERE _id= $1',
      [decoded._id])

    if (!user) {
      throw new Error()
    }

    req.token = token
    req.user = user.rows[0]

    if (req.user.refresh_token === null) {
      const err = new Error("Sorry you already logged out!")
      err.httpStatusCode = 403
      next(err)
    }
    next()
  } catch (e) {
    const err = new Error("Please authenticate")
    err.httpStatusCode = 401
    next(err)
  }
}

const onlyForAdmin = async (req, res, next) => {
  if (req.user && req.user.title === "admin") next()
  else {
    const err = new Error("Only for admin!")
    err.httpStatusCode = 403
    next(err)
  }
}

const forAllButStudent = async (req, res, next) => {
  if (req.user && req.user.title === "admin" || req.user && req.user.title === "tutor") next()
  else {
    const err = new Error("Only for admin & tutors!")
    err.httpStatusCode = 403
    next(err)
  }
}

// const authorizeStudent = async (req, res, next) => {
//   try {
//     const token = req.cookies.accessToken
//     const decoded = await verifyStudentJWT(token)
//     const user = await db.query('SELECT * FROM "students" WHERE _id= $1',
//       [decoded._id])

//     if (!user) {
//       throw new Error()
//     }

//     req.token = token
//     req.user = user.rows[0]

//     if (req.user.token === null) {
//       const err = new Error("Sorry you already logged out!")
//       err.httpStatusCode = 403
//       next(err)
//     }
//     next()
//   } catch (e) {
//     const err = new Error("Please authenticate")
//     err.httpStatusCode = 401
//     next(err)
//   }
// }

// const authorizeLecturer = async (req, res, next) => {
//   try {
//     const token = req.cookies.accessToken
//     const decoded = await verifyLecturerJWT(token)
//     const user = await db.query('SELECT * FROM "lecturers" WHERE _id= $1',
//       [decoded._id])

//     if (!user) {
//       throw new Error()
//     }

//     req.token = token
//     req.user = user.rows[0]

//     if (req.user.token === null) {
//       const err = new Error("Sorry you already logged out!")
//       err.httpStatusCode = 401
//       next(err)
//     }
//     next()
//   } catch (e) {
//     const err = new Error("Please authenticate")
//     err.httpStatusCode = 401
//     next(err)
//   }
// }

// const authorizeAdmin = async (req, res, next) => {
//   try {
//     const token = req.cookies.accessToken
//     const decoded = await verifyAdminJWT(token)
//     const user = await db.query('SELECT * FROM "admin" WHERE _id= $1',
//       [decoded._id])

//     if (!user) {
//       throw new Error()
//     }

//     req.token = token
//     req.user = user.rows[0]

//     if (req.user.token === null) {
//       const err = new Error("Sorry you already logged out!")
//       err.httpStatusCode = 401
//       next(err)
//     }
//     next()
//   } catch (e) {
//     const err = new Error("Please authenticate")
//     err.httpStatusCode = 401
//     next(err)
//   }
// }

module.exports = { authorize, onlyForAdmin, forAllButStudent }
