const homeRoutes = {};

homeRoutes.get = (req, res) => {
	res.render('home');
}

module.exports = homeRoutes;
