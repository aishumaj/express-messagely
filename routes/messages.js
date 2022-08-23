"use strict";

const Router = require("express").Router;
const router = new Router();
const { ensureLoggedIn, ensureCorrectUser } = require("../middleware/auth");
const User = require("../models/user");
const Message = require("../models/message");
const { UnauthorizedError } = require("../expressError");

/** GET /:id - get detail of message.
 *
 * => {message: {id,
 *               body,
 *               sent_at,
 *               read_at,
 *               from_user: {username, first_name, last_name, phone},
 *               to_user: {username, first_name, last_name, phone}}
 *
 * Makes sure that the currently-logged-in users is either the to or from user.
 *
 **/
router.get("/:id", ensureLoggedIn, async function(req, res, next) {
  const message = await Message.get(req.params.id);

  if (res.locals.user.username !== message.to_user.username &&
    res.locals.user.username !== message.from_user.username) {
      throw new UnauthorizedError("Cannot read this message!");
  }

  return res.json({ message });
})

/** POST / - post message.
 *
 * {to_username, body} =>
 *   {message: {id, from_username, to_username, body, sent_at}}
 *
 **/
router.post("/", ensureLoggedIn, async function(req, res, next) {
  const { to_username, body } = req.body;
  const user = res.locals.user;
  const message = await Message.create({ from_username: user.username,
                                        to_username,
                                        body });

  return res.json({ message });
})


/** POST/:id/read - mark message as read:
 *
 *  => {message: {id, read_at}}
 *
 * Makes sure that the only the intended recipient can mark as read.
 *
 **/
router.post("/:id/read", ensureLoggedIn, async function(req, res, next) {
  const messageInfo = await Message.get(req.params.id);

  if (res.locals.user.username !== messageInfo.to_user.username) {
    throw new UnauthorizedError();
  }

  const message = await Message.markRead(req.params.id);
  return res.json({ message });
})

module.exports = router;