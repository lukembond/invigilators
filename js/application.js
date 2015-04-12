// Avoid `console` errors in browsers that lack a console.
if (!(window.console && console.log)) {
    (function() {
        var noop = function() {};
        var methods = ['assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error', 'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log', 'markTimeline', 'profile', 'profileEnd', 'markTimeline', 'table', 'time', 'timeEnd', 'timeStamp', 'trace', 'warn'];
        var length = methods.length;
        var console = window.console = {};
        while (length--) {
            console[methods[length]] = noop;
        }
    }());
}

window.fbAsyncInit = function() {
  FB.init({
    appId      : '627980390669845',
    xfbml      : true,
    version    : 'v2.3'
  });
};

(function(d, s, id){
   var js, fjs = d.getElementsByTagName(s)[0];
   if (d.getElementById(id)) {return;}
   js = d.createElement(s); js.id = id;
   js.src = "//connect.facebook.net/en_US/sdk.js";
   fjs.parentNode.insertBefore(js, fjs);
 }(document, 'script', 'facebook-jssdk'));
var STELLARJS = {
    init: function() {

      //initialise Stellar.js
      $(window).stellar();

      //Cache some variables
      var links = $('nav').find('li');
      var slide = $('article');
      var button = $('.button');
      var mywindow = $(window);
      var htmlbody = $('html,body');

      //Setup waypoints plugin
      slide.waypoint(function (event, direction) {

          //cache the variable of the data-slide attribute associated with each slide
          dataslide = $(this).attr('data-slide');

          //If the user scrolls up change the navigation link that has the same data-slide attribute as the slide to active and
          //remove the active class from the previous navigation link
          if (direction === 'down') {
              $('nav li[data-slide="' + dataslide + '"]')
                .addClass('active')
                .prev()
                .removeClass('active');
          }
          // else If the user scrolls down change the navigation link that has the same data-slide attribute as the slide to active and
          //remove the active class from the next navigation link
          else {
              $('nav li[data-slide="' + dataslide + '"]')
                .addClass('active')
                .next()
                .removeClass('active');
          }

      });

      //waypoints doesnt detect the first slide when user scrolls back up to the top so we add this little bit of code, that removes the class
      //from navigation link slide 2 and adds it to navigation link slide 1.
      mywindow.scroll(function () {
          if (mywindow.scrollTop() === 0) {
              $('nav li[data-slide="1"]').addClass('active');
              $('nav li[data-slide="2"]').removeClass('active');
          }
      });

      //Create a function that will be passed a slide number and then will scroll to that slide using jquerys animate. The Jquery
      //easing plugin is also used, so we passed in the easing method of 'easeInOutQuint' which is available throught the plugin.
      function goToByScroll(dataslide) {
          htmlbody.animate({
              scrollTop: $('article[data-slide="' + dataslide + '"]').offset().top
          }, 2000, 'easeInOutQuint');
      }



      //When the user clicks on the navigation links, get the data-slide attribute value of the link and pass that variable to the goToByScroll function
      links.click(function (e) {
          e.preventDefault();
          dataslide = $(this).attr('data-slide');
          goToByScroll(dataslide);
      });

      //When the user clicks on the button, get the get the data-slide attribute value of the button and pass that variable to the goToByScroll function
      button.click(function (e) {
          e.preventDefault();
          dataslide = $(this).attr('data-slide');
          goToByScroll(dataslide);
      });

    }
};

// Parallax effect
$(document).ready(function() {
  STELLARJS.init();
});

var STICKYNAV = {
	init: function( tag ) {
		var t = $(tag),
			h = 0;
			marginforerror = 150;
		if (t) {
			h = t.outerHeight() + marginforerror;
			this.addEvents(t, h);
		}
	},
	addEvents: function(tag, divheight) {
		var self = this,
			//Debounce function from Underscore.js
			debounce = function(func, wait) {
				var timeout;
				return function() {
					var context = this,
						args 	= arguments;
					var later 	= function() {
						timeout = null;
						func.apply(context, args);
					};
					clearTimeout(timeout);
					timeout = setTimeout(later, wait);
				};
			},
			handleScroll = function() {
				var scrollTop = $(window).scrollTop(),
					$body 	  = $('body');

				if (divheight === 0)
					return;

				if (scrollTop < divheight ) {
					if (tag.hasClass('fixed')) {
						tag.hide().removeClass('fixed').fadeIn();
					}
				} else {
					if ( !tag.hasClass('fixed') ) {
						tag.hide().addClass('fixed').fadeIn();
					}
				}
			};
		$(window).bind('scroll', /*debounce(*/handleScroll/*, 100)*/);
	}
};

// Sticky nav
$(document).ready(function() {
  STICKYNAV.init( 'header' );
});
