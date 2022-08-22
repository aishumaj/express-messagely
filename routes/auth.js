"use strict";

const { SECRET_KEY } = require("../config");
const db = require("../db");
const { UnauthorizedError, BadRequestError } = require("../expressError");
const User = require("../models/user");
const jwt = require("jsonwebtoken");


const Router = require("express").Router;
const router = new Router();

/** POST /login: {username, password} => {token} */
router.post('/login', async function(req, res, next) {
  const { username, password } = req.body;
  const user = await User.get(username);

  if (user) {
    if (await User.authenticate(username, password) === true) {
      User.updateLoginTimestamp(username);
      const token = jwt.sign(username, SECRET_KEY);
      return res.json({ token });
    }
  }

  throw new UnauthorizedError("Invalid credentials.")
});

/** POST /register: registers, logs in, and returns token.
 *
 * {username, password, first_name, last_name, phone} => {token}.
 */

 router.post('/register', async function(req, res, next) {
  let user;

  try {
    user = await User.register(req.body);
    const token = jwt.sign(user.username, SECRET_KEY);

    return res.json({ token });
  } catch (err) {
    throw new BadRequestError("Username already exists.");
  }
});

module.exports = router;