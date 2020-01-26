const errorRoutes = {};

errorRoutes.get404 = (req, res) => {
	res.sendStatus(404);
}

module.exports = errorRoutes;
