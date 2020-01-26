const express = require('express');
const router = express.Router();
const home = require('./home');
const error = require('./error');

// GET home page.
router.route('/')
	.get(home.get);

router.route('*')
	.get(error.get404);

module.exports = router;
