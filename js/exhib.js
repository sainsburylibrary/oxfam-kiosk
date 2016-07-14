$(function(){
  // Utility functions
  function identity(){
    if((typeof Android !== 'undefined') && ('getSerialNumber' in Android)) return ("Kiosk-"+Android.getSerialNumber()); // If KioskBrowser, identify by serial
    return "Desktop-"+navigator.product; // Otherwise, identify by navigator.product (like simplified user agent) so it can be filtered out
  }

  // Google Analytics
  var exhibitionTitle = $('body').data('exhibition-title');
  var agentIdentity = identity();
  $('body').append('<iframe id="analytics" height="0" width="0" src="./" style="visibility:hidden;display:none"></iframe>');
  function triggerAnalytics(action){
    $('#analytics').attr('src', '#'+exhibitionTitle+'/'+action+'/'+agentIdentity);
  }
  //triggerAnalytics('kiosk/js-loaded');

  // Automatic brightness control
  var autoBrightnessSupported = ((typeof Android !== 'undefined') && ('getScreenBrightness' in Android) && ('setScreenBrightness' in Android));
  var dayBeginsAt = $('body').data('day-begins-at');
  var dayEndsAt = $('body').data('day-ends-at');
  var dayBrightness = $('body').data('day-brightness');
  var nightBrightness = $('body').data('night-brightness');
  function checkBrightness(){
    var currentHour = (new Date()).getHours();
    if(autoBrightnessSupported) var currentBrightness = Android.getScreenBrightness();
    if((currentHour < dayBeginsAt) || (currentHour >= dayEndsAt)){
      // night time - reduce brightness
      if(autoBrightnessSupported){
        if(currentBrightness != nightBrightness) {
          Android.setScreenBrightness(nightBrightness);
          // DEBUG: Android.showToast('current hour: ' + currentHour + ' | current brightness: ' + currentBrightness + ' | target brightness: ' + nightBrightness)
        } else {
          // DEBUG: Android.showToast('current hour: ' + currentHour + ' | current brightness: ' + currentBrightness + ' | OKAY')
        }
      } else {
        console.log('Setting brightness to ' + nightBrightness);
      }
    } else {
      // day time - increase brightness
      if(autoBrightnessSupported){
        if(currentBrightness != dayBrightness) {
          Android.setScreenBrightness(dayBrightness);
          // DEBUG: Android.showToast('current hour: ' + currentHour + ' | current brightness: ' + currentBrightness + ' | target brightness: ' + dayBrightness)
        } else {
          // DEBUG: Android.showToast('current hour: ' + currentHour + ' | current brightness: ' + currentBrightness + ' | OKAY')
        }
      } else {
        console.log('Setting brightness to ' + dayBrightness);
      }
    }
    setTimeout(checkBrightness, 10000);
  }
  checkBrightness();

  // Create navigation
  $('#pages').after('<nav />');
  $('#pages > *').each(function(index){
    var slideTitle = $(this).data('title') || 'Slide ' + (index + 1);
    if($(this).data('title-icon')){
      slideTitle = '&nbsp;&nbsp;<img src="' + $(this).data('title-icon') + '" />&nbsp;&nbsp;';
    }
    $('nav').append('<a href="' + index + '">' + slideTitle + '</a>');
  });

  // Set navigation height
  var navHeight = $('body').data('nav-height');
  $('nav, nav a').css({height: navHeight, lineHeight: navHeight});
  $('#video-caption').css({bottom: navHeight});
  $('#pages').css('padding-bottom', navHeight);

  // Set up carousel/slider
  $('#pages').slick({
    arrows: false,
    swipe: $('#pages').data('swipe'),
    fade: $('#pages').data('fade')
  }).on('beforeChange', function(e, slick, oldSlide, newSlide){
    // pause and rewind all videos and audio
    $('video, audio').each(function(){
      this.pause(); 
      this.currentTime = 0;
    });
    // remove all overlays
    $('#video-progress, #video-caption').hide();
    // destroy all video
    $('video').remove();
    // move the active class
    $($('nav a')[oldSlide]).removeClass('active');
    $($('nav a')[newSlide]).addClass('active');
  }).on('afterChange', function(e, slick, newSlide){
    // trigger analytics
    triggerAnalytics('slide/'+newSlide);

    // draw and auto-start any video on the new slide
    var video = $($('#pages article')[newSlide]).find('.video-page');
    if(video.data('src')){
      if(!video.data('caption')) {
        video.data('caption', video.html());
      }
      $('#video-caption, #video-progress').addClass('video').removeClass('audio');
      $('#video-caption').html(video.data('caption')).removeClass('playing').show();
      video.html('<video width="100%" height="100%" preload="auto" src="video/' + video.data('src') + '" poster="video/' + video.data('src') + '.jpg" />');
      if(video.data('play-on-click')){
        video.find('video').on('click', function(){
          if(this.paused){
            this.play();
          } else {
            this.pause();
          }
        }).on('play', function(){
          // trigger analytics
          triggerAnalytics('slide/'+newSlide+'/video/play');
          // recaption video
          $('#video-caption').addClass('playing');
          var progressBar = $('#video-progress');
          progressBar.show();
          $(this).on('timeupdate', function(){
            var percent = Math.floor((1000 / this.duration) * this.currentTime);
            progressBar.val(percent);
          });
        }).on('pause', function(){
          // trigger analytics
          triggerAnalytics('slide/'+newSlide+'/video/pause');
          // recaption video
          $('#video-caption').removeClass('playing');
          $('#video-progress').hide();
          $(this).off('timeupdate');
        }).css('cursor', 'pointer');
      }
      if(video.data('autoplay')){
        // trigger analytics
        triggerAnalytics('slide/'+newSlide+'/video/autoplay');
        // kick off autoplay
        video.find('video')[0].play();
      }
    }

    // audio page support
    var audio = $($('#pages article')[newSlide]).find('.audio-page');
    if(audio.data('src')){
      if(!audio.data('caption')) {
        audio.data('caption', audio.html());
      }
      $('#video-caption, #video-progress').removeClass('video').addClass('audio');
      $('#video-caption').removeClass('playing').show();
      audio.html('<div class="audio-player"><audio controls="controls" preload="auto" src="audio/' + audio.data('src') + '" /></div><div class="audio-desc">' + audio.data('caption') +'</div>');
      audio.find('.audio-accompanying-images img').each(function(){
        if(parseInt($(this).data('appear-at')) > 0) {
          $(this).removeClass('shown');
        }
      });
      audio.find('audio').on('play', function(){
        // trigger analytics
        triggerAnalytics('slide/'+newSlide+'/audio/play');
        // recaption audio
        $('#video-caption').addClass('playing');
        var progressBar = $('#video-progress');
        progressBar.show();
        $(this).on('timeupdate', function(){
          // update progress bar
          var currentTime = this.currentTime;
          var percent = Math.floor((1000 / this.duration) * currentTime);
          progressBar.val(percent);
          // show/hide accompanying images
          audio.find('.audio-accompanying-images img').each(function(){
            if(currentTime >= parseInt($(this).data('appear-at'))) {
              $(this).addClass('shown');
            } else {
              $(this).removeClass('shown');
            }
          });
        });
      }).on('pause', function(){
        // trigger analytics
        triggerAnalytics('slide/'+newSlide+'/audio/pause');
        // recaption audio
        $('#video-caption').removeClass('playing');
        //$('#video-progress').hide();
        $(this).off('timeupdate');
      }).css('cursor', 'pointer');
      if(audio.data('autoplay')){
        // trigger analytics
        triggerAnalytics('slide/'+newSlide+'/audio/autoplay');
        // kick off autoplay
        audio.find('audio')[0].play();
      }
    }
  });

  $($('nav a:first-child')).addClass('active');

  // Video/audio player controls
  $('#video-caption, #video-progress').on('click', function(){
    var video = $('.slick-active video, .slick-active audio')[0];
    if(video.paused){
      video.play();
    } else {
      video.pause();
    }
  });

  // Hook up navigation buttons to carousel/slider
  $('nav a, a:not(.external):not(.js-control)').on('click', function(){
    $('#pages').slick('slickGoTo', parseInt($(this).attr('href')));
    return false;
  });

  // Make galleries with pinch-and-zoom work
  var imageViewer = $('#image-viewer');
  var imageViewerWrapper = $('#image-viewer-image-wrapper');
  var imageViewerImage = imageViewerWrapper.find('img');
  var imageViewerCaption = $('#image-viewer-caption');
  imageViewerWrapper.panzoom({
    $zoomIn: $('#image-viewer-controls .zoom-in'),
    $zoomOut: $('#image-viewer-controls .zoom-out')
  }).on('panzoomzoom', function(e, panzoom, scale, opts){
    var captionFadeStartAtScale = 1.0;
    var captionFadeFinishAtScale = 1.6;
    var captionFadeRange = captionFadeFinishAtScale - captionFadeStartAtScale;
    if(scale > captionFadeStartAtScale){
      if(scale >= captionFadeFinishAtScale){
        imageViewerCaption.css('opacity', 0);
        setTimeout(function(){
          if(imageViewerCaption.css('opacity') == 0) imageViewerCaption.css('display', 'none');
        }, 250);
      } else {
        if(imageViewerCaption.css('display') == 'none') imageViewerCaption.css('display', 'block');
        imageViewerCaption.css('opacity', 1 - (scale - captionFadeStartAtScale) / captionFadeRange);
      }
    } else {
      if(imageViewerCaption.css('display') == 'none') imageViewerCaption.css('display', 'block');
      imageViewerCaption.css('opacity', 1);
    }
  });
  $('#image-viewer-controls .close').on('click', function(){
    // trigger analytics
    triggerAnalytics('gallery/closeimageviewer');
    // hide imageViewer
    imageViewer.fadeOut(function(){
      imageViewerCaption.hide();
      imageViewerImage.hide();
    });
    return false;
  });
  $('#image-viewer-controls .prev').on('click', function(){
    imageViewerCaption.hide();
    imageViewerImage.hide();
    $('.gallery-item').removeClass('zoomed');
    imageViewer.data('prev').addClass('zoomed').click();
    return false;
  });
  $('#image-viewer-controls .next').on('click', function(){
    imageViewerCaption.hide();
    imageViewerImage.hide();
    $('.gallery-item').removeClass('zoomed');
    imageViewer.data('next').addClass('zoomed').click();
    return false;
  });
  $('.gallery-section img').each(function(e){
    $('body').append('<img class="precached-gallery-image" src="' + $(this).data('full-src') + '" />');
  });

  $('.gallery-section').each(function(){
    var narrowestImage = 99999;
    $(this).find('img').each(function(){
      $(this).wrap('<div class="gallery-item" data-id="'+$(this).attr('id')+'"></div>');
      $(this).after($(this).data('desc'));
    });
    var masonryGrid = $(this).masonry({
      itemSelector: '.gallery-item',
      columnWidth: 214,
      gutter: 0,
      isFitWidth: true
    })
    masonryGrid.on('click', '.gallery-item', function(){
      if($(this).is('.zoomed')){
        // trigger analytics
        triggerAnalytics('gallery/'+$(this).data('id')+'/imageviewer');
        // already zoomed - open viewer
        imageViewer.data('next', $(this).next()).data('prev', $(this).prev()).show().css('background-position-x', 'center');
        if(imageViewer.data('next').length > 0) {
          imageViewer.find('.next').show();
        } else {
          imageViewer.find('.next').hide();
        }
        if(imageViewer.data('prev').length > 0) {
          imageViewer.find('.prev').show();
        } else {
          imageViewer.find('.prev').hide();
        }
        var fullSrc = $(this).find('img').data('full-src');
        var caption = $(this).find('img').data('caption');
        setTimeout(function(){
          imageViewerImage.attr('src', fullSrc).css({
            height: $(window).height()
          });
          setTimeout(function(){
            // reposition image in frame
            imageViewerImage.css('margin-left', ($(window).width() - $('#image-viewer-image-wrapper img').width()) / 2);
          }, 10)
          imageViewerCaption.html(caption).css('opacity', 1).show();
          imageViewerWrapper.panzoom('reset', false);
          setTimeout(function(){
            imageViewer.css('background-position-x', -100);
            imageViewerImage.show();
          }, 1000);
        }, 10);
      } else {
        // trigger analytics
        triggerAnalytics('gallery/'+$(this).data('id')+'/click');
        // not already zoomed: zoom!
        $('.gallery-item').removeClass('zoomed');
        $(this).addClass('zoomed');
      }
      return false;
    });
    setInterval(function(){
      masonryGrid.masonry('layout');
    }, 50);
  });

  // DEBUG: hit highlights
  //$("nav a[href='2']").trigger('click');
});