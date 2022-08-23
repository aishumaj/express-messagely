"use strict";

const bcrypt = require("bcrypt");
const { BCRYPT_WORK_FACTOR } = require("../config");
const db = require("../db");
const { NotFoundError } = require("../expressError");
const { accountSid , authToken, twiPhone } = require("../config");
const client = require('twilio')(accountSid, authToken);


/** User of the site. */

class User {

  /** Register new user. Returns
   *    {username, password, first_name, last_name, phone}
   */

  static async register({ username, password, first_name, last_name, phone }) {
    //hash the pw
    let hashedPw = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    //insert into users table
    const results = await db.query(
      `INSERT INTO users (username,
                          password,
                          first_name,
                          last_name,
                          phone,
                          join_at,
                          last_login_at)
        VALUES ($1, $2, $3, $4, $5, current_timestamp, current_timestamp)
        RETURNING username, password, first_name, last_name, phone`,
      [username, hashedPw, first_name, last_name, phone],
    );

    return results.rows[0];
  }

  /** Authenticate: is username/password valid? Returns boolean. */

  static async authenticate(username, password) {
    //get the pw
    const result = await db.query(
      `SELECT password FROM users WHERE username = $1`,
      [username],
    );

    const user = result.rows[0];

    //bcrypt.compare
    // if (user) {
      return user && await bcrypt.compare(password, user.password) === true;
    // }
    // return false;
  }

  /** Update last_login_at for user */

  static async updateLoginTimestamp(username) {
    const result = await db.query(
      `UPDATE users
      SET last_login_at=current_timestamp
      WHERE username = $1
      RETURNING username`,
      [username],
    );
    const user = result.rows[0];

    if (!user) {
      throw new NotFoundError(`${username} is not a valid username.`);
    }
  }

  /** All: basic info on all users:
   * [{username, first_name, last_name}, ...] */

  static async all() {
    const results = await db.query(
      `SELECT username, first_name, last_name
      FROM users`
    );

    return results.rows;
  }

  /** Get: get user by username
   *
   * returns {username,
   *          first_name,
   *          last_name,
   *          phone,
   *          join_at,
   *          last_login_at } */

  static async get(username) {
    const results = await db.query(
      `SELECT username,
              first_name,
              last_name,
              phone,
              join_at,
              last_login_at
      FROM users
      WHERE username = $1`,
      [username]
    );
    const user = results.rows[0];

    if (!user) {
      throw new NotFoundError(`${username} is not a valid username.`);
    }
    return user;
  }

  /** Return messages from this user.
   *
   * [{id, to_user, body, sent_at, read_at}]
   *
   * where to_user is
   *   {username, first_name, last_name, phone}
   *
   * result:
   * [{id, to_user:{username, first_name, last_name, phone}, body, sent_at, read_at}]
   */

  static async messagesFrom(username) {
    const results = await db.query(
      `SELECT m.id,
              m.to_username,
              u.first_name,
              u.last_name,
              u.phone,
              m.body,
              m.sent_at,
              m.read_at
      FROM messages AS m
        JOIN users AS u
          ON m.to_username = u.username
      WHERE m.from_username = $1`,
      [username]
    );

    const messagesFromUser = results.rows;

    return messagesFromUser.map(m => ({
      id: m.id,
      to_user: {
        username: m.to_username,
        first_name: m.first_name,
        last_name: m.last_name,
        phone: m.phone
      },
      body: m.body,
      sent_at: m.sent_at,
      read_at: m.read_at,
    }));

  }

  /** Return messages to this user.
   *
   * [{id, from_user, body, sent_at, read_at}]
   *
   * where from_user is
   *   {username, first_name, last_name, phone}
   */

  static async messagesTo(username) {
    const results = await db.query(
      `SELECT m.id,
              m.from_username,
              u.first_name,
              u.last_name,
              u.phone,
              m.body,
              m.sent_at,
              m.read_at
      FROM messages AS m
        JOIN users AS u
          ON m.from_username = u.username
      WHERE m.to_username = $1`,
      [username]
    );

    const messagesToUser = results.rows;

    return messagesToUser.map(m => ({
      id: m.id,
      from_user: {
        username: m.from_username,
        first_name: m.first_name,
        last_name: m.last_name,
        phone: m.phone
      },
      body: m.body,
      sent_at: m.sent_at,
      read_at: m.read_at,
    }));

  }

  /** Generates a 6-digit code for a user and sends to user's phone number.
   * Add code to database table: codes.
   */
  static async generateCode(username) {
    const code = Math.floor(100000 + Math.random() * 900000);

    const results = await db.query(
      `INSERT INTO codes (code, username, created_at)
      VALUES ($1, $2, current_timestamp)
      RETURNING code, username
      `, [code, username]
    )

    let phone = (await User.get(username)).phone;

    client.messages
      .create({
         body: `Your 6-digit code is ${code}.`,
         from: twiPhone,
         to: phone
       })
      .then(message => console.log(message.sid));

    return results.rows[0];

  }

  /** Accepts a username and 6-digit code. Compares with code in database. */
  static async checkCodeMatch(username, code) {
    const lastCode = await db.query(
      `SELECT code, used FROM codes
      WHERE username=$1
      ORDER BY created_at DESC
      LIMIT 1`, [username]
    )

    return lastCode.rows[0].code === code && !lastCode.rows[0].used;
  }

  /** Accepts username and new password. Sets new password in database. */
  static async resetPassword(username, newPassword, code) {
    let hashedPw = await bcrypt.hash(newPassword, BCRYPT_WORK_FACTOR);

    await db.query(
      `UPDATE codes SET used=TRUE
      WHERE code=$1 AND username=$2
      RETURNING code, used`, [code, username]
    );

    debugger;
    const results = await db.query(
      `UPDATE users
      SET password=$1
      WHERE username=$2
      RETURNING username`, [hashedPw, username]
    );

    return results.rows[0];
  }
}


module.exports = User;
