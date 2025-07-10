
  (function ($) {
  
  "use strict";

    // COUNTER NUMBERS
    jQuery('.counter-thumb').appear(function() {
      jQuery('.counter-number').countTo();
    });

    // BACKSTRETCH SLIDESHOW
    $('.hero-section').backstretch([
      "images/slideshow/afro-woman-cleaning-window-with-rag-home.jpg",
      "images/slideshow/afro-woman-holding-bucket-with-cleaning-items.jpg",
      "images/slideshow/unrecognizable-cleaner-walking-into-hotel-room-with-tools-detergents.jpg",
      "images/techpro/technician.jpeg",
      "images/techpro/tech1.jpeg",
      "images/techpro/tech2.jpeg",
      "images/techpro/pexels-kseniachernaya-5768284.jpg",
      "images/techpro/pexels-marcin-jozwiak-199600-3641377.jpg"
    ],  {duration: 3000, fade: 900});
    
    // CUSTOM LINK
    $('.smoothscroll').click(function(){
      var el = $(this).attr('href');
      var elWrapped = $(el);
  
      scrollToDiv(elWrapped);
      return false;
  
      function scrollToDiv(element){
        var offset = element.offset();
        var offsetTop = offset.top;
        var totalScroll = offsetTop-navheight;
  
        $('body,html').animate({
        scrollTop: totalScroll
        }, 300);
      }
    });
    
  })(window.jQuery);


