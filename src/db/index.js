const { Pool } = require("pg") //import Pool object from PG

const pool = new Pool() //THIS will read the .env file and try to connect to our DB

module.exports = {

    query: (text, params) => pool.query(text, params)
}