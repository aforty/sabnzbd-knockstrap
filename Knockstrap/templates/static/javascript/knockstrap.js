var apiKey;

if (!window.console)
	window.console = { error: function(){}, log: function(){}, warn: function(){} };

String.prototype.formatWith = function() {
  for(var t = this, n = arguments.length; n--;)
    t = t.replace(new RegExp("\\{" + n + "\\}","gm"), arguments[n]);
  return t;
}

ko.bindingHandlers.toggle = {
	init: function (e, v) {
		e = $(e); v = v(), toggle = ko.utils.unwrapObservable(typeof v === "object" ? v.value : v);
		toggle ? e.show() : e.hide();
	},
	update: function (e, v) {
		e = $(e); v = v();
		var toggle = typeof v === "object" ? ko.utils.unwrapObservable(v.value) : ko.utils.unwrapObservable(v);
		if (v.effect) {
			switch (v.effect) {
				case "slide":
					toggle ? e.slideDown() : e.slideUp();
					break;
				case "slideHorizontal", "slideH":
					toggle ? e.show("slide", { direction: "right" }) : e.hide("slide", { direction: "left" });
					break;
				case "fade":
					toggle ? e.fadeIn() : e.fadeOut();
					break;
				default:
					toggle ? e.show() : e.hide();
					break;
			}
		}
		else toggle ? e.show() : e.hide();
	}
};

var isMobileDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);
ko.bindingHandlers.idevicify = {
	init: function(e, v) {
		v = v();

		if (!isMobileDevice || typeof v !== "object")
			return;

		for (var key in v)
			e.setAttribute(key, v[key]);
	}
};

var StatusModel = function(data) {
  this.__initialize(data);
};

StatusModel.prototype = {
  constructor: StatusModel,
  
  __initialize: function(data) {
    this.type = data.type;
    this.date = data.date;
    this.text = data.text;
    this.cssType = (data.type === "ERROR" ? "error" : data.type === "WARNING" ? "warning" : "info");
  }
};


var StatusListModel = function() {
  this.__initialize();
};

StatusListModel.prototype = {
  constructor: StatusListModel,
  
  __getIsEmpty: function() {
		return this.items().length === 0;
  },
  
	clear: function() {
		if (!confirm("Are you sure you want to clear all status messages?"))
			return;
			
	  var self = this;

		$.when($.ajax({
			url: "status/clearwarnings",
			type: "GET",
			cache: false,
			data: { session: apiKey }
		}))
		.then(function(r) {
			self.items.removeAll();
		})
		.fail(function(e) {
			console.error("Error clearing warnings", e);
		});
	},
	
	refresh: function() {
	  var self = this;
	  
		$.when($.ajax({
			url: "tapi",
			type: "GET",
			cache: false,
			data: {
				mode: "warnings",
				output: "json",
				apikey: apiKey
			}
		}))
		.then(function(r){
			if (!r)
				return;

			$.each(r.warnings, function() {
				var splits = this.toString().split(/\n/);
				var data = { type: splits[1], date: splits[0], text: splits[2] };

				var existingItem = ko.utils.arrayFirst(self.items(), function(i) { return i.date == data.date; });

				if (!existingItem) {
					self.items.splice(0, 0, new StatusModel(data));
					console.log("Added new status", data);
				}
			});

			if (self.isFirstLoad())
				self.isFirstLoad(false);
		})
		.fail(function(e){
			console.error("Error loading warnings", e);
		});
	},

  showItem: function(e) { 
    if (e.nodeType === 1) 
      $(e).hide().fadeIn(); 
  },
  
  hideItem: function(e) { 
    if (e.nodeType === 1) 
      $(e).fadeOut(function() { $(e).remove(); }); 
  },
  
  __initialize: function() {
    this.items = ko.observableArray();
    this.isFirstLoad = ko.observable(true);
    
    this.isEmpty = ko.computed(this.__getIsEmpty.bind(this), this);
  }
};


var QueueModel = function (data) {
    this.__initialize(data);
};

QueueModel.prototype = {
  constructor: QueueModel,
  
  // computed property getters/setters
  __getCategory: function() { return this.__category(); },
  __setCategory: function(v) { 
    if (!v) v = "Default"; 
    if (v != this.__category()) { 
      this.changeCategory(v); 
      this.__category(v); 
    }
  },
  
  __getScript: function() { return this.__script(); },
  __setScript: function(v) { 
    if (!v) v = "Default"; 
    
    if (v != this.__script()) { 
      this.changeScript(v); 
      this.__script(v); 
    }
  },
  
  __getOption: function() { return this.__option(); },
  __setOption: function(v) { 
    if (!v) v = 0; 
    if (v != this.__option()) { 
      this.changeOption(v); 
      this.__option(v); 
    }
  },
  
  __getPriority: function() { return this.__priority(); },
  __setPriority: function(v) { 
    if (!v) v = 0; 
    if (v != this.__priority()) { 
      this.changePriority(v); 
      this.__priority(v); 
    }
  },
  
  __getDownloadedMB: function() {
		return (this.totalMB() - this.remainingMB()).toFixed(2);
	},

	__getPercentage: function() {
		return ((this.downloadedMB() / this.totalMB()) * 100).toFixed(2);
	},

	__getPercentageRounded: function() {
		return Math.floor(this.percentage() || 0);
	},
	
	__getIsPaused: function() {
	  return this.status() === 'Paused';
	},
	
	__getIsDownloading: function() {
		return this.status() === 'Downloading';
	},
	
	__getHasData: function() {
		return this.downloadedMB() > 0;
	},

	__getShowProgressBar: function() {
		return this.isDownloading() || this.hasData();
	},
	
	__onEditedNameSet: function(v) { 
	  if (v !== this.name()) 
	    this.changeName(v); 
	},
	
	
	// functions
	toggleShowMore: function() {
		this.showMore(!this.showMore());
	},

	editName: function() {
	  var currentState = this.editingName();

	  if (currentState) {
	    if (this.editedName() !== this.name())
	      this.changeName(this.editedName());
	  }
	  else {
	    this.editedName(this.name());
    }
    
	  this.editingName(!currentState);
	},
	
	changeName: function(value) {
	  console.log("Changing queue name", this, value);
	  var previousName = this.name();
	  this.name(value);

    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "rename", value: this.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (!r.status)
				this.name(previousName);
		})
		.fail(function(e) {
			console.error("Error changing queue category", e);
			this.name(previousName);
		});
	},
	
	changeCategory: function(value) {
	  var self = this;
		console.log("Changing queue category", this, value);

    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_cat", value: this.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status === true)
				self.__category(value);
		})
		.fail(function(e) {
			console.error("Error changing queue category", e);
		});
	},
	
	changeOption: function(value) {
	  var self = this;
		console.log("Changing queue option", this, value);

    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_opts", value: this.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status === true)
				self.__option(value);
		})
		.fail(function(e) {
			console.error("Error changing queue option", this, e);
		});
	},

	changePriority: function(value) {
	  var self = this;
		console.log("Changing queue priority", this, value);

    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "priority", value: this.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status === true)
				self.__priority(value);
		})
		.fail(function(e) {
			console.error("Error changing queue priority", this, e);
		});
	},

	changeScript: function(value) {
	  var self = this;
		console.log("Changing queue script", this, value);

    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_script", value: this.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status === true)
				self.__script(value);
		})
		.fail(function(e) {
			console.error("Error changing queue script", e);
		});
	},

	toggleState: function() {
	  var self = this;
		console.log("Changing queue state", this);

		var actionType = this.isPaused() ? "resume" : "pause";
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: actionType, value: this.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status === true)
				self.status(self.isPaused() ? "Downloading" : "Paused");
		})
		.fail(function(e) {
			console.error("Error toggling queue state", this, e);
		});
	},
  
  updateData: function (data) {
    if (!data)
      return;
    
		this.id = data.nzo_id;
		this.index(data.index);
		if (!this.editingName())
		  this.name($.trim(data.filename));
		this.status(data.status);
		this.totalMB(parseFloat(data.mb));
		this.remainingMB(parseFloat(data.mbleft));
		
		this.__category(/^\*|None$/.test(data.cat) ? "Default" : data.cat);
		this.__priority(data.priority || "2");
		this.__script(data.script);
		this.__option(parseInt(data.unpackopts));
  },
  
  __initialize: function(data) {
    // init observable properties 
    this.index = ko.observable();
    this.name = ko.observable();
    this.status = ko.observable();
    this.totalMB = ko.observable();
    this.remainingMB = ko.observable();
    this.showMore = ko.observable(false);
    this.editingName = ko.observable(false);
    this.editedName = ko.observable();
    
    // init private properties
    this.__category = ko.observable();
    this.__script = ko.observable();
    this.__option = ko.observable();
    this.__priority = ko.observable();
    
    // init computed properties
    this.category = ko.computed({ read: this.__getCategory.bind(this), write: this.__setCategory.bind(this) }, this);
    this.script = ko.computed({ read: this.__getScript.bind(this), write: this.__setScript.bind(this) }, this);
    this.option = ko.computed({ read: this.__getOption.bind(this), write: this.__setOption.bind(this) }, this);
    this.priority = ko.computed({ read: this.__getPriority.bind(this), write: this.__setPriority.bind(this) }, this);
    
    this.downloadedMB = ko.computed(this.__getDownloadedMB.bind(this), this);
    this.percentage = ko.computed(this.__getPercentage.bind(this), this);
    this.percentageRounded = ko.computed(this.__getPercentageRounded.bind(this), this);
    this.isPaused = ko.computed(this.__getIsPaused.bind(this), this);
    this.isDownloading = ko.computed(this.__getIsDownloading.bind(this), this);
    this.hasData = ko.computed(this.__getHasData.bind(this), this);
    this.showProgressBar = ko.computed(this.__getShowProgressBar.bind(this), this);
	
	  // update initial data
	  this.updateData(data);
    
    // init subscriptions
    this.editedName.subscribe(this.__onEditedNameSet.bind(this));
  }
};


var QueueListModel = function () {
  this.__initialize();
};

QueueListModel.prototype = {
  constructor: QueueListModel,
  
  defaults: { 
    itemsPerPage: 20,
    priorities: [
      { value: 2, name: "Force" },
      { value: 1, name: "High" },
      { value: 0, name: "Normal" },
      { value: -1, name: "Low" },
      { value: -4, name: "Stop" }
    ],
    options: [
      { value: 0, name: "Download" },
      { value: 1, name: "+Repair" },
      { value: 2, name: "+Unpack" },
      { value: 3, name: "+Delete" }
		]
  },
  
  __getItemsPerPage: function() {
    this.__itemsPerPage(parseInt(localStorage.queueItemsPerPage || this.defaults.itemsPerPage));
    return this.__itemsPerPage();
  },
  
  __setItemsPerPage: function(v) {
    if (!v || isNaN(v) || parseInt(v) <= 0)
      v = this.defaults.itemsPerPage;
    localStorage.queueItemsPerPage = v;
    this.__itemsPerPage(v);
  },
  
  __getHasSpeedLimit: function() {
		return this.speedLimit() && !isNaN(this.speedLimit());
	},
	
	__getIsTimerPaused: function() {
		return this.pausedUntil() && this.pausedUntil() > (new XDate());
	},
	
	__getPauseTimerText: function() {
	  if (!this.isTimerPaused())
	    return '';
	  
	  var diff = (this.pausedUntil() - (new XDate())) / 1000,
	    diffHours = Math.floor(diff / 3600) % 24,
      diffMins = Math.floor(diff / 60) % 60,
      diffSecs = Math.floor(diff % 60);
    
	  if (diffHours > 0)
	    return '{0} hour{1} and {2} minute{3}'.formatWith(diffHours, diffHours === 1 ? '' : 's', diffMins, diffMins === 1 ? '' : 's');
	  else if (diffMins > 10)
	    return '{0} minute{1}'.formatWith(diffMins, diffMins === 1 ? '' : 's');
	  else
	    return '{0} minute{1} and {2} second{3}'.formatWith(diffMins, diffMins === 1 ? '' : 's', diffSecs, diffSecs === 1 ? '' : 's');
	},
	
	__getHasScripts: function() {
		return this.scripts().length > 0;
	},
	
	__getIsEmpty: function() {
		return this.items().length <= 0;
	},
	
	__getHasMultiplePages: function() {
		return this.itemsTotal() / this.itemsPerPage() > 1;
	},
	
	__getShowDownloadSpeed: function() {
		return !this.isPaused() && !this.isEmpty() && this.speed() > 0;
	},
	
	__getDownloadSpeed: function() {
		if (this.showDownloadSpeed())
			return this.speed() + ' ' + this.speedMetric();
	},
	
	__onSpeedLimitSet: function(v) {
		if (!v || isNaN(v) || parseInt(v) < 0)
			this.speedLimit('');
			
		this.setSpeedLimit(parseInt(v));
	},

	__onItemsTotalSet: function(v) {
		this.setPages();
	},

	__onCurrentPageSet: function(v) {
		this.setPages();
	},
	
	__onItemsPerPageSet: function(v) {
    this.refresh({ force: true });
	},
	
	moveItem: function(e) {
		var itemMoved = e.item;
		var itemReplaced = ko.utils.arrayFirst(this.items(), function(i) { return i.index() == e.targetIndex; });

		itemMoved.index(e.targetIndex);
		itemReplaced.index(e.sourceIndex);

		console.log("Moving queue", e, itemMoved);

		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "switch", value: itemMoved.id, value2: e.targetIndex, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.position !== e.targetIndex) {
				itemMoved.index(e.sourceIndex);
				itemReplaced.index(e.targetIndex);
			}
		})
		.fail(function(e) {
			console.error("Error moving queue", itemMoved, e);
      itemMoved.index(e.sourceIndex);
      itemReplaced.index(e.targetIndex);
		});
	},

	removeItem: function(itemToRemove) {
		if (!confirm("Are you sure you want to delete this?"))
			return;

		var self = this;
		
		console.log("Removing queue item", itemToRemove);

		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "delete", value: itemToRemove.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status === true) {
				self.items.remove(itemToRemove);
				self.refresh({ force: true });
			}
		})
		.fail(function(e) {
			console.error("Error deleting queue item", itemToRemove, e);
		});
	},

	toggleQueueState: function() {
		console.log("Changing queue state");

		var targetState = !this.isPaused(),
		  self = this;
		  
		this.isPaused(targetState);
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: !targetState ? "resume" : "pause", output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (!r.status)
				self.isPaused(!targetState);
		})
		.fail(function(e) {
			self.isPaused(!targetState);
			console.error("Error changing queue state", this, e);
		});
	},
	
	setPauseMinutes: function(minutes) {
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "config", name: "set_pause", value: minutes, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r && r.status === true)
				console.log("Paused for " + minutes + " minutes", r);
		})
		.fail(function(e) {
			console.error("Error changing pause time", this, e);
		});
	},

	refresh: function(options) {
		var force = options && options.force === true || false;

		if (!force && this.refreshXhr && this.refreshXhr.readyState !== 4)
			return;

		if (this.refreshXhr && this.refreshXhr.readyState !== 4)
			this.refreshXhr.abort();

    var self = this;
    
		this.refreshXhr = $.ajax({
			url: "tapi",
			type: "GET",
			cache: false,
			data: {
				mode: "queue",
				start: this.currentPage() * this.itemsPerPage(),
				limit: this.itemsPerPage(),
				output: "json",
				apikey: apiKey
			}
		});

		$.when(this.refreshXhr)
		.then(function(r){
			if (!r)
				return;

			var currentItemIds = $.map(self.items(), function(i) { return i.id; });

			if (r.queue.noofslots !== self.itemsTotal())
				self.itemsTotal(r.queue.noofslots);

			var queueSpeed = r.queue.speed.split(/\s/);
			if (queueSpeed.length == 2) {
				self.speed(parseFloat(queueSpeed[0]));
				self.speedMetric(queueSpeed[1] === 'K' ? 'KB/s' : queueSpeed[1] === 'M' ? 'MB/s' : 'GB/s');
			}
			self.timeRemaining(r.queue.timeleft);

			if (r.queue.scripts.length !== self.scripts().length)
				self.scripts($.map(r.queue.scripts, function(i) { return i == "*" ? "None" : i }));

			if (r.queue.categories.length !== self.categories().length)
				self.categories($.map(r.queue.categories, function(i) { return i === "*" || i === "None" ? "Default" : i }));

			self.isPaused(r.queue.paused);
			self.sizeLeft(r.queue.sizeleft);
			self.size(r.queue.size);
			self.cacheSize(r.queue.cache_size);
			self.cacheArt(r.queue.cache_art);

			if (r.queue.speedlimit !== self.speedLimit()) {
				self.__disableSpeedLimitUpdate = true;
				self.speedLimit(r.queue.speedlimit);
				self.__disableSpeedLimitUpdate = false;
			}
			
			if (r.queue.pause_int === '0')
			  self.pausedUntil(null);
			else {
			  var time = r.queue.pause_int.match(/(\d*):?(\d*)/)
			  self.pausedUntil((new XDate()).addMinutes(parseInt(time[1])).addSeconds(parseInt(time[2])));
			}

			$.each(r.queue.slots, function() {
				var data = this;
				var existingItem = ko.utils.arrayFirst(self.items(), function(i) { return i.id === data.nzo_id; });
				data.priority = ko.utils.arrayFirst(self.defaults.priorities, function (i) { return i.name === data.priority; }).value;

				if (existingItem) {
					existingItem.updateData(data);
					currentItemIds.splice(currentItemIds.indexOf(data.nzo_id), 1);
				}
				else {
					self.items.push(new QueueModel(data));
					console.log("Added new queue item", data);
				}
			});

			// remove any items that weren't returned by updated data
			$.each(currentItemIds, function() {
				var id = this.toString();
				self.items.remove(ko.utils.arrayFirst(self.items(), function(i) { return i.id == id; }));
			});

			self.items.sort(function(a, b) { return a.index() < b.index() ? -1 : 1; });

			self.updater.updateData({ downloadUrl: r.queue.new_rel_url, latestVersion: r.queue.new_release });

			if (force)
				self.setPages();

			if (self.isFirstLoad())
				self.isFirstLoad(false);
		})
		.fail(function(e) {
			if (e.statusText === "abort")
				return;

			console.error("Error loading queue", e);
		});
	},
	
	setSpeedLimit: function(speedLimit) {
		if (this.__disableSpeedLimitUpdate)
			return;

		console.log("Changing speed limit");

		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "config", name: "speedlimit", value: speedLimit, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r && r.status === true)
				console.log("Changed speed", r);
		})
		.fail(function(e) {
			console.error("Error changing speed limit", this, e);
		});
	},

	clearSpeedLimit: function() {
		this.speedLimit(0);
	},

	setPages: function() {
    // reset paging
    var pagesToAdd = [];
    var page = this.currentPage();
    var totalPages = Math.ceil(this.itemsTotal() / this.itemsPerPage());
    var start = page - 2 <= 0
      ? 0
      : page + 2 > totalPages
        ? totalPages - 5
        : page - 2;
    var end = start + 5 > totalPages - 1 ? totalPages - 1 : start + 5;

    pagesToAdd.push({ title: 'Prev', index: page-1, state: page == 0 ? "disabled" : "" });
    for (var i = start; i <= end; i++)
      pagesToAdd.push({ title: i + 1, index: i, state: page == i ? "active" : "" });
    pagesToAdd.push({ title: 'Next', index: page + 1, state: page == totalPages - 1 ? "disabled" : "" });

    this.pages(pagesToAdd);
	},
	
	selectPage: function(page) {
		if (page.state != "")
			return;

		this.currentPage(page.index);
		this.refresh({ force: true });
	},
	
	showItem: function(e) { 
	  if (e.nodeType === 1) 
	    $(e).hide().fadeIn();
	},
	
	hideItem: function(e) { 
	  if (e.nodeType === 1) 
	    $(e).fadeOut(function() { $(e).remove(); });
	},
	
  __initialize: function () {
    this.pausedUntil = ko.observable();
    this.speed = ko.observable(0);
    this.speedMetric = ko.observable();
    this.updater = new SABUpdaterModel();
	  this.scripts = ko.observableArray([]);
	  this.categories = ko.observableArray([]);
  
    this.itemsTotal = ko.observable(0);
    this.items = ko.observableArray();
    this.currentPage = ko.observable(0);
    this.pages = ko.observableArray([]);
    this.isPaused = ko.observable(false);
    this.timeRemaining = ko.observable();
    this.speedLimit = ko.observable('');
    this.isFirstLoad = ko.observable(true);
    this.sizeLeft = ko.observable('');
    this.size = ko.observable('');
    this.cacheSize = ko.observable('');
    this.cacheArt = ko.observable('');
    
    this.__itemsPerPage = ko.observable();
    
    this.itemsPerPage = ko.computed({ read: this.__getItemsPerPage.bind(this), write: this.__setItemsPerPage.bind(this) }, this);
    this.hasSpeedLimit = ko.computed(this.__getHasSpeedLimit.bind(this), this);
    this.isTimerPaused = ko.computed(this.__getIsTimerPaused.bind(this), this);
    this.pauseTimerText = ko.computed(this.__getPauseTimerText.bind(this), this);
    this.hasScripts = ko.computed(this.__getHasScripts.bind(this), this);
    this.isEmpty = ko.computed(this.__getIsEmpty.bind(this), this);
    this.hasMultiplePages = ko.computed(this.__getHasMultiplePages.bind(this), this);
    this.showDownloadSpeed = ko.computed(this.__getShowDownloadSpeed.bind(this), this);
    this.downloadSpeed = ko.computed(this.__getDownloadSpeed.bind(this), this);
  
    this.speedLimit.subscribe(this.__onSpeedLimitSet.bind(this));
    this.itemsTotal.subscribe(this.__onItemsTotalSet.bind(this));
    this.currentPage.subscribe(this.__onCurrentPageSet.bind(this));
    this.itemsPerPage.subscribe(this.__onItemsPerPageSet.bind(this));
  }
};

// var QueueListModel = function() {
// 	var self = this;
// 
// 	// constants
// 	var refreshXhr;
// 	var defaultItemsPerPage = 20;
// 	var pausedUntil = ko.observable();
// 	var speed = ko.observable(0);
// 	var speedMetric = ko.observable();
// 	var updater = new SABUpdaterModel();
// 
// // 	var priorities = [];
// // 		priorities["Force"] = 2;
// // 		priorities["High"] = 1;
// // 		priorities["Normal"] = 0;
// // 		priorities["Low"] = -1;
// // 		priorities["Stop"] = -4;
// // 
// // 	var speedMetrics = []
// // 		speedMetrics["K"] = "KB/s";
// // 		speedMetrics["M"] = "MB/s";
// // 		speedMetrics["G"] = "GB/s"; // hope to see this one day...
// 
// 	var scripts = ko.observableArray([]);
// 	var categories = ko.observableArray([]);
// // 	var priorities = ko.observableArray([
// // 		{ value: 2, name: "Force" },
// // 		{ value: 1, name: "High" },
// // 		{ value: 0, name: "Normal" },
// // 		{ value: -1, name: "Low" },
// // 		{ value: -4, name: "Stop" }
// // 	]);
// // 	var options = ko.observableArray([
// // 		{ value: 0, name: "Download" },
// // 		{ value: 1, name: "+Repair" },
// // 		{ value: 2, name: "+Unpack" },
// // 		{ value: 3, name: "+Delete" }
// // 	]);
// 
// 	//observables
// 	var itemsTotal = ko.observable(0);
// 	var items = ko.observableArray();
// 	var currentPage = ko.observable(0);
// 	var pages = ko.observableArray([]);
// 	var isPaused = ko.observable(false);
// 	var timeRemaining = ko.observable();
// 	var speedLimit = ko.observable("");
// 	var isFirstLoad = ko.observable(true);
// 	var itemsPerPageInt = ko.observable();
// 	var sizeLeft = ko.observable("");
// 	var size = ko.observable("");
// 	var cacheSize = ko.observable("");
// 	var cacheArt = ko.observable("");
// 
// 	// computables
// 	var itemsPerPage = ko.computed({
// 		read: function() {
// 			itemsPerPageInt(parseInt(localStorage.queueItemsPerPage || defaultItemsPerPage));
// 			return itemsPerPageInt();
// 		},
// 		write: function(v) {
// 			if (!v || isNaN(v) || parseInt(v) <= 0)
// 				v = defaultItemsPerPage;
// 			localStorage.queueItemsPerPage = v;
// 			itemsPerPageInt(v);
// 		}
// 	}, self);
// 	itemsPerPage.subscribe(function(v) {
// 		refresh({ force: true });
// 	});
// 
// 	var hasSpeedLimit = ko.computed(function() {
// 		return speedLimit() && !isNaN(speedLimit());
// 	}, self);
// 
// 	var isTimerPaused = ko.computed(function() {
// 		return pausedUntil() && pausedUntil() > (new XDate());
// 	}, self);
// 	
// 	var pauseTimerText = ko.computed(function() {
// 	  if (!isTimerPaused())
// 	    return '';
// 	  
// 	  var diff = (pausedUntil() - (new XDate())) / 1000,
// 	    diffHours = Math.floor(diff / 3600) % 24,
//       diffMins = Math.floor(diff / 60) % 60,
//       diffSecs = Math.floor(diff % 60);
//     
// 	  if (diffHours > 0)
// 	    return '{0} hour{1} and {2} minute{3}'.formatWith(diffHours, diffHours === 1 ? '' : 's', diffMins, diffMins === 1 ? '' : 's');
// 	  else if (diffMins > 10)
// 	    return '{0} minute{1}'.formatWith(diffMins, diffMins === 1 ? '' : 's');
// 	  else
// 	    return '{0} minute{1} and {2} second{3}'.formatWith(diffMins, diffMins === 1 ? '' : 's', diffSecs, diffSecs === 1 ? '' : 's');
// 	}, self);
// 
// 	var hasScripts = ko.computed(function() {
// 		return scripts().length > 0;
// 	}, self);
// 
// 	var isEmpty = ko.computed(function() {
// 		return items().length <= 0;
// 	}, self);
// 
// 	var hasMultiplePages = ko.computed(function() {
// 		return itemsTotal() / itemsPerPage() > 1;
// 	}, self);
// 
// 	var showDownloadSpeed = ko.computed(function() {
// 		return !isPaused() && !isEmpty() && speed() > 0;
// 	}, self);
// 
// 	var downloadSpeed = ko.computed(function() {
// 		if (showDownloadSpeed())
// 			return speed() + ' ' + speedMetrics[speedMetric()];
// 	}, self);
// 
// 	// subscriptions
// 	speedLimit.subscribe(function(v) {
// 		if (!v || isNaN(v) || parseInt(v) < 0)
// 			speedLimit("");
// 		setSpeedLimit(parseInt(v));
// 	});
// 
// 	itemsTotal.subscribe(function(v) {
// 		SetPages();
// 	}, self);
// 
// 	currentPage.subscribe(function(v) {
// 		SetPages();
// 	}, self);
// 
// 	var moveItem = function(e) {
// 		var itemMoved = e.item;
// 		var itemReplaced = ko.utils.arrayFirst(items(), function(i) { return i.index() == e.targetIndex; });
// 
// 		itemMoved.index(e.targetIndex);
// 		itemReplaced.index(e.sourceIndex);
// 
// 		console.log("Moving queue", e, itemMoved);
// 
// 		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "switch", value: itemMoved.id, value2: e.targetIndex, output: "json", apikey: apiKey } }))
// 		.then(function(r) {
// 			if (r.position != e.targetIndex) {
// 				itemMoved.index(e.sourceIndex);
// 				itemReplaced.index(e.targetIndex);
// 			}
// 		})
// 		.fail(function(e) {
// 			console.error("Error moving queue", itemMoved, e);
//       itemMoved.index(e.sourceIndex);
//       itemReplaced.index(e.targetIndex);
// 		});
// 	};
// 
// 	var removeItem = function() {
// 		if (!confirm("Are you sure you want to delete this?"))
// 			return;
// 
// 		var itemToDelete = this;
// 
// 		console.log("Removing queue item", itemToDelete);
// 
// 		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "delete", value: this.id, output: "json", apikey: apiKey } }))
// 		.then(function(r) {
// 			if (r.status == true) {
// 				items.remove(itemToDelete);
// 				refresh({ force: true });
// 			}
// 		})
// 		.fail(function(e) {
// 			console.error("Error deleting queue item", itemToDelete, e);
// 		});
// 	};
// 
// 	var toggleQueueState = function() {
// 		console.log("Changing queue state");
// 
// 		var targetState = !isPaused();
// 		isPaused(targetState);
// 		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: !targetState ? "resume" : "pause", output: "json", apikey: apiKey } }))
// 		.then(function(r) {
// 			if (!r.status) {
// 				isPaused(!targetState);
// 			  
// 			  if (!targetState)
// 			    pausedUntil(null); 
// 			}
// 		})
// 		.fail(function(e) {
// 			isPaused(!targetState);
// 			console.error("Error changing queue state", this, e);
// 		});
// 	};
// 	
// 	var setPauseMinutes = function(minutes) {
// 		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "config", name: "set_pause", value: minutes, output: "json", apikey: apiKey } }))
// 		.then(function(r) {
// 			if (r && r.status == true)
// 				console.log("Paused for " + minutes + " minutes", r);
// 		})
// 		.fail(function(e) {
// 			console.error("Error changing pause time", this, e);
// 		});
// 	};
// 
// 	var refresh = function(opts) {
// 		var force = opts && opts.force == true || false;
// 
// 		if (!force && refreshXhr && refreshXhr.readyState != 4)
// 			return;
// 
// 		if (refreshXhr && refreshXhr.readyState != 4)
// 			refreshXhr.abort();
// 
// 		refreshXhr = $.ajax({
// 			url: "tapi",
// 			type: "GET",
// 			cache: false,
// 			data: {
// 				mode: "queue",
// 				start: currentPage() * itemsPerPage(),
// 				limit: itemsPerPage(),
// 				output: "json",
// 				apikey: apiKey
// 			}
// 		});
// 
// 		$.when(refreshXhr)
// 		.then(function(r){
// 			if (!r)
// 				return;
// 
// 			var currentItemIds = $.map(items(), function(i) { return i.id; });
// 
// 			if (r.queue.noofslots != itemsTotal())
// 				itemsTotal(r.queue.noofslots);
// 
// 			var queueSpeed = r.queue.speed.split(/\s/);
// 			if (queueSpeed.length == 2) {
// 				speed(parseFloat(queueSpeed[0]));
// 				speedMetric(queueSpeed[1] === 'K' ? 'KB/s' : queueSpeed[1] === 'M' ? 'MB/s' : 'GB/s');
// 			}
// 			timeRemaining(r.queue.timeleft);
// 
// 			if (r.queue.scripts.length != scripts().length)
// 				scripts($.map(r.queue.scripts, function(i) { return i == "*" ? "None" : i }));
// 
// 			if (r.queue.categories.length != categories().length)
// 				categories($.map(r.queue.categories, function(i) { return i == "*" || i == "None" ? "Default" : i }));
// 
// 			isPaused(r.queue.paused);
// 			sizeLeft(r.queue.sizeleft);
// 			size(r.queue.size);
// 			cacheSize(r.queue.cache_size);
// 			cacheArt(r.queue.cache_art);
// 
// 			if (r.queue.speedlimit !== speedLimit()) {
// 				disableSpeedLimitUpdate = true;
// 				speedLimit(r.queue.speedlimit);
// 				disableSpeedLimitUpdate = false;
// 			}
// 			
// 			if (r.queue.pause_int === '0')
// 			  pausedUntil(null);
// 			else {
// 			  var time = r.queue.pause_int.match(/(\d*):?(\d*)/)
// 			  pausedUntil((new XDate()).addMinutes(parseInt(time[1])).addSeconds(parseInt(time[2])));
// 			}
// 
// 			$.each(r.queue.slots, function() {
// 				var data = this;
// 				var existingItem = ko.utils.arrayFirst(items(), function(i) { return i.id == data.nzo_id; });
// 				data.priority = priorities[data.priority];
// 
// 				if (existingItem) {
// 					existingItem.updateData(data);
// 					currentItemIds.splice(currentItemIds.indexOf(data.nzo_id), 1);
// 				}
// 				else {
// 					items.push(new QueueModel(data));
// 					console.log("Added new queue item", data);
// 				}
// 			});
// 
// 			// remove any items that weren't returned by updated data
// 			$.each(currentItemIds, function() {
// 				var id = this.toString();
// 				items.remove(ko.utils.arrayFirst(items(), function(i) { return i.id == id; }));
// 			});
// 
// 			items.sort(function(a, b) { return a.index() < b.index() ? -1 : 1; });
// 
// 			updater.updateData({ downloadUrl: r.queue.new_rel_url, latestVersion: r.queue.new_release });
// 
// 			if (force)
// 				SetPages();
// 
// 			if (isFirstLoad())
// 				isFirstLoad(false);
// 		})
// 		.fail(function(e) {
// 			if (e.statusText === "abort")
// 				return;
// 
// 			console.error("Error loading queue", e);
// 		});
// 	};
// 
// 	var disableSpeedLimitUpdate = false;
// 
// 	var setSpeedLimit = function(speedLimit) {
// 		if (disableSpeedLimitUpdate)
// 			return;
// 
// 		console.log("Changing speed limit");
// 
// 		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "config", name: "speedlimit", value: speedLimit, output: "json", apikey: apiKey } }))
// 		.then(function(r) {
// 			if (r && r.status == true)
// 				console.log("Changed speed", r);
// 		})
// 		.fail(function(e) {
// 			console.error("Error changing speed limit", this, e);
// 		});
// 	};
// 
// 	var clearSpeedLimit = function() {
// 		speedLimit(0);
// 	};
// 
// 	var SetPages = function() {
//     	// reset paging
//     	var pagesToAdd = [];
//     	var page = currentPage();
//     	var totalPages = Math.ceil(itemsTotal() / itemsPerPage());
//     	var start = page - 2 <= 0
//     		? 0
//     		: page + 2 > totalPages
//     			? totalPages - 5
//     			: page - 2;
//     	var end = start + 5 > totalPages - 1 ? totalPages - 1 : start + 5;
// 
//     	pagesToAdd.push({ title: 'Prev', index: page-1, state: page == 0 ? "disabled" : "" });
//     	for (var i = start; i <= end; i++)
//     		pagesToAdd.push({ title: i + 1, index: i, state: page == i ? "active" : "" });
//     	pagesToAdd.push({ title: 'Next', index: page + 1, state: page == totalPages - 1 ? "disabled" : "" });
// 
//     	pages(pagesToAdd);
// 	};
// 
// 	var selectPage = function(page) {
// 		if (page.state != "")
// 			return;
// 
// 		currentPage(page.index);
// 		refresh({ force: true });
// 	}
// 
// 	var showItem = function(e) { if (e.nodeType === 1) $(e).hide().fadeIn() }
// 	var hideItem = function(e) { if (e.nodeType === 1) $(e).fadeOut(function() { $(e).remove(); }) }
// 
// 	// public properties
// 	itemsPerPage = itemsPerPage;
// 	self.categories = categories;
// 	self.options = options;
// 	self.priorities = priorities;
// 	self.scripts = scripts;
// 	self.showDownloadSpeed = showDownloadSpeed;
// 	self.isPaused = isPaused;
// 	self.speedLimit = speedLimit;
// 	self.hasSpeedLimit = hasSpeedLimit;
// 	self.downloadSpeed = downloadSpeed;
// 	self.timeRemaining = timeRemaining;
// 	self.isEmpty = isEmpty;
// 	self.items = items;
// 	self.isFirstLoad = isFirstLoad;
// 	self.hasMultiplePages = hasMultiplePages;
// 	self.pages = pages;
// 	self.updater = updater;
// 	self.sizeLeft = sizeLeft;
// 	self.size = size;
// 	self.cacheSize = cacheSize;
// 	self.cacheArt = cacheArt;
// 	self.pausedUntil = pausedUntil;
// 	self.pauseTimerText = pauseTimerText;
// 	self.isTimerPaused = isTimerPaused;
// 
// 	// public methods
// 	self.refresh = refresh;
// 	self.selectPage = selectPage;
// 	self.clearSpeedLimit = clearSpeedLimit;
// 	self.setSpeedLimit = setSpeedLimit;
// 	self.moveItem = moveItem;
// 	self.removeItem = removeItem;
// 	self.toggleQueueState = toggleQueueState;
// 	self.setPauseMinutes = setPauseMinutes;
// };


var HistoryModel = function(data) {
  this.__initialize(data);
};

HistoryModel.prototype = {
  constructor: HistoryModel,
  
  __getCompletedOnDaysAgo: function() {
    var date = this.completedDate();
    var dateNow = this.currentDate();

    return date ? date.diffDays(dateNow) : -1;
	},
	
	__getCompletedOnDay: function() {
		var date = this.completedDate();
		return date ? date.toString('dddd') : '';
	},
	
	__getCompletedOnDate: function() {
		return this.completedDate() ? this.completedDate().toString('MM/dd/yy hh:mm TT') : '';
	},
	
	__getCompletedOn: function() {
		var daysDiff = this.completedOnDaysAgo();
		var dayString = this.completedOnDay();
		var dateString = this.completedOnDate();
		var ret = null;

		if (daysDiff < 7)
			if (daysDiff > 3)
				ret = 'last ' + dayString;
			else if (daysDiff > 1)
				ret = dayString;
			else if (daysDiff > 0.5)
				ret = this.completedDate().getDay() === this.currentDate().getDay() ? 'today' : 'yesterday';
			else if (daysDiff > 0.1)
				ret = 'a few hours ago';
			else
				ret = 'just now';

		return ret ? '{0} ({1})'.formatWith(ret, dateString) : dateString;
	},
	
	toggleMore: function() {
		this.showMore(!this.showMore());
	},

	state: function(v) {
		var currentStatus = this.status().toLowerCase();

		if (currentStatus !== 'completed' && currentStatus !== 'failed' && currentStatus !== 'queued')
		  currentStatus = 'processing';

		return v.toLowerCase() === currentStatus;
	},

	updateData: function(data) {
		this.id = data.nzo_id;
		this.index(data.index);
		this.name($.trim(data.name));
		this.category(data.category === '*' ? 'Default' : data.category);
		this.status(data.status);
		this.path(data.path);
		this.size(data.size || '--');
		this.sizeBytes(data.bytes);
		this.script(data.script);
		this.stages(data.stage_log);
		this.time(data.download_time);
		this.url(data.url);
		this.infoUrl(data.url_info);
		this.actionLine(data.action_line);

		var date = new Date(0);
		date.setUTCSeconds(data.completed);
		this.completedDate(new XDate(date));
		this.completed(date);

		window.setInterval((function() { this.currentDate(new XDate()); }).bind(this), 3600000); // once per hour
	},
  
  __initialize: function(data) {
    // init observable properties
    this.index = ko.observable();
    this.name = ko.observable();
    this.category = ko.observable();
    this.status = ko.observable();
    this.path = ko.observable();
    this.size = ko.observable();
    this.sizeBytes = ko.observable();
    this.script = ko.observable();
    this.stages = ko.observableArray();
    this.time = ko.observable();
    this.url = ko.observable();
    this.infoUrl = ko.observable();
    this.actionLine = ko.observable();
    this.showMore = ko.observable(false);
    this.completed = ko.observable();
	  this.completedDate = ko.observable();
	  this.currentDate = ko.observable(new XDate());
    
    // init computed properties
    this.completedOnDaysAgo = ko.computed(this.__getCompletedOnDaysAgo.bind(this), this);
    this.completedOnDay = ko.computed(this.__getCompletedOnDay.bind(this), this);
    this.completedOnDate = ko.computed(this.__getCompletedOnDate.bind(this), this);
    this.completedOn = ko.computed(this.__getCompletedOn.bind(this), this);
	
	  // update initial data
	  this.updateData(data);
  }
};


var HistoryListModel = function() {
  this.__initialize();
}

HistoryListModel.prototype = {
  constructor: HistoryListModel,
  
  __defaults: { itemsPerPage: 5 },
  
  __getItemsPerPage: function () {
    this.__itemsPerPage(parseInt(localStorage.historyItemsPerPage || this.defaults.itemsPerPage));
    return this.__itemsPerPage();
  },
  
  __setItemsPerPage: function (v) {
    if (!v || isNaN(v) || parseInt(v) <= 0)
      v = this.defaults.itemsPerPage;
      
    localStorage.historyItemsPerPage = v;
    this.__itemsPerPage(v);
  },
  
  __getIsEmpty: function() {
		return this.items().length === 0;
	},
	
	__getHasMultiplePages: function() {
		return this.itemsTotal() / this.itemsPerPage() > 1;
	},
	
	__onItemsPerPageSet: function(v) {
		this.refresh({ force: true });
	},

	__onItemsTotalSet: function(v) {
		this.setPages();
	},

	__onCurrentPageSet: function(v) {
		this.setPages();
	},
	
	clear: function() {
		if (!confirm("Are you sure you want to clear all history?"))
			return;

    var self = this;
		console.log("Clearing all history");

    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "history", name: "delete", value: "all", output: "json", apikey: apiKey } }))
    .then(function(r) {
      if (r.status === true)
        self.items.removeAll();
    })
    .fail(function(e) {
      console.error("Error clearing all history", e);
    });
  },
  
  removeItem: function(itemToRemove) {
		if (!confirm("Are you sure you want to delete this?"))
			return;
    
    var self = this;
		console.log("Removing history item", itemToDelete);

		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "history", name: "delete", value: itemToRemove.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true) {
				self.items.remove(itemToRemove);
				self.refresh({ force: true });
			}
		})
		.fail(function(e) {
			console.error("Error deleting history item", itemToRemove, e);
		});
  },
  
  retryItem: function(itemToRetry) {
    var self = this;
		console.log("Retrying item", itemToRetry);

		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "retry", value: itemToRetry.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status === true) {
				self.refresh({ force: true });
			}
		})
		.fail(function(e) {
			console.error("Error retrying item", itemToRetry, e);
		});
  },
  
  refresh: function(options) {
		var force = options && options.force === true || false;

		if (!force && this.refreshXhr && this.refreshXhr.readyState !== 4)
			return;

		if (this.refreshXhr && this.refreshXhr.readyState !== 4)
			this.refreshXhr.abort();

    var self = this;
		this.refreshXhr = $.ajax({
			url: "tapi",
			type: "GET",
			cache: false,
			data: {
				mode: "history",
				start: this.currentPage() * this.itemsPerPage(),
				limit: this.itemsPerPage(),
				output: "json",
				apikey: apiKey
			}
		});

		$.when(this.refreshXhr)
		.then(function(r){
			if (!r)
				return;

			var currentItemIds = $.map(self.items(), function(i) { return i.id; });

			if (r.history.noofslots != self.itemsTotal())
				self.itemsTotal(r.history.noofslots);

			$.each(r.history.slots, function(index) {
				var data = this;
				data.index = index;
				var existingItem = ko.utils.arrayFirst(self.items(), function(i) { return i.id == data.nzo_id; });

				if (existingItem) {
					existingItem.updateData(data);
					currentItemIds.splice(currentItemIds.indexOf(existingItem.id), 1);
				}
				else {
					self.items.splice(0, 0, new HistoryModel(data));
				}
			});

			// remove any items that weren't returned by updated data
			$.each(currentItemIds, function() {
				var id = this.toString();
				self.items.remove(ko.utils.arrayFirst(self.items(), function(i) { return i.id == id; }));
			});

			self.items.sort(function(a, b) { return a.index() < b.index() ? -1 : 1; });

			if (force)
				self.setPages();

			if (self.isFirstLoad())
				self.isFirstLoad(false);
		})
		.fail(function(e) {
			if (e.statusText === "abort")
				return;

			console.error("Error loading history", e);
		});
	},
	
	showItem: function(e) { 
	  if (e.nodeType === 1) 
	    $(e).hide().fadeIn(); 
	},
	
	hideItem: function(e) { 
	  if (e.nodeType === 1) 
	    $(e).fadeOut(function() { $(e).remove(); }); 
	},
	
	setPages: function() {
    // reset paging
    var pagesToAdd = [];
    var page = this.currentPage();
    var totalPages = Math.ceil(this.itemsTotal() / this.itemsPerPage());
    var start = page - 2 <= 0
      ? 0
      : page + 2 > totalPages
        ? totalPages - 4
        : page - 2;
    var end = start + 4 > totalPages - 1 ? totalPages - 1 : start + 4;

    pagesToAdd.push({ title: 'Prev', index: page - 1, state: page == 0 ? "disabled" : "" });
    for (var i = start; i <= end; i++)
      pagesToAdd.push({ title: i + 1, index: i, state: page == i ? "active" : "" });
    pagesToAdd.push({ title: 'Next', index: page + 1, state: page == totalPages - 1 ? "disabled" : "" });

    this.pages(pagesToAdd);
	},
	
	selectPage: function(page) {
		if (page.state != "")
			return;

		this.currentPage(page.index);
		this.refresh({ force: true });
	},
  
  __initialize: function() {
    this.itemsTotal = ko.observable(0);
	  this.items = ko.observableArray();
	  this.currentPage = ko.observable(0);
    this.pages = ko.observableArray([]);
	  this.isFirstLoad = ko.observable(true);
	  
	  this.__itemsPerPage = ko.observable();
	  
	  this.itemsPerPage = ko.computed(this.__getItemsPerPage.bind(this), this);
	  this.isEmpty = ko.computed(this.__getIsEmpty.bind(this), this);
	  this.hasMultiplePages = ko.computed(this.__getHasMultiplePages.bind(this), this);
  }
};


var UpdaterModel = function () {
  this.__initialize();
};

UpdaterModel.prototype = {
  constructor: UpdaterModel,
  
  defaults: { 
    checkIntervalMilliseconds: 86400000,
	  currentVersion: 0.5,
	  remoteRepository: 'http://aforty.myftp.org/sabnzbd-knockstrap/'
  },
  
  __getUpdateHidden: function () {
    return sessionStorage.hideUpdate === '1'; 
  },
  
  __setUpdateHidden: function (v) {
    sessionStorage.hideUpdate = v ? '1' : '0';
  },
  
  __getDownloadUrl: function () {
    return this.__downloadUrl();
  },
  
  __setDownloadUrl: function (v) {
    localStorage.downloadUrl = v; 
    this.__downloadUrl(v);
  },

	__getLatestVersion: function () { 
	  return this.__latestVersion(); 
	},
	
	__setLatestVersion: function () {
	  localStorage.latestVersion = v; 
	  this.__latestVersion(v); 
	},
	
	__getUpdateAvailable: function() {
		return this.latestVersion() > this.defaults.currentVersion;
	},

  __getVersionCheckDate: function() { 
    return new XDate(parseInt(localStorage.versionCheckDate || 0)); 
  },
  
  __setVersionCheckDate: function (v) {
    localStorage.versionCheckDate = v.getTime(); 
  },
  
  __getVersionHistory: function () {
    return this.__versionHistory();
  },
  
  __setVersionHistory: function (v) {
    localStorage.versionHistory = JSON.stringify(v); 
    this.__versionHistory(v);
  },
  
  __getVersionHistorySinceThis: function() {
		return ko.utils.arrayFilter(this.versionHistory(), (function(i) {
			return parseFloat(i.version) > this.defaults.currentVersion;
		}).bind(this));
	},
	
	__getShowUpdateBanner: function() {
		return this.updateAvailable() && !this.updateHidden();
	},
	
	checkForUpdates: function() {
		if (this.updateAvailable() || (new XDate()).addMilliseconds(-1 * this.defaults.checkIntervalMilliseconds) < this.versionCheckDate())
			return;

    var self = this;
		console.log("Checking for new theme version");
		
		$.when($.ajax({ url: remoteRepository + "versions.json", type: "GET", dataType: "json", cache: false }))
		.then(function(r) {
			if (!r)
				return;

			if (r.latestFileName.match(/^https?:/g))
			  self.downloadUrl(r.latestFileName);
			else
			  self.downloadUrl(remoteRepository + r.latestFileName);

			self.latestVersion(r.latestVersion);
			self.versionHistory(r.versions);
			self.versionCheckDate(new XDate());
		})
		.fail(function(e) {
			console.error("Error retrieving remote version manifest", e);
		});
	},
	
	remindMeLater: function() {
		this.updateHidden(true);
	},
  
  __initialize: function () {
	  this.__latestVersion = ko.observable(parseFloat(localStorage.latestVersion));
	  this.__downloadUrl = ko.observable(localStorage.downloadUrl);
	  this.__versionHistory = ko.observable(JSON.parse(localStorage.versionHistory || '{}'));
    
    this.updateHidden = ko.computed({ read: this.__getUpdateHidden.bind(this), write: this.__setUpdateHidden.bind(this) }, this);
    this.downloadUrl = ko.computed({ read: this.__getDownloadUrl.bind(this), write: this.__setDownloadUrl.bind(this) }, this);
    this.latestVersion = ko.computed({ read: this.__getLatestVersion.bind(this), write: this.__setLatestVersion.bind(this) }, this);
    this.versionCheckDate = ko.computed({ read: this.__getVersionCheckDate.bind(this), write: this.__setVersionCheckDate.bind(this) }, this);
    this.versionHistory = ko.computed({ read: this.__getVersionHistory.bind(this), write: this.__setVersionHistory.bind(this) }, this);
    
    this.updateAvailable = ko.computed(this.__getUpdateAvailable.bind(this), this);
    this.versionHistorySinceThis = ko.computed(this.__getVersionHistorySinceThis.bind(this), this);
    this.showUpdateBanner = ko.computed(this.__getShowUpdateBanner.bind(this), this);
	
    this.checkForUpdates();
    window.setInterval((function() { this.checkForUpdates(); }).bind(this), this.defaults.checkIntervalMilliseconds);
  }
};


var SABUpdaterModel = function () {
  this.__initialize();
};

SABUpdaterModel.prototype = {
  constructor: SABUpdaterModel,
  
  __getUpdateHidden: function() { 
    return sessionStorage.hideSABUpdate === '1'; 
  },
  
  __setUpdateHidden: function(v) { 
    sessionStorage.hideSABUpdate = v ? '1' : '0'; 
  },
  
  __getUpdateAvailable: function() {
		return this.downloadUrl() !== '';
	},

	__getShowUpdateBanner: function() {
		return this.updateAvailable() && !this.updateHidden();
	},
	
	remindMeLater: function() {
		this.updateHidden(true);
	},

	updateData: function(data) {
		this.downloadUrl(data.downloadUrl);
		this.latestVersion(data.latestVersion);
	},
	
  __initialize: function () {
    this.downloadUrl = ko.observable();
    this.latestVersion = ko.observable();
  }
};


var MainModel = function () {
  this.__initialize();
};

MainModel.prototype = {
  constructor: MainModel,
  
  defaults: { refreshInterval: 2000 },
  
  __getRefreshInterval: function() { 
    return this.__refreshInterval(); 
  },
  
  __setRefreshInterval: function (v) {
    v = isNaN(v) ? this.defaults.refreshInterval : parseInt(v);
    localStorage.refreshInterval = v;
    this.__refreshInterval(v);
  },
  
  __getTitle: function () {
		if (!this.queue.showDownloadSpeed())
			return "SABnzbd";

		return "SABnzbd - " + this.queue.downloadSpeed();
  },
  
  __getHasPauseTimer: function () {
    return this.pauseTimer() && this.pauseTimer() !== '0';
  },
  
  __onRefreshRateSet: function(v) {
		if (!v || isNaN(v) || parseInt(v) <= 0) {
			this.refreshRate(this.refreshInterval() / 1000);
			return;
		}

		this.refreshInterval(v * 1000);
	},
	
	__onRefreshIntervalSet: function (v) {
		this.setRefresh(v);
	},
	
	
	setRefresh: function(interval) {
		if (this.__refreshTimer)
			this.clearRefresh();

		this.__refreshTimer = window.setInterval((function() { this.refresh(); }).bind(this), interval);
	},
	
	clearRefresh: function() {
		window.clearInterval(this.__refreshTimer);
		this.__refreshTimer = null;
	},
	
	refresh: function(options) {
    this.clearRefresh();

    this.queue.refresh(options);
    this.history.refresh(options);
    this.status.refresh(options);

    this.setRefresh(this.refreshInterval());
	},

	restart: function() {
		if (!confirm("Are you sure you want to restart?"))
			return;

    console.log("Restarting");

		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "restart", output: "json", apikey: apiKey } }))
		.fail(function(e) {
			console.error("Error restarting", this, e);
		});
	},
	
	shutdown: function() {
		if (!confirm("Are you sure you want to shutdown?"))
			return;

		console.log("Shutting down");

		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "shutdown", output: "json", apikey: apiKey } }))
		.fail(function(e) {
			console.error("Error shutting down", this, e);
		});
	},
	
	addUrl: function(form) {
		$.when($.ajax({ url: "tapi", type: "POST", cache: false, data: { mode: "addid", name: $(form.url).val(), cat: "Default", script: "Default", priority: -100, pp: -1, apikey: apiKey } }))
		.then(function(r){
			$("#addNZB").modal("hide");
		})
		.fail(function(e){
			console.error("Error adding NZB via URL", e);
		});
	},
	
	addFileFromForm: function(form) {
		return addFile($(form.file)[0].files[0]);
	},
	
	addFile: function(file) {
		var data = new FormData();
		data.append("name", file);
		data.append("mode", "addfile");
		data.append("cat", "Default");    // Default category
		data.append("script", "Default"); // Default script
		data.append("priority", "-100");  // Default priority
		data.append("pp", "-1");          // Default post-processing options
		data.append("apikey", apiKey);

		$.when($.ajax({ url: "tapi", type: "POST", cache: false, processData: false, contentType: false, data: data }))
		.then(function(r){
			$("#addNZB").modal("hide");
		})
		.fail(function(e){
			console.error("Error adding NZB via URL", e);
		});
	},
  
  __initialize: function () {
    this.__refreshInterval = ko.observable(parseInt(localStorage.refreshInterval || this.defaults.refreshInterval));
    this.refreshInterval = ko.computed({ read: this.__getRefreshInterval.bind(this), write: this.__setRefreshInterval.bind(this) }, this);
    this.refreshRate = ko.observable(this.refreshInterval() / 1000);
    
    this.isPaused = ko.observable(false);
    this.pauseTimer = ko.observable();
    this.queue = new QueueListModel();
    this.history = new HistoryListModel();
    this.status = new StatusListModel();
    this.updater = new UpdaterModel();
    
    this.title = ko.computed(this.__getTitle.bind(this), this);
    this.hasPauseTimer = ko.computed(this.__getHasPauseTimer.bind(this), this);
  
    this.refreshRate.subscribe(this.__onRefreshRateSet.bind(this), this);
    this.refreshInterval.subscribe(this.__onRefreshIntervalSet.bind(this), this);
    
    this.refresh({ force: true });
    this.setRefresh(this.refreshInterval());
  }
};