// Place third party dependencies in the lib folder
//
// Configure loading modules from the lib directory,
// except 'app' ones,
requirejs.config({
    "baseUrl": "js/libs",
    "paths": {
      "app":  "../app"
    }
});

requirejs(["libs.min"]);

requirejs(["app/console"]);

// Load the main app module to start the app
requirejs(["app/stickynav"]);
requirejs(["app/parallax"]);

requirejs(["app/facebook"]);
