ko.bindingHandlers.filedrop = {
  init: function (element, valueAccessor) {
    var options = $.extend({}, { overlaySelector: null }, valueAccessor());
    
    if (!options.onFileDrop)
      return;
    else if (!window.File || !window.FileReader || !window.FileList || !window.FormData) {
      console.log("File drop disabled because this browser sucks");
      return;
    }
    
    $(element).bind("dragenter", function (e) {
      e.stopPropagation();
      e.preventDefault();
    
      if (options.overlaySelector)
        $(options.overlaySelector).toggle();
    });

    $(element).bind("dragleave", function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (options.overlaySelector)
        $(options.overlaySelector).toggle();
    });

    $(element).bind("drop", function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (options.overlaySelector)
        $(options.overlaySelector).toggle();
      
      if (typeof options.onFileDrop === "function")
        $.each(e.originalEvent.dataTransfer.files, function () {
          if (!/^.*\.(nzb)$/ig.test(this.name))
            return;
              
          options.onFileDrop(this);
        });
    });
  }
};

$(document).bind('dragover', function (e) { e.preventDefault(); });