var apiKey;

if (!window.console)
	window.console = { error: function(){}, log: function(){}, warn: function(){} };

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
	var self = this;
	
	self.type = data.type;
	self.date = data.date;
	self.text = data.text;
	
	self.cssType = function() {
		return (self.type == "ERROR" ? "error" : self.type == "WARNING" ? "warning" : "info");
	};
};

var StatusListModel = function() {
	var self = this;
	
	self.items = ko.observableArray();
	self.isFirstLoad = ko.observable(true);
    
	self.isEmpty = ko.computed(function() {
		return self.items().length <= 0;
	}, self);
	
	self.clear = function() {
		if (!confirm("Are you sure you want to clear all status messages?"))
			return;
			
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
	};

	self.refresh = function() {
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
	};

	self.showItem = function(e) { if (e.nodeType === 1) $(e).hide().fadeIn() }
	self.hideItem = function(e) { if (e.nodeType === 1) $(e).fadeOut(function() { $(e).remove(); }) }
};

var QueueModel = function(data) {
	var self = this;
	
	self.id;
	self.index = ko.observable();
	self.name = ko.observable();
	self.status = ko.observable();
	self.totalMB = ko.observable();
	self.remainingMB = ko.observable();
	self.showMore = ko.observable(false);
	
	self.toggleMore = function() {
		self.showMore(!self.showMore());
	};
	
	var categoryInternal = ko.observable();
	var scriptInternal = ko.observable();
	var optionInternal = ko.observable();
	var priorityInternal = ko.observable();
	
	var category = ko.computed({
		read: function() { return categoryInternal(); },
		write: function(v) { if (!v) v = "Default"; if (v != categoryInternal()) { changeCategory(v); categoryInternal(v); } }
	}, self);
	
	var script = ko.computed({
		read: function() { return scriptInternal(); },
		write: function(v) { if (!v) v = "Default"; if (v != scriptInternal()) { changeScript(v); scriptInternal(v); } }
	}, self);
	
	var option = ko.computed({
		read: function() { return optionInternal(); },
		write: function(v) { if (!v) v = 0; if (v != optionInternal()) { changeOption(v); optionInternal(v); } }
	}, self);
	
	var priority = ko.computed({
		read: function() { return priorityInternal(); },
		write: function(v) { if (!v) v = 0; if (v != priorityInternal()) { changePriority(v); priorityInternal(v); } }
	}, self);
	
	// computables
	self.downloadedMB = ko.computed(function() {
		return (self.totalMB() - self.remainingMB()).toFixed(2);
	}, self);
	
	self.percentage = ko.computed(function() {
		return ((self.downloadedMB() / self.totalMB()) * 100).toFixed(2);
	}, self);
	
	self.percentageRounded = ko.computed(function() {
		return Math.floor(self.percentage() || 0);
	}, self);
	
	self.isPaused = ko.computed(function() {
		return self.status() == "Paused";
	}, self);
	
	self.isDownloading = ko.computed(function() {
		return self.status() == "Downloading";
	}, self);
	
	self.hasData = ko.computed(function() {
		return self.downloadedMB() > 0;
	}, self);
	
	self.showProgressBar = ko.computed(function() {
		return self.isDownloading() || self.hasData();
	}, self);
	
	
	// functions
	var changeCategory = function(value) {
		console.log("Changing queue category", this, value);
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_cat", value: self.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				categoryInternal(value);
		})
		.fail(function(e) {
			console.error("Error changing queue category", e);
		});
	};
	
	var changeOption = function(value) {
		console.log("Changing queue option", this, value);
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_opts", value: self.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				optionInternal(value);
		})
		.fail(function(e) {
			console.error("Error changing queue option", this, e);
		});
	};
	
	var changePriority = function(value) {
		console.log("Changing queue priority", this, value);
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "priority", value: self.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				priorityInternal(value);
		})
		.fail(function(e) {
			console.error("Error changing queue priority", this, e);
		});
	};
	
	var changeScript = function(value) {
		console.log("Changing queue script", this, value);
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_script", value: self.id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				scriptInternal(value);
		})
		.fail(function(e) {
			console.error("Error changing queue script", e);
		});
	};
	
	var toggleState = function() {
		console.log("Changing queue state", this);
		var actionType = self.isPaused() ? "resume" : "pause";
        $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: actionType, value: self.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				self.status(self.isPaused() ? "Downloading" : "Paused");
		})
		.fail(function(e) {
			console.error("Error toggling queue state", this, e);
		});
	};
    
	self.updateFromData = function(data) {
		self.id = data.nzo_id;
		self.index(data.index);
		self.name($.trim(data.filename));
		self.status(data.status);
		categoryInternal(/^\*|None$/.test(data.cat) ? "Default" : data.cat);
		priorityInternal(data.priority || "2");
		scriptInternal(data.script);
		optionInternal(parseInt(data.unpackopts));
		self.totalMB(parseFloat(data.mb));
		self.remainingMB(parseFloat(data.mbleft));
	};
	
	self.updateFromData(data);
	
	
	// public
	self.category = category;
	self.script = script;
	self.option = option;
	self.priority = priority;
	
	self.toggleState = toggleState;
};

var QueueListModel = function() {
	var self = this;
	
	// constants
	var refreshXhr;
	var defaultItemsPerPage = 20;
	var speed = ko.observable(0);
	var speedMetric = ko.observable();
	var updater = new SABUpdaterModel();
	
	var priorities = []; 
		priorities["Force"] = 2; 
		priorities["High"] = 1; 
		priorities["Normal"] = 0; 
		priorities["Low"] = -1; 
		priorities["Stop"] = -4;
		
	var speedMetrics = []
		speedMetrics["K"] = "KB/s";
		speedMetrics["M"] = "MB/s";
		speedMetrics["G"] = "GB/s"; // hope to see this one day...
	
	var scripts = ko.observableArray([]);
	var categories = ko.observableArray([]);
	var priorities = ko.observableArray([
		{ value: 2, name: "Force" },
		{ value: 1, name: "High" },
		{ value: 0, name: "Normal" },
		{ value: -1, name: "Low" },
		{ value: -4, name: "Stop" }
	]);
	var options = ko.observableArray([
		{ value: 0, name: "Download" },
		{ value: 1, name: "+Repair" },
		{ value: 2, name: "+Unpack" },
		{ value: 3, name: "+Delete" }
	]);

	self.itemsTotal = ko.observable(0);
	self.items = ko.observableArray();
	self.currentPage = ko.observable(0);
	self.pages = ko.observableArray([]);
	self.isPaused = ko.observable(false);
	self.timeRemaining = ko.observable();
	self.speedLimit = ko.observable("");
	self.isFirstLoad = ko.observable(true);
	
	var itemsPerPageInt = ko.observable();
	var itemsPerPage = ko.computed({
		read: function() { 
			itemsPerPageInt(parseInt(localStorage.queueItemsPerPage || defaultItemsPerPage)); 
			return itemsPerPageInt(); 
		},
		write: function(v) { 
			if (!v || isNaN(v) || parseInt(v) <= 0)
				v = defaultItemsPerPage;
			localStorage.queueItemsPerPage = v; 
			itemsPerPageInt(v); 
		}
	}, self);
	
	itemsPerPage.subscribe(function(v) {
		self.refresh({ force: true });
	});
	
	// computables
	self.hasSpeedLimit = ko.computed(function() {
		var speedLimit = self.speedLimit();
		return speedLimit && !isNaN(speedLimit);
	}, self);
	
	self.hasScripts = ko.computed(function() {
		return scripts().length > 0;
	}, self);
	
	self.isEmpty = ko.computed(function() {
		return self.items().length <= 0;
	}, self);
	
	self.hasMultiplePages = ko.computed(function() {
		return self.itemsTotal() / itemsPerPage() > 1;
	}, self);
	
	self.showDownloadSpeed = ko.computed(function() {
		return !self.isPaused() && !self.isEmpty() && speed() > 0;
	}, self);
	
	self.downloadSpeed = ko.computed(function() {
		if (self.showDownloadSpeed())
			return speed() + ' ' + speedMetrics[speedMetric()];
	}, self);
	
	// subscriptions
	self.speedLimit.subscribe(function(v) {
		if (!v || isNaN(v) || parseInt(v) < 0)
			self.speedLimit("");
			
		setSpeedLimit(parseInt(v));
	});
	
	self.itemsTotal.subscribe(function(v) {
		SetPages();
	}, self);
	
	self.currentPage.subscribe(function(v) {
		SetPages();
	}, self);
	
	self.moveItem = function(e) {
		var itemToMove = e.item;
		
		console.log("Moving queue", e, itemToMove);
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "switch", value: itemToMove.id, value2: e.targetIndex, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.position == e.targetIndex)
				itemToMove.index(e.targetIndex);
		})
		.fail(function(e) {
			console.error("Error moving queue", itemToMove, e);
		});
	};
	
	self.removeItem = function() {
		if (!confirm("Are you sure you want to delete this?"))
			return;
		
		var itemToDelete = this;
		
		console.log("Removing queue item", itemToDelete);
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "delete", value: this.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true) {
				self.items.remove(itemToDelete);
				self.refresh({ force: true });
			}
		})
		.fail(function(e) {
			console.error("Error deleting queue item", itemToDelete, e);
		});
	};
	
	self.toggleQueueState = function() {
		console.log("Changing queue state");
		
		var targetState = !self.isPaused();
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: self.isPaused() ? "resume" : "pause", output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				self.isPaused(targetState);
		})
		.fail(function(e) {
			console.error("Error changing queue state", this, e);
		});
	};
	
	self.refresh = function(opts) {
		var force = opts && opts.force == true || false;
		
		if (!force && refreshXhr && refreshXhr.readyState != 4)
			return;
		
		if (refreshXhr && refreshXhr.readyState != 4)
			refreshXhr.abort();
			
		refreshXhr = $.ajax({ 
			url: "tapi", 
			type: "GET", 
			cache: false, 
			data: { 
				mode: "queue", 
				start: self.currentPage() * itemsPerPage(), 
				limit: itemsPerPage(), 
				output: "json", 
				apikey: apiKey
			} 
		});
		
		$.when(refreshXhr)
		.then(function(r){
			if (!r)
				return;
				
			var currentItemIds = $.map(self.items(), function(i) { return i.id; });
		
			if (r.queue.noofslots != self.itemsTotal())
				self.itemsTotal(r.queue.noofslots);
				
			var queueSpeed = r.queue.speed.split(/\s/);
			if (queueSpeed.length == 2) {
				speed(parseFloat(queueSpeed[0]));
				speedMetric(queueSpeed[1]);
			}
			self.timeRemaining(r.queue.timeleft);
			
			if (r.queue.scripts.length != scripts().length)
				scripts($.map(r.queue.scripts, function(i) { return i == "*" ? "None" : i }));
			
			if (r.queue.categories.length != categories().length)
				categories($.map(r.queue.categories, function(i) { return i == "*" || i == "None" ? "Default" : i }));
			
			self.isPaused(r.queue.paused);
			
			if (r.queue.speedlimit !== self.speedLimit()) {
				disableSpeedLimitUpdate = true;
				self.speedLimit(r.queue.speedlimit);
				disableSpeedLimitUpdate = false;
			}
		
			$.each(r.queue.slots, function() {
				var data = this;
				var existingItem = ko.utils.arrayFirst(self.items(), function(i) { return i.id == data.nzo_id; });
				data.priority = priorities[data.priority];
			
				if (existingItem) {
					existingItem.updateFromData(data);
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
			
			updater.updateFromData({ downloadUrl: r.queue.new_rel_url, latestVersion: r.queue.new_release });
			
			if (force)
				SetPages();
			
			if (self.isFirstLoad())	
				self.isFirstLoad(false);
		})
		.fail(function(e) {
			if (e.statusText === "abort")
				return;
				
			console.error("Error loading queue", e);
		});
	};
	
	var disableSpeedLimitUpdate = false;
	var setSpeedLimit = function(speedLimit) {
		if (disableSpeedLimitUpdate)
			return;
			
		console.log("Changing speed limit");
		
		var targetState = !self.isPaused();
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "config", name: "speedlimit", value: speedLimit, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r && r.status == true)
				console.log("Changed speed", r);
		})
		.fail(function(e) {
			console.error("Error changing speed limit", this, e);
		});
	};
	
	self.clearSpeedLimit = function() {
		self.speedLimit(0);
	};

	var SetPages = function() {
    	// reset paging
    	var pages = [];
    	var currentPage = self.currentPage();
    	var totalPages = Math.ceil(self.itemsTotal() / itemsPerPage());
    	var start = currentPage - 2 <= 0 
    		? 0 
    		: currentPage + 2 > totalPages 
    			? totalPages - 5
    			: currentPage - 2;
    	var end = start + 5 > totalPages - 1 ? totalPages - 1 : start + 5;

    	pages.push({ title: 'Prev', index: currentPage-1, state: currentPage == 0 ? "disabled" : "" });
    	for (var i = start; i <= end; i++) 
    		pages.push({ title: i + 1, index: i, state: currentPage == i ? "active" : "" });
    	pages.push({ title: 'Next', index: currentPage+1, state: currentPage == totalPages - 1 ? "disabled" : "" });
    	
    	self.pages(pages);
	};
	
	self.selectPage = function(page) {
		if (page.state != "")
			return;
			
		self.currentPage(page.index);
		self.refresh({ force: true });
	}

	self.showItem = function(e) { if (e.nodeType === 1) $(e).hide().fadeIn() }
	self.hideItem = function(e) { if (e.nodeType === 1) $(e).fadeOut(function() { $(e).remove(); }) }
	
	// public
	self.itemsPerPage = itemsPerPage;
	self.categories = categories;
	self.options = options;
	self.priorities = priorities;
	self.scripts = scripts;
	
	self.updater = updater;
};

var HistoryModel = function(data) {
	var self = this;
	
	var id;
	var name = ko.observable();
	var category = ko.observable();
	var status = ko.observable();
	var path = ko.observable();
	var size = ko.observable();
	var sizeBytes = ko.observable();
	var script = ko.observable();
	var stages = ko.observableArray();
	var time = ko.observable();
	var url = ko.observable();
	var infoUrl = ko.observable();
	var showMore = ko.observable(false);
	var completed = ko.observable();
	
	var completedDate = ko.observable();
	var currentDate = ko.observable(new XDate());
	var completedOnDaysAgo = ko.computed(function() {
    	var date = completedDate();
    	var dateNow = currentDate();
    	
    	return date ? date.diffDays(dateNow) : -1;
	}, self);
	
	var completedOnDay = ko.computed(function() {
		var date = completedDate();
		return date ? date.toString("dddd") : "";
	}, self);
	
	var completedOnDate = ko.computed(function() {
		return completedDate() ? completedDate().toString("MM/dd/yy hh:mm TT") : "";
	}, self);
	
	var completedOn = ko.computed(function() {
		var daysDiff = completedOnDaysAgo();
		var dayString = completedOnDay();
		var dateString = completedOnDate();
		var ret = null;
		
		if (daysDiff < 7)
			if (daysDiff > 3)
				ret = "last " + dayString;
			else if (daysDiff > 1)
				ret = dayString;
			else if (daysDiff > 0.5)
				ret = completedDate().getDay() == currentDate().getDay() ? "today" : "yesterday";
			else if (daysDiff > 0.1)
				ret = "a few hours ago";
			else
				ret = "just now";
		
		return ret ? ret + " (" + dateString + ")" : dateString;
	}, self);
	
	var toggleMore = function() {
		showMore(!self.showMore());
	};
	
	var state = function(v) {
		v = v.toLowerCase();
		var currentStatus = status().toLowerCase();
		
		if (currentStatus != "completed" && currentStatus != "failed")
		  currentStatus = "processing";
		
		return v == currentStatus;

	};
	
	var updateFromData = function(data) {
		id = data.nzo_id;
		name($.trim(data.name));
		category(data.category == "*" ? "Default" : data.category);
		status(data.status);
		path(data.path);
		size(data.size || "--");
		sizeBytes(data.bytes);
		script(data.script);
		stages(data.stage_log);
		time(data.download_time);
		url(data.url);
		infoUrl(data.url_info);
		
		var date = new Date(0);
		date.setUTCSeconds(data.completed);
		completedDate(new XDate(date));
		completed(date);
		
		window.setInterval(function() { currentDate(new XDate()); }, 3600000); // once per hour
	};
	
	updateFromData(data);
	
	// public methods
	self.updateFromData = updateFromData;
	self.toggleMore = toggleMore;
	self.state = state;
	
	// public properties
	self.id = id;
	self.name = name;
	self.category = category;
	self.status = status;
	self.path = path;
	self.size = size;
	self.sizeBytes = sizeBytes;
	self.script = script;
	self.stages = stages;
	self.time = time;
	self.url = url;
	self.infoUrl = infoUrl;
	self.completed = completed;
	self.completedOn = completedOn;
	self.showMore = showMore;
};

var HistoryListModel = function() {
  var self = this;
    
  // constants/defaults
	var refreshXhr;
	var defaultItemsPerPage = 5;
	
	var itemsTotal = ko.observable(0);
	self.items = ko.observableArray();
	self.currentPage = ko.observable(0);
	self.pages = ko.observableArray([]);
	self.isFirstLoad = ko.observable(true);
	
	var itemsPerPageInt = ko.observable();
	var itemsPerPage = ko.computed({
		read: function() { 
			itemsPerPageInt(parseInt(localStorage.historyItemsPerPage || defaultItemsPerPage)); 
			return itemsPerPageInt(); 
		},
		write: function(v) { 
			if (!v || isNaN(v) || parseInt(v) <= 0)
				v = defaultItemsPerPage;
			localStorage.historyItemsPerPage = v; 
			itemsPerPageInt(v); 
		}
	}, self);
	
	itemsPerPage.subscribe(function(v) {
		self.refresh({ force: true });
	});

	self.isEmpty = ko.computed(function() {
		return self.items().length <= 0;
	}, self);
	
	self.hasMultiplePages = ko.computed(function() {
		return itemsTotal() / itemsPerPage() > 1;
	}, self);
	
	itemsTotal.subscribe(function(v) {
		SetPages();
	}, self);
	
	self.currentPage.subscribe(function(v) {
		SetPages();
	}, self);
	
	self.clear = function() {
		if (!confirm("Are you sure you want to clear all history?"))
			return;
		
		console.log("Clearing all history");
		
	$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "history", name: "delete", value: "all", output: "json", apikey: apiKey } }))
	.then(function(r) {
		if (r.status == true)
			self.items.removeAll();
		})
		.fail(function(e) {
			console.error("Error clearing all history", e);
		});
	};
	
	self.removeItem = function() {
		var itemToDelete = this;
		
		if (!confirm("Are you sure you want to delete this?"))
			return;
		
		console.log("Removing history item", itemToDelete);
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "history", name: "delete", value: this.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true) {
				self.items.remove(itemToDelete);
				self.refresh({ force: true });
			}
		})
		.fail(function(e) {
			console.error("Error deleting history item", itemToDelete, e);
		});
  };
	
	self.refresh = function(opts) {
		var force = opts && opts.force == true || false;
		
		if (!force && refreshXhr && refreshXhr.readyState != 4)
			return;
		
		if (refreshXhr && refreshXhr.readyState != 4)
			refreshXhr.abort();
			
		refreshXhr = $.ajax({ 
			url: "tapi", 
			type: "GET", 
			cache: false, 
			data: { 
				mode: "history", 
				start: self.currentPage() * itemsPerPage(), 
				limit: itemsPerPage(),
				output: "json", 
				apikey: apiKey 
			} 
		});
		
		$.when(refreshXhr)
		.then(function(r){
			if (!r)
				return;
			
			var currentItemIds = $.map(self.items(), function(i) { return i.id; });
			
			if (r.history.noofslots != itemsTotal())
				itemsTotal(r.history.noofslots);
			
			$.each(r.history.slots, function() {
				var data = this;
				var existingItem = ko.utils.arrayFirst(self.items(), function(i) { return i.id == data.nzo_id; });
				
				if (existingItem) {
					existingItem.updateFromData(data);
					currentItemIds.splice(currentItemIds.indexOf(existingItem.id), 1);
				}
				else {
					self.items.splice(0, 0, new HistoryModel(data));
					console.log("Added new history item", data);
				}
			});
			
			// remove any items that weren't returned by updated data
			$.each(currentItemIds, function() {
				var id = this.toString();
				self.items.remove(ko.utils.arrayFirst(self.items(), function(i) { return i.id == id; })); 
			});
			
			self.items.sort(function(a, b) { return a.completed().getTime() > b.completed().getTime() ? -1 : 1; });
			
			if (force)
				SetPages();
			
			if (self.isFirstLoad())	
				self.isFirstLoad(false);
		})
		.fail(function(e) {
			if (e.statusText === "abort")
				return;
				
			console.error("Error loading history", e);
		});
	};
	
	self.showItem = function(e) { if (e.nodeType === 1) $(e).hide().fadeIn() }
	self.hideItem = function(e) { if (e.nodeType === 1) $(e).fadeOut(function() { $(e).remove(); }) }

	var SetPages = function() {
    	// reset paging
    	var pages = [];
    	var currentPage = self.currentPage();
    	var totalPages = Math.ceil(itemsTotal() / itemsPerPage());
    	var start = currentPage - 2 <= 0 
    		? 0 
    		: currentPage + 2 > totalPages 
    			? totalPages - 5
    			: currentPage - 2;
    	var end = start + 5 > totalPages - 1 ? totalPages - 1 : start + 5;

    	pages.push({ title: 'Prev', index: currentPage-1, state: currentPage == 0 ? "disabled" : "" });
    	for (var i = start; i <= end; i++) 
    		pages.push({ title: i + 1, index: i, state: currentPage == i ? "active" : "" });
    	pages.push({ title: 'Next', index: currentPage+1, state: currentPage == totalPages - 1 ? "disabled" : "" });
    	
    	self.pages(pages);
	};
	
	self.selectPage = function(page) {
		if (page.state != "")
			return;
			
		self.currentPage(page.index);
		self.refresh({ force: true });
	}
	
	// public
	self.itemsPerPage = itemsPerPage;
};

var UpdaterModel = function() {
	var self = this;
	
	// constants
	var currentVersion = 0.3;
	var remoteRepository = "http://aforty.myftp.org/sabnzbd-knockstrap/";
	var checkIntervalMilliseconds = 86400000; // 1 day
	
	var updateHidden = ko.computed({
		read: function() { return sessionStorage.hideUpdate == "1"; },
		write: function(v) { sessionStorage.hideUpdate = v ? "1" : "0"; }
	}, self);
	
	var downloadUrl = ko.observable(localStorage.downloadUrl);
	self.downloadUrl = ko.computed({
		read: function() { return downloadUrl(); },
		write: function(v) { localStorage.downloadUrl = v; downloadUrl(v); }
	}, self);
	
	var latestVersion = ko.observable(parseFloat(localStorage.latestVersion));
	self.latestVersion = ko.computed({
		read: function() { return latestVersion(); },
		write: function(v) { localStorage.latestVersion = v; latestVersion(v); }
	}, self);

	self.updateAvailable = ko.computed(function() {
		return self.latestVersion() > currentVersion;
	}, self);
	
	self.versionCheckDate = ko.computed({
		read: function() { return new XDate(parseInt(localStorage.versionCheckDate || 0)); },
		write: function(v) { localStorage.versionCheckDate = v.getTime(); }
	}, self);
	
	var versionHistory = ko.observable(JSON.parse(localStorage.versionHistory || "{}"));
	self.versionHistory = ko.computed({
		read: function() { return versionHistory(); },
		write: function(v) { localStorage.versionHistory = JSON.stringify(v); versionHistory(v); }
	}, self);
	
	self.versionHistorySinceThis = ko.computed(function() {
		return ko.utils.arrayFilter(self.versionHistory(), function(i) { 
			return parseFloat(i.version) > currentVersion;
		});
	}, self);
	
	self.showUpdateBanner = ko.computed(function() {
		return self.updateAvailable() && !updateHidden();
	}, self);
	
	var CheckForUpdates = function() {
		if (self.updateAvailable() || (new XDate()).addMilliseconds(-1 * checkIntervalMilliseconds) < self.versionCheckDate())
			return;
		
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
	};
	
	self.remindMeLater = function() {
		updateHidden(true);
	};
	
	// init
	CheckForUpdates();
	window.setInterval(function() { self.CheckForUpdates(); }, checkIntervalMilliseconds);
};

var SABUpdaterModel = function() {
	var self = this;
	
	var updateHidden = ko.computed({
		read: function() { return sessionStorage.hideSABUpdate == "1"; },
		write: function(v) { sessionStorage.hideSABUpdate = v ? "1" : "0"; }
	}, self);
	
	var downloadUrl = ko.observable();
	var latestVersion = ko.observable();
	
	var updateAvailable = ko.computed(function() {
		return downloadUrl() != "";
	}, self);
	
	var showUpdateBanner = ko.computed(function() {
		return updateAvailable() && !updateHidden();
	}, self);
	
	var remindMeLater = function() {
		updateHidden(true);
	};
	
	var updateFromData = function(vars) {
		downloadUrl(vars.downloadUrl);
		latestVersion(vars.latestVersion);
	};
	
	// public
	self.downloadUrl = downloadUrl;
	self.latestVersion = latestVersion;
	self.showUpdateBanner = showUpdateBanner;
	self.remindMeLater = remindMeLater;
	self.updateFromData = updateFromData;
};

var MainModel = function() {
	var self = this;
	
	// constants
	var defaultRefreshInterval = 2000;
	var refreshTimer;
  
	var refreshInterval = ko.observable();
	self.refreshInterval = ko.computed({
		read: function() { refreshInterval(parseInt(localStorage.refreshInterval || defaultRefreshInterval)); return refreshInterval(); },
		write: function(v) { 
			v = isNaN(v) ? defaultRefreshInterval : parseInt(v);
			localStorage.refreshInterval = v; 
			refreshInterval(v); 
		}
	}, self);
	self.refreshRate = ko.observable(self.refreshInterval() / 1000);
	
	self.refreshRate.subscribe(function(v) {
		if (!v || isNaN(v) || parseInt(v) <= 0) {
			self.refreshRate(self.refreshInterval() / 1000);
			return;
		}
		
		self.refreshInterval(v * 1000);
	});
	
	self.refreshInterval.subscribe(function(v) {
		setRefresh(v);
	});
	
  self.isPaused = ko.observable(false);
	self.pauseRefresh = ko.observable(false);
	self.queue = new QueueListModel();
	self.history = new HistoryListModel();
	self.status = new StatusListModel();
	self.updater = new UpdaterModel();
	
	self.title = ko.computed(function() {
		if (!self.queue.showDownloadSpeed())
			return "SABnzbd";
		
		return "SABnzbd - " + self.queue.downloadSpeed();
	}, self);
    
	var setRefresh = function(interval) {
		if (refreshTimer)
			clearRefresh();
			
		refreshTimer = window.setInterval(function() { self.refresh(); }, interval);
	};
	
	var clearRefresh = function() {
		window.clearInterval(refreshTimer);
		refreshTimer = null;
	};
	
	// methods
	self.refresh = function(opts) {
		if (!self.pauseRefresh()) {
			clearRefresh();
			
// 			opts = $.extend(opts || {}, { itemsPerPage: self.itemsPerPage() });
			
			self.queue.refresh(opts);
			self.history.refresh(opts);
			self.status.refresh(opts);
			
			setRefresh(self.refreshInterval());
		}
	};
	
	self.restart = function() {
		if (!confirm("Are you sure you want to restart?"))
			return;
			
    	console.log("Restarting");
    	
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "restart", output: "json", apikey: apiKey } }))
		.fail(function(e) {
			console.error("Error restarting", this, e);
		});
	};
	
	self.shutdown = function() {
		if (!confirm("Are you sure you want to shutdown?"))
			return;
			
		console.log("Shutting down");
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "shutdown", output: "json", apikey: apiKey } }))
		.fail(function(e) {
			console.error("Error shutting down", this, e);
		});
	};
    
	self.addUrl = function(form) {
		$.when($.ajax({ url: "tapi", type: "POST", cache: false, data: { mode: "addid", name: $(form.url).val(), apikey: apiKey } }))
		.then(function(r){
			$("#addNZB").modal("hide");
		})
		.fail(function(e){
			console.error("Error adding NZB via URL", e);
		});
	};
	
	self.addFile = function(form) {
		var data = new FormData();
		data.append("name", $(form.file)[0].files[0]);
		data.append("mode", "addfile");
		data.append("apikey", apiKey);
		
		$.when($.ajax({ url: "tapi", type: "POST", cache: false, processData: false, contentType: false, data: data }))
		.then(function(r){
			$("#addNZB").modal("hide");
		})
		.fail(function(e){
			console.error("Error adding NZB via URL", e);
		});
	};
	
	self.refresh({ force: true });
	setRefresh(self.refreshInterval());
};