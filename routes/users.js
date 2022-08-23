"use strict";

const Router = require("express").Router;
const router = new Router();
const { UnauthorizedError } = require("../expressError");
const { ensureLoggedIn, ensureCorrectUser } = require("../middleware/auth");
const User = require("../models/user");


/** GET / - get list of users.
 *
 * => {users: [{username, first_name, last_name}, ...]}
 *
 **/

router.get("/", ensureLoggedIn, async function(req, res, next){
  const users = await User.all();
  return res.json({users});
})


/** GET /:username - get detail of users.
 *
 * => {user: {username, first_name, last_name, phone, join_at, last_login_at}}
 *
 **/

router.get("/:username", ensureCorrectUser, async function(req, res, next){
  let user = await User.get(req.params.username);
  return res.json({ user });
})


/** GET /:username/to - get messages to user
 *
 * => {messages: [{id,
 *                 body,
 *                 sent_at,
 *                 read_at,
 *                 from_user: {username, first_name, last_name, phone}}, ...]}
 *
 **/

router.get("/:username/to", ensureCorrectUser, async function(req, res, next){
  let messages = await User.messagesTo(req.params.username);
  return res.json({ messages });

 })

/** GET /:username/from - get messages from user
 *
 * => {messages: [{id,
 *                 body,
 *                 sent_at,
 *                 read_at,
 *                 to_user: {username, first_name, last_name, phone}}, ...]}
 *
 **/

 router.get("/:username/from", ensureCorrectUser, async function(req, res, next){
  let messages = await User.messagesFrom(req.params.username);
  return res.json({ messages });

 })

/** POST /:username/forgot-password - sends 6-digit code
 *
 * => {code: {code, username}}
 *
 **/

 router.post("/:username/forgot-password",
            ensureCorrectUser,
            async function(req, res, next){
  let code = await User.generateCode(req.params.username);
  return res.json({ code });

 });

 router.post("/:username/reset-password",
             ensureCorrectUser,
             async function(req, res, next){
  const { code, newPassword } = req.body;
  const username = req.params.username;

  let password;
  if (await User.checkCodeMatch(username, code)) {
    password = await User.resetPassword(username, newPassword, code);
    return res.json({ password });
  }

  throw new UnauthorizedError("Invalid code or user.");
 })

module.exports = router;