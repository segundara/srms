const jwt = require("jsonwebtoken")
const db = require("../../db")

const authenticateStudent = async (user) => {
  try {
    // generate tokens
    const newAccessToken = await generateStudentJWT({ _id: user._id })
    const newRefreshToken = await generateStudentRefreshJWT({ _id: user._id })

    let params = []
    let query = `UPDATE "students" SET token = '${newRefreshToken}'`

    params.push(user._id)
    query += " WHERE _id = $" + (params.length) + " RETURNING *"
    console.log(query)

    const result = await db.query(query, params)

    return { accessToken: newAccessToken, refreshToken: newRefreshToken }
  } catch (error) {
    console.log(error)
    throw new Error(error)
  }
}

const generateStudentJWT = (payload) =>
  new Promise((res, rej) =>
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '30s' },
      (err, token) => {
        if (err) rej(err)
        res(token)
      }
    )
  )

const verifyStudentJWT = (token) =>
  new Promise((res, rej) =>
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) rej(err)
      res(decoded)
      console.log("verifyStudentJWT token => " + token)
    })
  )

const generateStudentRefreshJWT = (payload) =>
  new Promise((res, rej) =>
    jwt.sign(
      payload,
      process.env.REFRESH_SECRET,
      { expiresIn: "1 week" },
      (err, token) => {
        if (err) rej(err)
        res(token)
      }
    )
  )

const refreshTokenStudent = async (oldRefreshToken) => {
  const decoded = await verifyRefreshTokenStudent(oldRefreshToken)

  const user = await db.query('SELECT * FROM "students" WHERE _id= $1',
    [decoded._id])

  if (!user) {
    throw new Error(`Access is forbidden`)
  }

  const currentRefreshToken = user.rows[0].token

  if (!currentRefreshToken) {
    throw new Error(`Refresh token is wrong`)
  }

  // generate tokens
  const newAccessToken = await generateStudentJWT({ _id: user.rows[0]._id })
  const newRefreshToken = await generateStudentRefreshJWT({ _id: user.rows[0]._id })

  let params = []
  let query = `UPDATE "students" SET token = '${newRefreshToken}'`

  params.push(decoded._id)
  query += " WHERE _id = $" + (params.length) + " RETURNING *"

  const result = await db.query(query, params)

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}

const verifyRefreshTokenStudent = (token) =>
  new Promise((res, rej) =>
    jwt.verify(token, process.env.REFRESH_SECRET, (err, decoded) => {
      if (err) rej(err)
      res(decoded)
    })
  )

module.exports = { authenticateStudent, verifyStudentJWT, refreshTokenStudent }
