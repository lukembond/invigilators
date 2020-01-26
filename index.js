const express = require('express');
const app = express();
const path = require('path');
const routes = require('./src/server/routes');

// setup static folders
app.use('/css', express.static('css'));
app.use('/js', express.static(path.join(__dirname, './js')));
app.use('/font', express.static(path.join(__dirname, './font')));
app.use('/img', express.static(path.join(__dirname, './img')));
app.use('/video', express.static(path.join(__dirname, './video')));

// view engine setup
app.set('views', path.join(__dirname, 'src/views'));
app.set('view engine', 'ejs');

app.use(routes);
app.listen(8080);
console.log("App listening on PORT:8080");
