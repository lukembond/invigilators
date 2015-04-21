define(['libs.min'], function () {

    var STICKYNAV = {
      init: function (tag) {
        var t = $(tag),
          h = 0;
        marginforerror = 150;
        if (t) {
          h = t.outerHeight() + marginforerror;
          this.addEvents(t, h);
        }
      },
      addEvents: function (tag, divheight) {
        var self = this,
          //Debounce function from Underscore.js
          debounce = function (func, wait) {
            var timeout;
            return function () {
              var context = this,
                args = arguments;
              var later = function () {
                timeout = null;
                func.apply(context, args);
              };
              clearTimeout(timeout);
              timeout = setTimeout(later, wait);
            };
          },
          handleScroll = function () {
            var scrollTop = $(window).scrollTop(),
              $body = $('body');

            if (divheight === 0)
              return;

            if (scrollTop < divheight) {
              if (tag.hasClass('fixed')) {
                tag.hide().removeClass('fixed').fadeIn();
              }
            } else {
              if (!tag.hasClass('fixed')) {
                tag.hide().addClass('fixed').fadeIn();
              }
            }
          };
        $(window).bind('scroll', /*debounce(*/ handleScroll /*, 100)*/ );
      }
    };

    STICKYNAV.init('header');
});
